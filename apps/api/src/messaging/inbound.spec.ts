import { normalizeInbound, parseAddress, stripQuotedReply } from './inbound.js';
import { toE164 } from './transports.js';

describe('normalizeInbound', () => {
    it('lit un webhook Postmark', () => {
        expect(
            normalizeInbound({
                FromFull: { Email: 'Contact@LeParisien.fr', Name: 'Marc Petit' },
                Subject: 'Clim en panne',
                TextBody: 'La clim ne refroidit plus.',
                MessageID: 'abc-123',
                Attachments: [{}, {}],
            }),
        ).toEqual({ fromName: 'Marc Petit', fromEmail: 'contact@leparisien.fr', subject: 'Clim en panne', text: 'La clim ne refroidit plus.', attachments: 2, externalId: 'abc-123' });
    });

    it('lit un webhook Mailgun', () => {
        const res = normalizeInbound({ from: 'Claire <gestion@sci-rivoli.fr>', subject: 'Devis', 'body-plain': 'Merci de chiffrer.', 'attachment-count': '3', 'Message-Id': '<m1@x>' });
        expect(res).toMatchObject({ fromName: 'Claire', fromEmail: 'gestion@sci-rivoli.fr', attachments: 3, externalId: '<m1@x>' });
    });

    it('lit le format générique et rejette un message vide', () => {
        expect(normalizeInbound({ from: 'julie@gmail.com', subject: 'Panne', text: 'Ma chaudière…' })).toMatchObject({ fromName: 'julie', fromEmail: 'julie@gmail.com' });
        expect(normalizeInbound({ from: 'julie@gmail.com', subject: 'Panne', text: '   ' })).toBeNull();
        expect(normalizeInbound({ from: 'pas-un-email', text: 'x' })).toBeNull();
    });
});

describe('utilitaires', () => {
    it('analyse une adresse', () => {
        expect(parseAddress('"Marc Petit" <Marc@X.fr>')).toEqual({ name: 'Marc Petit', email: 'marc@x.fr' });
    });

    it('retire l’historique cité', () => {
        expect(stripQuotedReply('Merci, c’est réparé.\n\nLe 2 oct. 2026, Fluxia a écrit :\n> Bonjour')).toBe('Merci, c’est réparé.');
    });

    it('formate un numéro en E.164', () => {
        expect(toE164('06 12 34 56 78')).toBe('+33612345678');
        expect(toE164('+44 20 7946 0958')).toBe('+442079460958');
    });
});
