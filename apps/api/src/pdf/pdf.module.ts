import { Controller, Get, Module, NotFoundException, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { assertInterventionAccess, currentUser } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PdfService } from './pdf.service.js';

const pdf = (res: Response, filename: string, content: Buffer) => {
    res.set({ 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${filename}"`, 'cache-control': 'no-store' });
    return new StreamableFile(content);
};

@Controller()
class PdfController {
    constructor(
        private readonly pdf: PdfService,
        private readonly prisma: PrismaService,
    ) {}

    @Get('reports/:id/pdf')
    @Roles('MANAGER', 'TECHNICIAN')
    async report(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
        const report = await this.prisma.report.findUnique({ where: { id }, include: { intervention: true } });
        if (!report) throw new NotFoundException('Rapport introuvable');
        assertInterventionAccess(currentUser(), report.intervention.technicianId);
        return pdf(res, await this.pdf.reportFilename(id), await this.pdf.report(id));
    }

    @Get('quotes/:id/pdf')
    async quote(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
        const quote = await this.prisma.quote.findUnique({ where: { id } });
        if (!quote) throw new NotFoundException('Devis introuvable');
        return pdf(res, `${quote.number}.pdf`, await this.pdf.quote(id));
    }
}

@Module({
    controllers: [PdfController],
    providers: [PdfService],
    exports: [PdfService],
})
export class PdfModule {}
