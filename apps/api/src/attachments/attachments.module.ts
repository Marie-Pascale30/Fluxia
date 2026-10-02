import {
    BadRequestException,
    Body,
    ConflictException,
    Controller,
    Delete,
    Get,
    HttpCode,
    Module,
    NotFoundException,
    Param,
    Post,
    Res,
    StreamableFile,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Response } from 'express';
import { ActivityService } from '../activity/activity.service.js';
import { assertInterventionAccess, currentUser } from '../auth/auth.types.js';
import { Roles } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { decodePngDataUrl, detectFileType } from './file-types.js';
import { TranscriptionService } from './transcription.service.js';

const MAX_UPLOAD = 25 * 1024 * 1024;
const LOCKED_STATUSES = ['CLOSED', 'CANCELLED'];

class UploadDto {
    @IsIn(['PHOTO', 'AUDIO']) kind: 'PHOTO' | 'AUDIO';
    @IsOptional() @IsString() @MaxLength(200) caption?: string;
}

class SignatureDto {
    @IsString() @MinLength(2) @MaxLength(120) signerName: string;
    @IsString() @MaxLength(700_000) image: string;
}

const publicFields = {
    id: true,
    kind: true,
    filename: true,
    mimeType: true,
    size: true,
    caption: true,
    uploadedBy: true,
    createdAt: true,
} as const;

@Controller()
@Roles('MANAGER', 'TECHNICIAN')
class AttachmentsController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
        private readonly activity: ActivityService,
        private readonly transcription: TranscriptionService,
    ) {}

    private async intervention(id: string) {
        const intervention = await this.prisma.intervention.findUnique({ where: { id } });
        if (!intervention) throw new NotFoundException('Intervention introuvable');
        assertInterventionAccess(currentUser(), intervention.technicianId);
        return intervention;
    }

    @Get('interventions/:id/attachments')
    async list(@Param('id') id: string) {
        await this.intervention(id);
        return this.prisma.attachment.findMany({ where: { interventionId: id }, orderBy: { createdAt: 'asc' }, select: publicFields });
    }

    /** Photo de chantier ou enregistrement audio du compte rendu. */
    @Post('interventions/:id/attachments')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD, files: 1 } }))
    async upload(@Param('id') id: string, @Body() dto: UploadDto, @UploadedFile() file?: Express.Multer.File) {
        const intervention = await this.intervention(id);
        if (LOCKED_STATUSES.includes(intervention.status)) throw new ConflictException('Intervention clôturée : ajout impossible');
        if (!file?.buffer.length) throw new BadRequestException('Fichier manquant');

        const type = detectFileType(file.buffer);
        const expected = dto.kind === 'PHOTO' ? 'image' : 'audio';
        if (type?.family !== expected) {
            throw new BadRequestException(dto.kind === 'PHOTO' ? 'Format accepté : JPEG, PNG, WebP ou HEIC' : 'Format audio non reconnu');
        }

        const key = await this.storage.put(file.buffer, type.extension);
        const attachment = await this.prisma.attachment.create({
            data: {
                interventionId: id,
                kind: dto.kind,
                filename: `${dto.kind === 'PHOTO' ? 'photo' : 'audio'}-${Date.now()}.${type.extension}`,
                mimeType: type.mimeType,
                size: file.buffer.length,
                storageKey: key,
                caption: dto.caption,
                uploadedBy: currentUser()?.name,
            },
            select: publicFields,
        });
        if (dto.kind === 'PHOTO') {
            await this.activity.log({ actor: 'TECHNICIAN', type: 'PHOTO_ADDED', message: `Photo ajoutée${dto.caption ? ` : ${dto.caption}` : ''}`, entityType: 'INTERVENTION', entityId: id });
        }
        return attachment;
    }

    /** Signature du client sur l'écran du technicien (PNG). */
    @Post('interventions/:id/signature')
    async sign(@Param('id') id: string, @Body() dto: SignatureDto) {
        const intervention = await this.intervention(id);
        if (!['IN_PROGRESS', 'COMPLETED'].includes(intervention.status)) {
            throw new ConflictException("La signature se recueille sur place, une fois l'intervention démarrée");
        }
        const png = decodePngDataUrl(dto.image);
        if (!png) throw new BadRequestException('Signature illisible');

        const key = await this.storage.put(png, 'png');
        await this.prisma.$transaction(async (tx) => {
            const previous = await tx.attachment.findMany({ where: { interventionId: id, kind: 'SIGNATURE' } });
            await tx.attachment.deleteMany({ where: { interventionId: id, kind: 'SIGNATURE' } });
            await tx.attachment.create({
                data: { interventionId: id, kind: 'SIGNATURE', filename: 'signature.png', mimeType: 'image/png', size: png.length, storageKey: key, uploadedBy: currentUser()?.name },
            });
            await tx.intervention.update({ where: { id }, data: { signedBy: dto.signerName, signedAt: new Date() } });
            await this.activity.log({ actor: 'TECHNICIAN', type: 'CLIENT_SIGNED', message: `Intervention signée par ${dto.signerName}`, entityType: 'INTERVENTION', entityId: id }, tx);
            await Promise.all(previous.map((p) => this.storage.remove(p.storageKey)));
        });
        return { signedBy: dto.signerName };
    }

    /** Enregistrement audio → texte (et conservation de l'audio). */
    @Post('interventions/:id/transcribe')
    @HttpCode(200)
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD, files: 1 } }))
    async transcribe(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
        await this.intervention(id);
        if (!file?.buffer.length) throw new BadRequestException('Enregistrement manquant');
        const type = detectFileType(file.buffer);
        if (type?.family !== 'audio') throw new BadRequestException('Format audio non reconnu');

        const text = await this.transcription.transcribe(file.buffer, type.mimeType, type.extension);
        const key = await this.storage.put(file.buffer, type.extension);
        await this.prisma.attachment.create({
            data: { interventionId: id, kind: 'AUDIO', filename: `note-vocale.${type.extension}`, mimeType: type.mimeType, size: file.buffer.length, storageKey: key, caption: 'Compte rendu vocal', uploadedBy: currentUser()?.name },
        });
        return { text };
    }

    @Get('attachments/:id/file')
    async file(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
        const attachment = await this.prisma.attachment.findUnique({ where: { id }, include: { intervention: true } });
        if (!attachment) throw new NotFoundException('Fichier introuvable');
        assertInterventionAccess(currentUser(), attachment.intervention.technicianId);
        const content = await this.storage.get(attachment.storageKey);
        res.set({
            'content-type': attachment.mimeType,
            'content-disposition': `inline; filename="${attachment.filename}"`,
            'cache-control': 'private, max-age=86400',
            'x-content-type-options': 'nosniff',
        });
        return new StreamableFile(content);
    }

    @Delete('attachments/:id')
    async remove(@Param('id') id: string) {
        const attachment = await this.prisma.attachment.findUnique({ where: { id }, include: { intervention: true } });
        if (!attachment) throw new NotFoundException('Fichier introuvable');
        assertInterventionAccess(currentUser(), attachment.intervention.technicianId);
        if (LOCKED_STATUSES.includes(attachment.intervention.status)) throw new ConflictException('Intervention clôturée : suppression impossible');
        await this.prisma.attachment.delete({ where: { id } });
        await this.storage.remove(attachment.storageKey);
        return { deleted: true };
    }

    /** Fonctions disponibles selon la configuration du serveur. */
    @Get('capabilities')
    capabilities() {
        return { transcription: this.transcription.enabled };
    }
}

@Module({
    controllers: [AttachmentsController],
    providers: [TranscriptionService],
})
export class AttachmentsModule {}
