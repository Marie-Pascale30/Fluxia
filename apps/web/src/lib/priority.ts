import type { Priority } from './types';

const RANK: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

/** Rang numérique d'une priorité (une demande non analysée passe devant tout). */
export const PRIORITY_ORDER = (p: Priority | null) => (p ? RANK[p] : 4);
