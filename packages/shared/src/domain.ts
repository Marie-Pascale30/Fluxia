// Vocabulaire métier commun à l'API et au web (doit rester aligné sur les enums Prisma).

export const EQUIPMENT_TYPES = ['CLIMATISATION', 'CHAUFFAGE', 'VMC', 'PLOMBERIE', 'ELECTRICITE'] as const;
export const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export const REQUEST_CHANNELS = ['EMAIL', 'PHONE', 'FORM'] as const;
export const REQUEST_STATUSES = ['NEW', 'ANALYZED', 'CONVERTED', 'ANSWERED', 'ARCHIVED'] as const;
export const REQUEST_CATEGORIES = ['BREAKDOWN', 'QUOTE_REQUEST', 'MAINTENANCE', 'OTHER'] as const;
export const SUGGESTED_ACTIONS = ['CREATE_INTERVENTION', 'PREPARE_QUOTE', 'SCHEDULE_MAINTENANCE', 'REPLY'] as const;
export const INTERVENTION_TYPES = ['BREAKDOWN', 'MAINTENANCE', 'INSTALLATION', 'AFTER_SALES'] as const;
export const INTERVENTION_STATUSES = [
    'TO_SCHEDULE',
    'SCHEDULED',
    'DISPATCHED',
    'IN_PROGRESS',
    'COMPLETED',
    'CLOSED',
    'CANCELLED',
] as const;
export const REPORT_STATUSES = ['DRAFT', 'VALIDATED', 'SENT'] as const;
export const QUOTE_STATUSES = ['DRAFT', 'VALIDATED', 'SENT', 'ACCEPTED', 'REFUSED'] as const;
export const QUOTE_LINE_KINDS = ['PART', 'LABOR', 'TRAVEL', 'OTHER'] as const;
export const ACTIVITY_ACTORS = ['AI', 'USER', 'TECHNICIAN', 'SYSTEM'] as const;
export const MESSAGE_CHANNELS = ['EMAIL', 'SMS', 'PUSH'] as const;
export const MESSAGE_STATUSES = ['PENDING', 'SENT', 'FAILED'] as const;
export const ATTACHMENT_KINDS = ['PHOTO', 'SIGNATURE', 'AUDIO'] as const;

export type EquipmentType = (typeof EQUIPMENT_TYPES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type RequestChannel = (typeof REQUEST_CHANNELS)[number];
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];
export type SuggestedAction = (typeof SUGGESTED_ACTIONS)[number];
export type InterventionType = (typeof INTERVENTION_TYPES)[number];
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export type QuoteLineKind = (typeof QUOTE_LINE_KINDS)[number];
export type Actor = (typeof ACTIVITY_ACTORS)[number];
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];
