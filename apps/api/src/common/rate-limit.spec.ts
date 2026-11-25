import { KeyedRateLimiter } from './rate-limit.js';

describe('limiteur de tentatives par clé', () => {
    it('bloque au-delà de la limite pendant la fenêtre, sans tenir compte de la casse', () => {
        const limiter = new KeyedRateLimiter(2, 60_000);
        limiter.consume('Julien@fluxia.fr', 0);
        limiter.consume('julien@fluxia.fr', 1);
        expect(() => limiter.consume('JULIEN@fluxia.fr', 2)).toThrow();
        expect(() => limiter.consume('autre@fluxia.fr', 2)).not.toThrow();
    });

    it('libère la clé après la fenêtre ou après une remise à zéro', () => {
        const limiter = new KeyedRateLimiter(1, 1000);
        limiter.consume('a@b.fr', 0);
        expect(() => limiter.check('a@b.fr', 500)).toThrow();
        expect(() => limiter.check('a@b.fr', 1500)).not.toThrow();
        limiter.record('a@b.fr', 1600);
        limiter.reset('a@b.fr');
        expect(() => limiter.check('a@b.fr', 1700)).not.toThrow();
    });
});
