import { Logger } from '@nestjs/common';

let warned = false;

/**
 * Secret de l'application (signature des jetons de session et des liens du portail client).
 * Obligatoire en production ; une valeur de développement est utilisée sinon.
 */
export function appSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.length >= 32) return secret;
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET (32 caractères minimum) est obligatoire en production');
    if (!warned) {
        new Logger('Sécurité').warn('JWT_SECRET absent ou trop court : clé de développement utilisée');
        warned = true;
    }
    return 'fluxia-dev-secret-ne-pas-utiliser-en-production';
}
