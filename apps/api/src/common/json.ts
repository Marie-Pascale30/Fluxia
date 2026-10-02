// Les colonnes JSON sont stockées en texte (compatibilité SQLite).

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}

export const toJson = (value: unknown): string => JSON.stringify(value);
