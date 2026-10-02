import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    HttpCode,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Patch,
    Post,
    Query,
    Res,
    StreamableFile,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDateString, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import type { Response } from 'express';
import { ActivityService } from '../activity/activity.service.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ClientsService } from '../clients/clients.service.js';
import { addDays, dayKey, parseDay, startOfDay, zonedParts } from '../common/dates.js';
import { QUOTE_LINE_KINDS, type QuoteLineKind } from '../common/domain.js';
import { nextValue } from '../common/numbering.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { PdfService } from '../pdf/pdf.service.js';
import { PortalService } from '../portal/portal.module.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { computeBilling, quoteTotals } from '../reports/billing.js';
import { readParts } from '../reports/parts.js';
import { salesJournalCsv } from './accounting.js';

const PAYMENT_TERMS_DAYS = Number(process.env.PAYMENT_TERMS_DAYS ?? 30);
const PAYMENT_METHODS = ['TRANSFER', 'CHECK', 'CARD', 'CASH'] as const;

class InvoiceLineDto {
    @IsIn(QUOTE_LINE_KINDS) kind: QuoteLineKind;
    @IsString() @MinLength(1) @MaxLength(200) label: string;
    @IsNumber() @Min(0.01) @Max(10_000) quantity: number;
    @IsInt() @Min(0) unitPriceCents: number;
}

class UpdateInvoiceDto {
    @IsOptional() @IsString() @MinLength(3) @MaxLength(200) title?: string;
    @IsOptional() @IsString() @MaxLength(2000) notes?: string;
    @IsOptional() @IsArray() @ArrayMaxSize(50) @ValidateNested({ each: true }) @Type(() => InvoiceLineDto) lines?: InvoiceLineDto[];
}

class PayDto {
    @IsIn(PAYMENT_METHODS) method: (typeof PAYMENT_METHODS)[number];
    @IsOptional() @IsDateString() paidAt?: string;
}

class CancelDto {
    @IsString() @MinLength(3) @MaxLength(500) reason: string;
}

const include = {
    client: true,
    lines: { orderBy: { position: 'asc' } },
    quote: { select: { id: true, number: true } },
    intervention: { select: { id: true, number: true, title: true } },
} as const;

type InvoiceRow = { status: string; dueAt: Date | null; vatRate: number; lines: { quantity: number; unitPriceCents: number }[] };
const present = <T extends InvoiceRow>(invoice: T) => ({
    ...invoice,
    ...quoteTotals(invoice.lines, invoice.vatRate),
    overdue: invoice.status === 'ISSUED' && !!invoice.dueAt && invoice.dueAt < new Date(),
});

@Injectable()
export class InvoicesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly catalog: CatalogService,
        private readonly clients: ClientsService,
        private readonly portal: PortalService,
    ) {}

    async list(status?: string, overdue?: boolean) {
        const invoices = await this.prisma.invoice.findMany({
            where: overdue ? { status: 'ISSUED', dueAt: { lt: new Date() } } : status ? { status: status as never } : undefined,
            orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
            include,
        });
        return invoices.map(present);
    }

    private async get(id: string, tx: Tx = this.prisma) {
        const invoice = await tx.invoice.findUnique({ where: { id }, include });
        if (!invoice) throw new NotFoundException('Facture introuvable');
        return invoice;
    }

    async findOne(id: string) {
        const invoice = await this.get(id);
        const [timeline, messages] = await Promise.all([this.activity.forEntities([id]), this.activity.messagesFor([id])]);
        return { ...present(invoice), timeline, messages };
    }

    private async createDraft(
        tx: Tx,
        data: { clientId: string; title: string; vatRate?: number; notes?: string; quoteId?: string; interventionId?: string; reportId?: string },
        lines: { kind: QuoteLineKind; label: string; quantity: number; unitPriceCents: number }[],
        source: string,
    ) {
        if (!lines.length) throw new BadRequestException('Aucun élément à facturer');
        const invoice = await tx.invoice.create({
            data: { ...data, lines: { create: lines.map((l, position) => ({ ...l, position })) } },
        });
        await this.activity.log({ actor: 'USER', type: 'INVOICE_DRAFTED', message: `Facture brouillon créée ${source}`, entityType: 'INVOICE', entityId: invoice.id }, tx);
        return invoice;
    }

    /** Facture à partir d'un devis accepté (une seule par devis). */
    async fromQuote(quoteId: string) {
        const quote = await this.prisma.quote.findUnique({ where: { id: quoteId }, include: { lines: { orderBy: { position: 'asc' } }, invoice: true } });
        if (!quote) throw new NotFoundException('Devis introuvable');
        if (quote.status !== 'ACCEPTED') throw new ConflictException('Seul un devis accepté peut être facturé');
        if (quote.invoice) throw new ConflictException('Ce devis est déjà facturé');
        const invoice = await this.prisma.$transaction((tx) =>
            this.createDraft(
                tx,
                { clientId: quote.clientId, title: quote.title, vatRate: quote.vatRate, quoteId, interventionId: quote.interventionId ?? undefined },
                quote.lines.map((l) => ({ kind: l.kind, label: l.label, quantity: l.quantity, unitPriceCents: l.unitPriceCents })),
                `depuis le devis ${quote.number}`,
            ),
        );
        return this.findOne(invoice.id);
    }

    /** Facture directe d'une intervention (éléments hors contrat du rapport), sans devis. */
    async fromReport(reportId: string) {
        const report = await this.prisma.report.findUnique({ where: { id: reportId }, include: { intervention: true, invoice: true, quote: true } });
        if (!report) throw new NotFoundException('Rapport introuvable');
        if (report.invoice) throw new ConflictException('Cette intervention est déjà facturée');
        if (report.quote) throw new ConflictException(`Un devis existe (${report.quote.number}) : facturez à partir du devis accepté`);
        if (report.status === 'DRAFT') throw new ConflictException('Validez le rapport avant de facturer');

        const [prices, coverage] = await Promise.all([this.catalog.priceMap(), this.clients.coverage(report.intervention.clientId, report.createdAt)]);
        const billing = computeBilling(readParts(report.parts), report.laborHours, coverage, prices);
        const invoice = await this.prisma.$transaction((tx) =>
            this.createDraft(
                tx,
                {
                    clientId: report.intervention.clientId,
                    title: `Intervention n°${report.intervention.number} — ${report.intervention.title}`,
                    notes: billing.notes,
                    interventionId: report.interventionId,
                    reportId,
                },
                billing.lines.map(({ kind, label, quantity, unitPriceCents }) => ({ kind, label, quantity, unitPriceCents })),
                `depuis l'intervention n°${report.intervention.number}`,
            ),
        );
        return this.findOne(invoice.id);
    }

    async update(id: string, dto: UpdateInvoiceDto) {
        const invoice = await this.get(id);
        if (invoice.status !== 'DRAFT') throw new ConflictException('Une facture émise ne peut plus être modifiée (annulez-la par un avoir)');
        await this.prisma.$transaction(async (tx) => {
            if (dto.lines) {
                await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
                await tx.invoiceLine.createMany({ data: dto.lines.map((l, position) => ({ ...l, invoiceId: id, position })) });
            }
            await tx.invoice.update({ where: { id }, data: { title: dto.title, notes: dto.notes } });
        });
        return this.findOne(id);
    }

    async remove(id: string) {
        const invoice = await this.get(id);
        if (invoice.status !== 'DRAFT') throw new ConflictException('Une facture émise ne se supprime pas : annulez-la par un avoir');
        await this.prisma.invoice.delete({ where: { id } });
        return { deleted: true };
    }

    /** Émission : numéro définitif attribué dans la transaction (aucun trou dans la séquence). */
    async issue(id: string) {
        const invoice = await this.get(id);
        if (invoice.status !== 'DRAFT') throw new ConflictException('Facture déjà émise');
        if (!invoice.lines.length || invoice.lines.some((l) => l.unitPriceCents === 0)) {
            throw new BadRequestException('Toutes les lignes doivent avoir un prix avant émission');
        }
        const portal = await this.portal.link(invoice.clientId);
        await this.prisma.$transaction(async (tx) => {
            const now = new Date();
            const { year } = zonedParts(now);
            const seq = await nextValue(tx, `invoice:${year}`, 1);
            const number = `F-${year}-${String(seq).padStart(4, '0')}`;
            const dueAt = addDays(startOfDay(now), PAYMENT_TERMS_DAYS);
            await tx.invoice.update({ where: { id }, data: { status: 'ISSUED', number, issuedAt: now, dueAt } });
            const { totalTtcCents } = quoteTotals(invoice.lines, invoice.vatRate);
            if (invoice.client.email) {
                await this.activity.sendMessage(
                    {
                        recipient: invoice.client.email,
                        subject: `Facture ${number} — ${invoice.title}`,
                        attachments: [{ kind: 'INVOICE_PDF', id }],
                        body: `Bonjour,\n\nVeuillez trouver ci-jointe notre facture ${number} d'un montant de ${(totalTtcCents / 100).toFixed(2).replace('.', ',')} € TTC, payable avant le ${dayKey(dueAt).split('-').reverse().join('/')}.\n\nVos documents sont aussi disponibles sur votre espace client :\n${portal}\n\nCordialement,\nL'équipe maintenance`,
                        entityType: 'INVOICE',
                        entityId: id,
                    },
                    tx,
                );
            }
            await this.activity.log({ actor: 'USER', type: 'INVOICE_ISSUED', message: `Facture ${number} émise`, entityType: 'INVOICE', entityId: id }, tx);
        });
        return this.findOne(id);
    }

    async pay(id: string, dto: PayDto) {
        const invoice = await this.get(id);
        if (invoice.status !== 'ISSUED') throw new ConflictException('Seule une facture émise peut être réglée');
        const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.invoice.update({ where: { id }, data: { status: 'PAID', paidAt, paymentMethod: dto.method } });
            await this.activity.log({ actor: 'USER', type: 'INVOICE_PAID', message: `Facture ${invoice.number} réglée`, entityType: 'INVOICE', entityId: id }, tx);
        });
        return this.findOne(id);
    }

    /** Annulation par avoir numéroté (la facture reste dans la séquence). */
    async cancel(id: string, reason: string) {
        const invoice = await this.get(id);
        if (invoice.status !== 'ISSUED') throw new ConflictException('Seule une facture émise et non réglée peut être annulée');
        await this.prisma.$transaction(async (tx) => {
            const { year } = zonedParts(new Date());
            const seq = await nextValue(tx, `credit:${year}`, 1);
            const creditNoteNumber = `A-${year}-${String(seq).padStart(4, '0')}`;
            await tx.invoice.update({ where: { id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason, creditNoteNumber } });
            await this.activity.log(
                { actor: 'USER', type: 'INVOICE_CANCELLED', message: `Facture ${invoice.number} annulée par l'avoir ${creditNoteNumber} : ${reason}`, entityType: 'INVOICE', entityId: id },
                tx,
            );
        });
        return this.findOne(id);
    }

    /** Journal des ventes de la période (factures émises et avoirs). */
    async exportCsv(from: Date, to: Date) {
        const [invoices, credits] = await Promise.all([
            this.prisma.invoice.findMany({ where: { issuedAt: { gte: from, lt: to }, number: { not: null } }, include, orderBy: { issuedAt: 'asc' } }),
            this.prisma.invoice.findMany({ where: { cancelledAt: { gte: from, lt: to } }, include, orderBy: { cancelledAt: 'asc' } }),
        ]);
        const entry = (i: (typeof invoices)[number], date: Date, number: string, credit = false) => {
            const t = quoteTotals(i.lines, i.vatRate);
            return { date, number, clientName: i.client.name, htCents: t.totalHtCents, vatCents: t.vatCents, ttcCents: t.totalTtcCents, credit };
        };
        const entries = [
            ...invoices.map((i) => entry(i, i.issuedAt!, i.number!)),
            ...credits.map((i) => entry(i, i.cancelledAt!, i.creditNoteNumber!, true)),
        ].sort((a, b) => a.date.getTime() - b.date.getTime());
        return salesJournalCsv(entries);
    }
}

@Controller()
class InvoicesController {
    constructor(
        private readonly invoices: InvoicesService,
        private readonly pdf: PdfService,
    ) {}

    @Get('invoices')
    list(@Query('status') status?: string, @Query('overdue') overdue?: string) {
        return this.invoices.list(status, overdue === 'true');
    }

    /** ?from=YYYY-MM-DD&to=YYYY-MM-DD (bornes incluses), défaut : mois en cours */
    @Get('invoices/export')
    async export(@Res({ passthrough: true }) res: Response, @Query('from') from?: string, @Query('to') to?: string) {
        const now = zonedParts(new Date());
        const start = from ? parseDay(from) : parseDay(`${now.year}-${String(now.month).padStart(2, '0')}-01`);
        const end = addDays(to ? parseDay(to) : startOfDay(new Date()), 1);
        res.set({
            'content-type': 'text/csv; charset=utf-8',
            'content-disposition': `attachment; filename="journal-ventes-${dayKey(start)}-${dayKey(addDays(end, -1))}.csv"`,
        });
        return this.invoices.exportCsv(start, end);
    }

    @Get('invoices/:id')
    get(@Param('id') id: string) {
        return this.invoices.findOne(id);
    }

    @Get('invoices/:id/pdf')
    async invoicePdf(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
        const { filename, content } = await this.pdf.invoiceFile(id);
        res.set({ 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${filename}"`, 'cache-control': 'no-store' });
        return new StreamableFile(content);
    }

    @Post('quotes/:id/invoice')
    fromQuote(@Param('id') id: string) {
        return this.invoices.fromQuote(id);
    }

    @Post('reports/:id/invoice')
    fromReport(@Param('id') id: string) {
        return this.invoices.fromReport(id);
    }

    @Patch('invoices/:id')
    update(@Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
        return this.invoices.update(id, dto);
    }

    @Delete('invoices/:id')
    remove(@Param('id') id: string) {
        return this.invoices.remove(id);
    }

    @Post('invoices/:id/issue')
    @HttpCode(200)
    issue(@Param('id') id: string) {
        return this.invoices.issue(id);
    }

    @Post('invoices/:id/pay')
    @HttpCode(200)
    pay(@Param('id') id: string, @Body() dto: PayDto) {
        return this.invoices.pay(id, dto);
    }

    @Post('invoices/:id/cancel')
    @HttpCode(200)
    cancel(@Param('id') id: string, @Body() dto: CancelDto) {
        return this.invoices.cancel(id, dto.reason);
    }
}

@Module({
    imports: [PdfModule],
    controllers: [InvoicesController],
    providers: [InvoicesService],
})
export class InvoicesModule {}
