import { notFound } from 'next/navigation';
import { ApiError } from './api';

/** Transforme un 404 de l'API en page "introuvable" Next.js. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
    try {
        return await promise;
    } catch (error) {
        if (error instanceof ApiError && error.status === 404) notFound();
        throw error;
    }
}
