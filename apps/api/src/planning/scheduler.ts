// Moteur de planification — fonctions pures, sans accès base de données.
import { addMinutes, atTime, formatDateFr, formatTimeFr, overlaps, startOfDay } from '../common/dates.js';
import { WORKDAY, type EquipmentType, type Priority } from '../common/domain.js';
import { distanceKm, estimateTravelMinutes } from '../common/geo.js';

/** Marge minimale entre deux interventions (trajet, imprévus). */
export const BUFFER_MINUTES = 15;

export interface TimeRange {
    start: Date;
    end: Date;
}

export interface CandidateTechnician {
    id: string;
    name: string;
    skills: string[];
    baseLat: number;
    baseLng: number;
    busy: TimeRange[];
    /** Interventions passées de ce technicien sur le même site */
    siteHistory: number;
    /** Interventions passées de ce technicien sur le même équipement */
    equipmentHistory: number;
}

export interface RecommendationContext {
    equipmentType: EquipmentType | null;
    site: { lat: number; lng: number };
    durationMinutes: number;
    priority: Priority;
    now: Date;
    /** Premier jour de recherche (défaut : aujourd'hui) */
    fromDay?: Date;
}

export interface Reason {
    label: string;
    detail: string;
    positive: boolean;
}

export interface Recommendation {
    technicianId: string;
    technicianName: string;
    score: number;
    slot: TimeRange | null;
    distanceKm: number;
    travelMinutes: number;
    skillMatch: boolean;
    reasons: Reason[];
}

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Jours ouvrés à explorer selon l'urgence. */
export function searchDays(from: Date, priority: Priority): Date[] {
    const count = priority === 'URGENT' ? 2 : priority === 'HIGH' ? 3 : 5;
    const days: Date[] = [];
    const cursor = startOfDay(from);
    while (days.length < count) {
        if (!isWeekend(cursor)) days.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }
    return days;
}

/** Vérifie qu'un créneau ne chevauche aucune occupation (marge incluse). */
export function isFree(slot: TimeRange, busy: TimeRange[]): boolean {
    return !busy.some((b) =>
        overlaps(slot.start, slot.end, addMinutes(b.start, -BUFFER_MINUTES), addMinutes(b.end, BUFFER_MINUTES)),
    );
}

/** Premier créneau libre d'une journée, à partir de `notBefore`, sur un pas de 30 min. */
export function firstFreeSlot(day: Date, busy: TimeRange[], durationMinutes: number, notBefore: Date): TimeRange | null {
    const step = WORKDAY.slotStepMinutes;
    const dayEnd = atTime(day, WORKDAY.endHour);
    let cursor = atTime(day, WORKDAY.startHour);

    if (notBefore > cursor) {
        const minutes = Math.ceil((notBefore.getTime() - cursor.getTime()) / 60_000 / step) * step;
        cursor = addMinutes(cursor, minutes);
    }

    for (; addMinutes(cursor, durationMinutes) <= dayEnd; cursor = addMinutes(cursor, step)) {
        const slot = { start: cursor, end: addMinutes(cursor, durationMinutes) };
        if (isFree(slot, busy)) return slot;
    }
    return null;
}

const EQUIPMENT_LABEL: Record<EquipmentType, string> = {
    CLIMATISATION: 'Climatisation / froid',
    CHAUFFAGE: 'Chauffage',
    VMC: 'Ventilation',
    PLOMBERIE: 'Plomberie',
    ELECTRICITE: 'Électricité',
};

function describeSlot(slot: TimeRange, now: Date): string {
    const sameDay = startOfDay(slot.start).getTime() === startOfDay(now).getTime();
    return sameDay ? `${formatTimeFr(slot.start)} aujourd'hui` : `${formatDateFr(slot.start)} à ${formatTimeFr(slot.start)}`;
}

/**
 * Classe les techniciens pour une intervention.
 * Barème (sur 100) : compétence 35 · disponibilité 30 · proximité 20 · historique 15.
 */
export function recommendTechnicians(ctx: RecommendationContext, candidates: CandidateTechnician[]): Recommendation[] {
    const days = searchDays(ctx.fromDay ?? ctx.now, ctx.priority);
    // Fenêtre au-delà de laquelle un créneau ne rapporte plus de points de disponibilité
    const horizonHours = ctx.priority === 'URGENT' ? 8 : ctx.priority === 'HIGH' ? 24 : 72;

    const results = candidates.map((tech): Recommendation => {
        const reasons: Reason[] = [];
        let score = 0;

        // Compétence
        const skillMatch = !ctx.equipmentType || tech.skills.includes(ctx.equipmentType);
        if (ctx.equipmentType) {
            if (skillMatch) {
                score += 35;
                reasons.push({ label: 'Compétence', detail: EQUIPMENT_LABEL[ctx.equipmentType], positive: true });
            } else {
                reasons.push({ label: 'Compétence', detail: `Pas habilité ${EQUIPMENT_LABEL[ctx.equipmentType].toLowerCase()}`, positive: false });
            }
        } else {
            score += 20;
        }

        // Trajet
        const km = distanceKm({ lat: tech.baseLat, lng: tech.baseLng }, ctx.site);
        const travelMinutes = estimateTravelMinutes(km);
        score += 20 * Math.max(0, 1 - km / 40);
        reasons.push({
            label: 'Trajet',
            detail: `${km.toFixed(1).replace('.', ',')} km · ~${travelMinutes} min`,
            positive: km < 20,
        });

        // Disponibilité : premier créneau compatible (temps de trajet compris le jour même)
        let slot: TimeRange | null = null;
        for (const day of days) {
            const notBefore = startOfDay(day).getTime() === startOfDay(ctx.now).getTime()
                ? addMinutes(ctx.now, travelMinutes)
                : atTime(day, WORKDAY.startHour);
            slot = firstFreeSlot(day, tech.busy, ctx.durationMinutes, notBefore);
            if (slot) break;
        }
        if (slot) {
            const delayHours = Math.max(0, (slot.start.getTime() - ctx.now.getTime()) / 3_600_000);
            score += 30 * Math.max(0, 1 - delayHours / horizonHours);
            const inTime = delayHours <= horizonHours;
            reasons.push({
                label: 'Disponibilité',
                detail: inTime ? describeSlot(slot, ctx.now) : `${describeSlot(slot, ctx.now)} (au-delà du délai souhaité)`,
                positive: inTime,
            });
        } else {
            reasons.push({ label: 'Disponibilité', detail: `Aucun créneau sur ${days.length} jours ouvrés`, positive: false });
        }

        // Historique
        const history = tech.equipmentHistory * 2 + tech.siteHistory;
        score += Math.min(15, history * 5);
        if (tech.equipmentHistory > 0) {
            reasons.push({ label: 'Historique', detail: 'Déjà intervenu sur cet équipement', positive: true });
        } else if (tech.siteHistory > 0) {
            reasons.push({ label: 'Historique', detail: `${tech.siteHistory} intervention(s) sur ce site`, positive: true });
        }

        return {
            technicianId: tech.id,
            technicianName: tech.name,
            score: Math.round(slot ? score : score / 3),
            slot,
            distanceKm: Math.round(km * 10) / 10,
            travelMinutes,
            skillMatch,
            reasons,
        };
    });

    // Priorité aux techniciens compétents et disponibles, puis au score
    return results.sort(
        (a, b) => Number(b.skillMatch) - Number(a.skillMatch) || Number(!!b.slot) - Number(!!a.slot) || b.score - a.score,
    );
}
