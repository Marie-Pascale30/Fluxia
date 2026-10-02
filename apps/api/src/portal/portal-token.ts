import { createHmac, timingSafeEqual } from 'node:crypto';
import { appSecret } from '../common/secrets.js';

// Lien du portail client : <charge>.<signature>, sans stockage en base.
// La charge contient l'identifiant du client et la version de ses liens ;
// incrémenter Client.portalVersion invalide d'un coup tous les liens émis.

const b64url = (buf: Buffer) => buf.toString('base64url');
const sign = (payload: string) => b64url(createHmac('sha256', `${appSecret()}:portal`).update(payload).digest()).slice(0, 32);

export function createPortalToken(clientId: string, version: number): string {
    const payload = b64url(Buffer.from(`${clientId}.${version}`));
    return `${payload}.${sign(payload)}`;
}

export function readPortalToken(token: string): { clientId: string; version: number } | null {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

    const [clientId, version] = Buffer.from(payload, 'base64url').toString().split('.');
    const v = Number(version);
    return clientId && Number.isInteger(v) ? { clientId, version: v } : null;
}
