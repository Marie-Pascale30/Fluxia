import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { Global, Injectable, Module, NotFoundException } from '@nestjs/common';

/**
 * Stockage des fichiers (photos, signatures, audio, PDF).
 * Local par défaut (UPLOAD_DIR) ; l'interface permet de brancher plus tard un stockage objet (S3…).
 * Les clés sont générées par le serveur : aucun chemin fourni par l'utilisateur n'atteint le disque.
 */
@Injectable()
export class StorageService {
    private readonly root = resolve(process.env.UPLOAD_DIR ?? 'storage');

    private path(key: string) {
        const full = resolve(this.root, key);
        if (!full.startsWith(this.root + sep)) throw new NotFoundException('Fichier introuvable');
        return full;
    }

    /** Enregistre le contenu et renvoie sa clé (ex. "2026/10/<uuid>.jpg"). */
    async put(content: Buffer, extension: string): Promise<string> {
        const now = new Date();
        const key = join(String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, '0'), `${randomUUID()}.${extension}`)
            .split(sep)
            .join('/');
        const file = this.path(key);
        await mkdir(dirname(file), { recursive: true });
        await writeFile(file, content);
        return key;
    }

    async get(key: string): Promise<Buffer> {
        try {
            return await readFile(this.path(key));
        } catch {
            throw new NotFoundException('Fichier introuvable');
        }
    }

    async remove(key: string) {
        await rm(this.path(key), { force: true });
    }
}

@Global()
@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
