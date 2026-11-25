import { createHmac, timingSafeEqual } from 'node:crypto';
import { appSecret } from '../common/secrets.js';

// Lien du portail client : <charge>.<signature>, sans stockage en base.
// La charge contient l'identifiant du client, la version de ses liens et la date d'émission :
// incrémenter Client.portalVersion invalide d'un coup tous les liens émis, et un lien expire
// après PORTAL_LINK_DAYS jours (90 par défaut). Les liens sont recalculés à chaque envoi d'email.

const b64url = (buf: Buffer) => buf.toString('base64url');
const sign = (payload: string) => b64url(createHmac('sha256', `${appSecret()}:portal`).update(payload).digest()).slice(0, 32);

/** Durée de validité d'un lien du portail, en jours. */
export const portalLinkDays = () => {
    const days = Number(process.env.PORTAL_LINK_DAYS);
    return Number.isFinite(days) && days > 0 ? days : 90;
};

export function createPortalToken(clientId: string, version: number, now = Date.now()): string {
    const issuedAt = Math.floor(now / 1000);
    const payload = b64url(Buffer.from(`${clientId}.${version}.${issuedAt}`));
    return `${payload}.${sign(payload)}`;
}

export function readPortalToken(token: string, now = Date.now()): { clientId: string; version: number } | null {
    const [payload, signature, extra] = token.split('.');
    if (!payload || !signature || extra !== undefined) return null;
    const expected = Buffer.from(sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

    const [clientId, version, issuedAt] = Buffer.from(payload, 'base64url').toString().split('.');
    const v = Number(version);
    const issued = Number(issuedAt);
    // Les anciens liens sans date d'émission ne sont plus acceptés (ils n'expiraient jamais)
    if (!clientId || !Number.isInteger(v) || !Number.isInteger(issued)) return null;
    const age = now - issued * 1000;
    if (age < -5 * 60_000 || age > portalLinkDays() * 86_400_000) return null;
    return { clientId, version: v };
}
