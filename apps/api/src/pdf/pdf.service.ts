import { Injectable, NotFoundException, type OnModuleInit } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { formatShortDateFr, formatTimeFr } from '../common/dates.js';
import { OutboxService } from '../messaging/outbox.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { quoteTotals } from '../reports/billing.js';
import { readParts } from '../reports/parts.js';
import { StorageService } from '../storage/storage.service.js';

const COMPANY = {
    name: process.env.COMPANY_NAME ?? 'Fluxia Maintenance',
    address: process.env.COMPANY_ADDRESS ?? '',
    legal: process.env.COMPANY_LEGAL ?? '',
    email: process.env.COMPANY_EMAIL ?? '',
    phone: process.env.COMPANY_PHONE ?? '',
};

const INK = '#182235';
const MUTED = '#6c778a';
const LINE = '#e4e8ef';
const MARGIN = 50;

const money = (cents: number) =>
    new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100).replace(/ | /g, ' ');

type Doc = PDFKit.PDFDocument;

function toBuffer(doc: Doc): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });
}

function header(doc: Doc, title: string, reference: string, date: Date) {
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(18).text(COMPANY.name, MARGIN, MARGIN);
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED);
    for (const line of [COMPANY.address, [COMPANY.phone, COMPANY.email].filter(Boolean).join(' · '), COMPANY.legal]) {
        if (line) doc.text(line);
    }
    doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(title, 300, MARGIN, { width: 245, align: 'right' });
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(`${reference} · ${formatShortDateFr(date)}`, 300, doc.y + 2, { width: 245, align: 'right' });
    doc.moveTo(MARGIN, 120).lineTo(545, 120).strokeColor(LINE).stroke();
    doc.y = 135;
}

function block(doc: Doc, x: number, y: number, label: string, lines: string[]) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label.toUpperCase(), x, y, { characterSpacing: 0.6 });
    doc.font('Helvetica').fontSize(10).fillColor(INK);
    for (const line of lines.filter(Boolean)) doc.text(line, x, doc.y + 1, { width: 230 });
    return doc.y;
}

function section(doc: Doc, title: string, text: string) {
    if (doc.y > 720) doc.addPage();
    doc.moveDown(0.6).font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(title, MARGIN);
    doc.font('Helvetica').fontSize(10).fillColor('#2b3446').text(text, MARGIN, doc.y + 2, { width: 495, lineGap: 2 });
}

function footer(doc: Doc, note: string) {
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        // Écrire dans la marge basse sans déclencher de saut de page automatique
        const bottom = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(`${note} · page ${i + 1}/${range.count}`, MARGIN, 805, { width: 495, align: 'center', lineBreak: false });
        doc.page.margins.bottom = bottom;
    }
}

/** Documents PDF : rapport d'intervention et devis (aussi joints aux emails). */
@Injectable()
export class PdfService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly outbox: OutboxService,
    ) {}

    onModuleInit() {
        this.outbox.registerAttachment('REPORT_PDF', async (id) => ({
            filename: await this.reportFilename(id),
            content: await this.report(id),
            contentType: 'application/pdf',
        }));
        this.outbox.registerAttachment('INVOICE_PDF', async (id) => {
            const { filename, content } = await this.invoiceFile(id);
            return { filename, content, contentType: 'application/pdf' };
        });
        this.outbox.registerAttachment('QUOTE_PDF', async (id) => ({
            filename: `${(await this.prisma.quote.findUniqueOrThrow({ where: { id } })).number}.pdf`,
            content: await this.quote(id),
            contentType: 'application/pdf',
        }));
    }

    async reportFilename(id: string) {
        const report = await this.prisma.report.findUniqueOrThrow({ where: { id }, include: { intervention: true } });
        return `rapport-intervention-${report.intervention.number}.pdf`;
    }

    async report(id: string): Promise<Buffer> {
        const report = await this.prisma.report.findUnique({
            where: { id },
            include: {
                intervention: {
                    include: { client: true, site: true, equipment: true, technician: true, attachments: { orderBy: { createdAt: 'asc' } } },
                },
            },
        });
        if (!report) throw new NotFoundException('Rapport introuvable');
        const i = report.intervention;

        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: `Rapport d'intervention n°${i.number}` } });
        header(doc, "RAPPORT D'INTERVENTION", `N° ${i.number}`, report.createdAt);

        const top = doc.y;
        const left = block(doc, MARGIN, top, 'Client', [i.client.name, i.site.address, `${i.site.postalCode} ${i.site.city}`]);
        const when = i.startedAt ?? i.scheduledStart;
        const right = block(doc, 315, top, 'Intervention', [
            i.title,
            when ? `Le ${formatShortDateFr(when)} à ${formatTimeFr(when)}` : '',
            i.technician ? `Technicien : ${i.technician.firstName} ${i.technician.lastName}` : '',
            i.equipment ? `Équipement : ${i.equipment.label}` : '',
        ]);
        doc.y = Math.max(left, right) + 10;

        section(doc, 'Motif', report.reason);
        section(doc, 'Diagnostic', report.diagnosis);
        section(doc, 'Travaux réalisés', report.workDone);
        const parts = readParts(report.parts);
        if (parts.length) section(doc, 'Pièces fournies', parts.map((p) => `${p.quantity} × ${p.label}`).join('\n'));
        section(doc, 'Résultat', report.result);
        if (report.recommendation) section(doc, 'Recommandation', report.recommendation);

        // Photos (JPEG / PNG), 3 par ligne
        const photos = i.attachments.filter((a) => a.kind === 'PHOTO' && ['image/jpeg', 'image/png'].includes(a.mimeType)).slice(0, 6);
        if (photos.length) {
            if (doc.y > 560) doc.addPage();
            doc.moveDown(0.8).font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Photos', MARGIN);
            const y0 = doc.y + 6;
            for (const [index, photo] of photos.entries()) {
                const x = MARGIN + (index % 3) * 167;
                const y = y0 + Math.floor(index / 3) * 130;
                try {
                    doc.image(await this.storage.get(photo.storageKey), x, y, { fit: [157, 118], align: 'center', valign: 'center' });
                } catch {
                    doc.rect(x, y, 157, 118).strokeColor(LINE).stroke();
                }
            }
            doc.y = y0 + Math.ceil(photos.length / 3) * 130;
        }

        // Signature du client
        const signature = i.attachments.find((a) => a.kind === 'SIGNATURE');
        if (signature && i.signedBy) {
            if (doc.y > 650) doc.addPage();
            doc.moveDown(0.8).font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text('Signature du client', MARGIN);
            const y = doc.y + 4;
            doc.image(await this.storage.get(signature.storageKey), MARGIN, y, { fit: [200, 80] });
            doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
                `${i.signedBy}${i.signedAt ? `, le ${formatShortDateFr(i.signedAt)} à ${formatTimeFr(i.signedAt)}` : ''}`,
                MARGIN,
                y + 86,
            );
        }

        footer(doc, `${COMPANY.name} · Rapport d'intervention n°${i.number}`);
        return toBuffer(doc);
    }

    async invoiceFile(id: string) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id },
            include: { client: { include: { sites: { take: 1 } } }, lines: { orderBy: { position: 'asc' } }, intervention: { include: { site: true } } },
        });
        if (!invoice) throw new NotFoundException('Facture introuvable');
        const totals = quoteTotals(invoice.lines, invoice.vatRate);
        const site = invoice.intervention?.site ?? invoice.client.sites[0];
        const reference = invoice.number ?? 'BROUILLON';

        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: `Facture ${reference}` } });
        header(doc, invoice.status === 'DRAFT' ? 'FACTURE (BROUILLON)' : 'FACTURE', reference, invoice.issuedAt ?? invoice.createdAt);

        const top = doc.y;
        const left = block(doc, MARGIN, top, 'Facturé à', [invoice.client.name, invoice.client.contactName ?? '', site?.address ?? '', site ? `${site.postalCode} ${site.city}` : '']);
        const right = block(doc, 315, top, 'Détails', [
            invoice.title,
            invoice.dueAt ? `Échéance : ${formatShortDateFr(invoice.dueAt)}` : '',
            invoice.intervention ? `Intervention n°${invoice.intervention.number}` : '',
        ]);
        doc.y = Math.max(left, right) + 18;

        if (invoice.status === 'CANCELLED') {
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#b23b3b').text(`ANNULÉE — avoir ${invoice.creditNoteNumber}`, MARGIN);
            doc.moveDown(0.5);
        }

        const cols = { label: MARGIN, qty: 330, unit: 390, total: 470 };
        const row = (y: number, cells: [string, string, string, string], bold = false) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK);
            doc.text(cells[0], cols.label, y, { width: 270 });
            const height = doc.y - y;
            doc.text(cells[1], cols.qty, y, { width: 50, align: 'right' });
            doc.text(cells[2], cols.unit, y, { width: 70, align: 'right' });
            doc.text(cells[3], cols.total, y, { width: 75, align: 'right' });
            return y + Math.max(height, 12) + 6;
        };
        let y = row(doc.y, ['Désignation', 'Qté', 'PU HT', 'Total HT'], true);
        doc.moveTo(MARGIN, y - 3).lineTo(545, y - 3).strokeColor(LINE).stroke();
        for (const line of invoice.lines) {
            if (y > 720) {
                doc.addPage();
                y = MARGIN;
            }
            y = row(y, [line.label, String(line.quantity).replace('.', ','), money(line.unitPriceCents), money(Math.round(line.quantity * line.unitPriceCents))]);
        }
        doc.moveTo(330, y).lineTo(545, y).strokeColor(LINE).stroke();
        y += 8;
        for (const [label, value, bold] of [
            ['Total HT', money(totals.totalHtCents), false],
            [`TVA ${Math.round(invoice.vatRate * 100)} %`, money(totals.vatCents), false],
            ['Net à payer TTC', money(totals.totalTtcCents), true],
        ] as const) {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(INK);
            doc.text(label, 300, y, { width: 160, align: 'right' });
            doc.text(value, cols.total, y, { width: 75, align: 'right' });
            y = doc.y + 4;
        }
        doc.y = y + 10;
        if (invoice.status === 'PAID' && invoice.paidAt) {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#28764b').text(`Acquittée le ${formatShortDateFr(invoice.paidAt)}`, MARGIN);
        }
        if (invoice.notes) section(doc, 'Remarques', invoice.notes);

        // Mentions obligatoires
        if (doc.y > 690) doc.addPage();
        doc.moveDown(1).font('Helvetica').fontSize(7.5).fillColor(MUTED).text(
            [
                invoice.dueAt ? `Paiement à ${process.env.PAYMENT_TERMS_DAYS ?? 30} jours, au plus tard le ${formatShortDateFr(invoice.dueAt)}. Pas d'escompte pour paiement anticipé.` : '',
                "En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal et indemnité forfaitaire pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce).",
                COMPANY.legal,
            ]
                .filter(Boolean)
                .join('\n'),
            MARGIN,
            doc.y,
            { width: 495 },
        );

        footer(doc, `${COMPANY.name} · Facture ${reference}`);
        return { filename: `${invoice.number ?? 'facture-brouillon'}.pdf`, content: await toBuffer(doc) };
    }

    async quote(id: string): Promise<Buffer> {
        const quote = await this.prisma.quote.findUnique({
            where: { id },
            include: { client: { include: { sites: { take: 1 } } }, lines: { orderBy: { position: 'asc' } }, intervention: { include: { site: true } } },
        });
        if (!quote) throw new NotFoundException('Devis introuvable');
        const site = quote.intervention?.site ?? quote.client.sites[0];
        const totals = quoteTotals(quote.lines, quote.vatRate);
        const issued = quote.validatedAt ?? quote.createdAt;
        const validUntil = new Date(issued.getTime() + 30 * 86_400_000);

        const doc = new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true, info: { Title: `Devis ${quote.number}` } });
        header(doc, 'DEVIS', quote.number, issued);

        const top = doc.y;
        const left = block(doc, MARGIN, top, 'Client', [quote.client.name, quote.client.contactName ?? '', site?.address ?? '', site ? `${site.postalCode} ${site.city}` : '']);
        const right = block(doc, 315, top, 'Objet', [quote.title, `Valable jusqu'au ${formatShortDateFr(validUntil)}`]);
        doc.y = Math.max(left, right) + 18;

        // Tableau des lignes
        const cols = { label: MARGIN, qty: 330, unit: 390, total: 470 };
        const row = (y: number, cells: [string, string, string, string], bold = false) => {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK);
            doc.text(cells[0], cols.label, y, { width: 270 });
            const height = doc.y - y;
            doc.text(cells[1], cols.qty, y, { width: 50, align: 'right' });
            doc.text(cells[2], cols.unit, y, { width: 70, align: 'right' });
            doc.text(cells[3], cols.total, y, { width: 75, align: 'right' });
            return y + Math.max(height, 12) + 6;
        };

        let y = row(doc.y, ['Désignation', 'Qté', 'PU HT', 'Total HT'], true);
        doc.moveTo(MARGIN, y - 3).lineTo(545, y - 3).strokeColor(LINE).stroke();
        for (const line of quote.lines) {
            if (y > 720) {
                doc.addPage();
                y = MARGIN;
            }
            y = row(y, [line.label, String(line.quantity).replace('.', ','), money(line.unitPriceCents), money(Math.round(line.quantity * line.unitPriceCents))]);
        }
        doc.moveTo(330, y).lineTo(545, y).strokeColor(LINE).stroke();
        y += 8;
        for (const [label, value, bold] of [
            ['Total HT', money(totals.totalHtCents), false],
            [`TVA ${Math.round(quote.vatRate * 100)} %`, money(totals.vatCents), false],
            ['Total TTC', money(totals.totalTtcCents), true],
        ] as const) {
            doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9.5).fillColor(INK);
            doc.text(label, 330, y, { width: 130, align: 'right' });
            doc.text(value, cols.total, y, { width: 75, align: 'right' });
            y = doc.y + 4;
        }
        doc.y = y + 10;

        if (quote.notes) section(doc, 'Remarques', quote.notes);

        // Bon pour accord
        if (doc.y > 650) doc.addPage();
        const boxY = doc.y + 20;
        doc.roundedRect(315, boxY, 230, 90, 6).strokeColor(LINE).stroke();
        doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text('Bon pour accord', 325, boxY + 10);
        doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('Date, nom et signature du client', 325, boxY + 24);
        doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
            `Devis valable 30 jours. Acompte éventuel et délais selon nos conditions générales. Les prix s'entendent hors frais imprévus constatés sur site.`,
            MARGIN,
            boxY + 4,
            { width: 240 },
        );

        footer(doc, `${COMPANY.name} · Devis ${quote.number}`);
        return toBuffer(doc);
    }
}
