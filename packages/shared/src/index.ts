import type { z } from 'zod';
import * as C from './contract.js';

export * from './domain.js';
/** Schémas Zod du contrat d'API (utilisés pour valider les réponses). */
export * as schemas from './contract.js';

// Types dérivés des schémas : source unique de vérité pour le web
export type Equipment = z.infer<typeof C.Equipment>;
export type Site = z.infer<typeof C.Site>;
export type SiteWithEquipments = z.infer<typeof C.SiteWithEquipments>;
export type Contract = z.infer<typeof C.Contract>;
export type Client = z.infer<typeof C.Client>;
export type ClientSummary = z.infer<typeof C.ClientSummary>;
export type ClientDetail = z.infer<typeof C.ClientDetail>;
export type Coverage = z.infer<typeof C.Coverage>;
export type Technician = z.infer<typeof C.Technician>;
export type TechnicianWithLoad = z.infer<typeof C.TechnicianWithLoad>;
export type TechnicianDetail = z.infer<typeof C.TechnicianDetail>;
export type CatalogItem = z.infer<typeof C.CatalogItem>;
export type Activity = z.infer<typeof C.Activity>;
export type OutboundMessage = z.infer<typeof C.OutboundMessage>;
export type Intervention = z.infer<typeof C.Intervention>;
export type InterventionDetail = z.infer<typeof C.InterventionDetail>;
export type Mission = z.infer<typeof C.Mission>;
export type Reason = z.infer<typeof C.Reason>;
export type Recommendation = z.infer<typeof C.Recommendation>;
export type PlanningDay = z.infer<typeof C.PlanningDay>;
export type InboundRequest = z.infer<typeof C.InboundRequest>;
export type InboundRequestDetail = z.infer<typeof C.InboundRequestDetail>;
export type ReportPart = z.infer<typeof C.ReportPart>;
export type Report = z.infer<typeof C.Report>;
export type ReportDetail = z.infer<typeof C.ReportDetail>;
export type ReportSummary = z.infer<typeof C.ReportSummary>;
export type BillableLine = z.infer<typeof C.BillableLine>;
export type QuoteLine = z.infer<typeof C.QuoteLine>;
export type Quote = z.infer<typeof C.Quote>;
export type QuoteDetail = z.infer<typeof C.QuoteDetail>;
export type Dashboard = z.infer<typeof C.Dashboard>;
export type ReplyDraft = z.infer<typeof C.ReplyDraft>;
export type MessageLog = z.infer<typeof C.MessageLog>;
