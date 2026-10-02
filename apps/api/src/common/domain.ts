// Vocabulaire métier partagé par tous les modules.
// SQLite n'ayant pas d'enums, ces listes font foi et sont validées dans les DTO.

export const EQUIPMENT_TYPES = ['CLIMATISATION', 'CHAUFFAGE', 'VMC', 'PLOMBERIE', 'ELECTRICITE'] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];

export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const REQUEST_CHANNELS = ['EMAIL', 'PHONE', 'FORM'] as const;
export type RequestChannel = (typeof REQUEST_CHANNELS)[number];

export const REQUEST_STATUSES = ['NEW', 'ANALYZED', 'CONVERTED', 'ARCHIVED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const REQUEST_CATEGORIES = ['BREAKDOWN', 'QUOTE_REQUEST', 'MAINTENANCE', 'OTHER'] as const;
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const SUGGESTED_ACTIONS = ['CREATE_INTERVENTION', 'PREPARE_QUOTE', 'SCHEDULE_MAINTENANCE', 'REPLY'] as const;
export type SuggestedAction = (typeof SUGGESTED_ACTIONS)[number];

export const INTERVENTION_TYPES = ['BREAKDOWN', 'MAINTENANCE', 'INSTALLATION', 'AFTER_SALES'] as const;
export type InterventionType = (typeof INTERVENTION_TYPES)[number];

export const INTERVENTION_STATUSES = [
    'TO_SCHEDULE', // créée, en attente de planification
    'SCHEDULED', // technicien + créneau affectés
    'DISPATCHED', // mission envoyée au technicien
    'IN_PROGRESS', // technicien sur place
    'COMPLETED', // compte rendu soumis, rapport en brouillon
    'CLOSED', // rapport envoyé au client
    'CANCELLED',
] as const;
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

// Statuts qui occupent le planning d'un technicien
export const PLANNED_STATUSES: InterventionStatus[] = ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'];

export const REPORT_STATUSES = ['DRAFT', 'VALIDATED', 'SENT'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const QUOTE_STATUSES = ['DRAFT', 'VALIDATED', 'SENT', 'ACCEPTED', 'REFUSED'] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export const QUOTE_LINE_KINDS = ['PART', 'LABOR', 'TRAVEL', 'OTHER'] as const;
export type QuoteLineKind = (typeof QUOTE_LINE_KINDS)[number];

export const ACTIVITY_ACTORS = ['AI', 'USER', 'TECHNICIAN', 'SYSTEM'] as const;
export type ActivityActor = (typeof ACTIVITY_ACTORS)[number];

export const PRIORITY_RANK: Record<Priority, number> = { LOW: 0, NORMAL: 1, HIGH: 2, URGENT: 3 };

// Horaires de travail utilisés par le moteur de planification
export const WORKDAY = { startHour: 8, endHour: 18, slotStepMinutes: 30 } as const;

export const LABOR_CATALOG_CODE = 'MO-H';
export const TRAVEL_CATALOG_CODE = 'DEPL';
