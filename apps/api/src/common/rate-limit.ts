import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Limiteur de tentatives par clé (ex. adresse email), en mémoire.
 *
 * Toutes les requêtes arrivent de l'application web (Server Actions) : l'adresse IP vue par l'API
 * est celle du serveur web, pas celle de l'internaute. La limite par IP de ThrottlerGuard ne sert donc
 * que de plafond global, et la protection contre le forçage d'un compte repose sur cette limite par email.
 * Mémoire locale : suffisant pour une instance unique (démo) ; plusieurs instances → stockage partagé (Redis).
 */
export class KeyedRateLimiter {
    private readonly hits = new Map<string, number[]>();

    constructor(
        private readonly limit: number,
        private readonly windowMs: number,
        private readonly message = 'Trop de tentatives, réessayez plus tard.',
    ) {}

    private recent(key: string, now: number) {
        const kept = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
        if (kept.length) this.hits.set(key, kept);
        else this.hits.delete(key);
        return kept;
    }

    /** Lève une erreur 429 si la clé a atteint sa limite, sans compter de nouvelle tentative. */
    check(key: string, now = Date.now()) {
        if (this.recent(normalize(key), now).length >= this.limit) throw new HttpException(this.message, HttpStatus.TOO_MANY_REQUESTS);
    }

    /** Compte une tentative. */
    record(key: string, now = Date.now()) {
        const k = normalize(key);
        this.hits.set(k, [...this.recent(k, now), now]);
        if (this.hits.size > 10_000) this.prune(now);
    }

    /** Vérifie puis compte une tentative. */
    consume(key: string, now = Date.now()) {
        this.check(key, now);
        this.record(key, now);
    }

    /** Oublie les tentatives d'une clé (ex. connexion réussie). */
    reset(key: string) {
        this.hits.delete(normalize(key));
    }

    private prune(now: number) {
        for (const key of this.hits.keys()) this.recent(key, now);
    }
}

const normalize = (key: string) => key.toLowerCase().trim();

const env = (name: string, fallback: number) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
};

/** Échecs de connexion par email : 10 par quart d'heure (LOGIN_EMAIL_RATE_LIMIT). */
export const loginLimiter = () => new KeyedRateLimiter(env('LOGIN_EMAIL_RATE_LIMIT', 10), 15 * 60_000);
/** Demandes de réinitialisation par email : 3 par heure. */
export const passwordResetLimiter = () => new KeyedRateLimiter(env('RESET_EMAIL_RATE_LIMIT', 3), 60 * 60_000);
/** Inscriptions par email : 5 par heure (limite l'énumération des comptes existants). */
export const signupLimiter = () => new KeyedRateLimiter(env('SIGNUP_EMAIL_RATE_LIMIT', 5), 60 * 60_000);
