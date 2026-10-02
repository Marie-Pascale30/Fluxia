import {
    Body,
    ConflictException,
    Controller,
    Get,
    Global,
    HttpCode,
    Injectable,
    Module,
    NotFoundException,
    Param,
    Post,
    Res,
    StreamableFile,
    UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { ActivityService } from '../activity/activity.service.js';
import { Public } from '../auth/decorators.js';
import { PdfModule } from '../pdf/pdf.module.js';
import { PdfService } from '../pdf/pdf.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { quoteTotals } from '../reports/billing.js';
import { createPortalToken, readPortalToken } from './portal-token.js';

const WEB_URL = () => (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const VISIBLE_QUOTES = ['SENT', 'ACCEPTED', 'REFUSED'] as const;

class DecisionDto {
    @IsBoolean() accept: boolean;
    @IsString() @MinLength(2) @MaxLength(120) name: string;
    @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

@Injectable()
export class PortalService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
        private readonly pdf: PdfService,
    ) {}

    /** Lien du portail à insérer dans les emails (calculé, jamais stocké). */
    async link(clientId: string) {
        const client = await this.prisma.client.findUniqueOrThrow({ where: { id: clientId } });
        return `${WEB_URL()}/portail/${createPortalToken(client.id, client.portalVersion)}`;
    }

    /** Révoque tous les liens existants et en émet un nouveau. */
    async rotate(clientId: string) {
        await this.prisma.client.update({ where: { id: clientId }, data: { portalVersion: { increment: 1 } } });
        await this.activity.log({ actor: 'USER', type: 'PORTAL_ROTATED', message: 'Liens du portail client renouvelés (anciens liens révoqués)', entityType: 'CLIENT', entityId: clientId });
        return this.link(clientId);
    }

    private async client(token: string) {
        const claims = readPortalToken(token);
        const client = claims ? await this.prisma.client.findUnique({ where: { id: claims.clientId } }) : null;
        if (!client || client.portalVersion !== claims!.version) throw new NotFoundException('Lien invalide ou expiré');
        return client;
    }

    async summary(token: string) {
        const client = await this.client(token);
        const [interventions, quotes] = await Promise.all([
            this.prisma.intervention.findMany({
                where: { clientId: client.id, status: { not: 'CANCELLED' } },
                orderBy: [{ scheduledStart: 'desc' }, { createdAt: 'desc' }],
                take: 30,
                include: { site: true, technician: { select: { firstName: true } }, report: { select: { id: true, status: true } } },
            }),
            this.prisma.quote.findMany({
                where: { clientId: client.id, status: { in: [...VISIBLE_QUOTES] } },
                orderBy: { createdAt: 'desc' },
                include: { lines: { orderBy: { position: 'asc' } } },
            }),
        ]);

        // Uniquement ce que le client doit voir : pas de notes internes ni de journal
        return {
            client: { name: client.name, contactName: client.contactName },
            interventions: interventions.map((i) => ({
                id: i.id,
                number: i.number,
                title: i.title,
                status: i.status,
                scheduledStart: i.scheduledStart,
                scheduledEnd: i.scheduledEnd,
                technician: i.technician?.firstName ?? null,
                site: `${i.site.address}, ${i.site.postalCode} ${i.site.city}`,
                reportId: i.report?.status === 'SENT' ? i.report.id : null,
            })),
            quotes: quotes.map((q) => ({
                id: q.id,
                number: q.number,
                title: q.title,
                status: q.status,
                sentAt: q.sentAt,
                decidedAt: q.decidedAt,
                decisionBy: q.decisionBy,
                lines: q.lines.map((l) => ({ label: l.label, quantity: l.quantity, unitPriceCents: l.unitPriceCents })),
                ...quoteTotals(q.lines, q.vatRate),
            })),
        };
    }

    async decide(token: string, quoteId: string, dto: DecisionDto) {
        const client = await this.client(token);
        const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, clientId: client.id, status: { in: [...VISIBLE_QUOTES] } } });
        if (!quote) throw new NotFoundException('Devis introuvable');
        if (quote.status !== 'SENT') throw new ConflictException('Ce devis a déjà reçu une réponse');

        const status = dto.accept ? 'ACCEPTED' : 'REFUSED';
        await this.prisma.$transaction(async (tx) => {
            await tx.quote.update({
                where: { id: quoteId },
                data: { status, decidedAt: new Date(), decisionBy: dto.name, decisionNote: dto.note },
            });
            await this.activity.log(
                {
                    actor: 'SYSTEM',
                    type: dto.accept ? 'QUOTE_ACCEPTED_ONLINE' : 'QUOTE_REFUSED_ONLINE',
                    message: `Devis ${quote.number} ${dto.accept ? 'accepté' : 'refusé'} en ligne par ${dto.name}${dto.note ? ` : « ${dto.note} »` : ''}`,
                    entityType: 'QUOTE',
                    entityId: quoteId,
                },
                tx,
            );
        });
        return this.summary(token);
    }

    async reportPdf(token: string, reportId: string) {
        const client = await this.client(token);
        const report = await this.prisma.report.findFirst({ where: { id: reportId, status: 'SENT', intervention: { clientId: client.id } } });
        if (!report) throw new NotFoundException('Rapport introuvable');
        return { filename: await this.pdf.reportFilename(reportId), content: await this.pdf.report(reportId) };
    }

    async quotePdf(token: string, quoteId: string) {
        const client = await this.client(token);
        const quote = await this.prisma.quote.findFirst({ where: { id: quoteId, clientId: client.id, status: { in: [...VISIBLE_QUOTES] } } });
        if (!quote) throw new NotFoundException('Devis introuvable');
        return { filename: `${quote.number}.pdf`, content: await this.pdf.quote(quoteId) };
    }
}

const pdf = (res: Response, file: { filename: string; content: Buffer }) => {
    res.set({ 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${file.filename}"`, 'cache-control': 'no-store' });
    return new StreamableFile(file.content);
};

/** Accès client par lien signé : aucune session, limité en fréquence. */
@Public()
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: Number(process.env.PORTAL_RATE_LIMIT ?? 120), ttl: 60_000 } })
@Controller('portal/:token')
class PortalController {
    constructor(private readonly portal: PortalService) {}

    @Get()
    summary(@Param('token') token: string) {
        return this.portal.summary(token);
    }

    @Post('quotes/:id/decision')
    @HttpCode(200)
    decide(@Param('token') token: string, @Param('id') id: string, @Body() dto: DecisionDto) {
        return this.portal.decide(token, id, dto);
    }

    @Get('reports/:id/pdf')
    async report(@Param('token') token: string, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
        return pdf(res, await this.portal.reportPdf(token, id));
    }

    @Get('quotes/:id/pdf')
    async quote(@Param('token') token: string, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
        return pdf(res, await this.portal.quotePdf(token, id));
    }
}

/** Gestion des liens par le responsable. */
@Controller('clients/:id/portal-link')
class PortalLinkController {
    constructor(private readonly portal: PortalService) {}

    @Get()
    async get(@Param('id') id: string) {
        return { url: await this.portal.link(id) };
    }

    @Post('rotate')
    @HttpCode(200)
    async rotate(@Param('id') id: string) {
        return { url: await this.portal.rotate(id) };
    }
}

@Global()
@Module({
    imports: [PdfModule],
    controllers: [PortalController, PortalLinkController],
    providers: [PortalService],
    exports: [PortalService],
})
export class PortalModule {}
