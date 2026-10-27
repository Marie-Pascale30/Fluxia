import { requestContext } from '../auth/auth.types.js';
import { Prisma } from '../generated/prisma/client.js';

// Cloisonnement des données entre entreprises (multi-entreprise).
//
// Toute requête Prisma sur une table métier est automatiquement restreinte à l'entreprise
// du contexte courant (utilisateur connecté, lien du portail, tâche planifiée…), et toute
// création y est rattachée. Sans contexte, l'accès est refusé : un oubli produit une erreur,
// jamais une fuite de données. Les traitements qui doivent voir toutes les entreprises
// (connexion, file d'envoi, tâches planifiées) le déclarent explicitement avec asSystem().

/** Tables portant une colonne organizationId (les lignes de devis et de facture suivent leur parent). */
const TENANT_MODELS = new Set<string>([
    'User',
    'Client',
    'Site',
    'Equipment',
    'Contract',
    'Technician',
    'CatalogItem',
    'InboundRequest',
    'Intervention',
    'Report',
    'Quote',
    'Attachment',
    'Invoice',
    'Activity',
    'OutboundMessage',
    'Counter',
]);

/** Créations imbriquées d'entités rattachées à l'entreprise (relation → modèle enfant). */
const NESTED_CREATES: Record<string, Record<string, string>> = {
    Client: { sites: 'Site', contracts: 'Contract' },
    Site: { equipments: 'Equipment' },
    Intervention: { report: 'Report' },
};

export class TenantContextError extends Error {}

/** Entreprise du contexte courant, ou null. */
export function currentOrganizationId(): string | null {
    return requestContext.getStore()?.organizationId ?? null;
}

/** Entreprise du contexte courant ; erreur si aucune (ex. traitement d'arrière-plan sans asOrganization). */
export function requireOrganizationId(): string {
    const organizationId = currentOrganizationId();
    if (!organizationId) throw new TenantContextError('Aucune entreprise dans le contexte courant');
    return organizationId;
}

// Les requêtes Prisma sont paresseuses : elles partent quand on attend leur résultat.
// D'où l'`await` à l'intérieur du contexte, sans lequel la requête s'exécuterait après en être sorti.

/** Exécute fn pour le compte d'une entreprise (portail, webhook, tâches planifiées…). */
export function asOrganization<T>(organizationId: string, fn: () => T | PromiseLike<T>): Promise<T> {
    const store = requestContext.getStore();
    return requestContext.run({ user: store?.user ?? null, organizationId, system: false }, async () => await fn());
}

/** Exécute fn sans cloisonnement : réservé aux traitements transverses, à justifier à chaque usage. */
export function asSystem<T>(fn: () => T | PromiseLike<T>): Promise<T> {
    const store = requestContext.getStore();
    return requestContext.run({ user: store?.user ?? null, organizationId: null, system: true }, async () => await fn());
}

type Data = Record<string, unknown>;

function stamp(model: string, data: unknown, organizationId: string): unknown {
    if (Array.isArray(data)) return data.map((item) => stamp(model, item, organizationId));
    const out: Data = { ...(data as Data), organizationId };
    for (const [field, child] of Object.entries(NESTED_CREATES[model] ?? {})) {
        const nested = out[field] as Data | undefined;
        if (nested?.create) out[field] = { ...nested, create: stamp(child, nested.create, organizationId) };
    }
    return out;
}

export const tenantExtension = Prisma.defineExtension({
    name: 'tenant',
    query: {
        $allModels: {
            $allOperations({ model, operation, args, query }) {
                if (!TENANT_MODELS.has(model)) return query(args);
                const store = requestContext.getStore();
                if (store?.system) return query(args);
                const organizationId = store?.organizationId;
                if (!organizationId) {
                    throw new TenantContextError(`Accès à ${model}.${operation} sans entreprise dans le contexte`);
                }

                const a = args as Data;
                switch (operation) {
                    case 'create':
                    case 'createMany':
                    case 'createManyAndReturn':
                        a.data = stamp(model, a.data, organizationId);
                        break;
                    case 'upsert':
                        a.where = { ...(a.where as Data), organizationId };
                        a.create = stamp(model, a.create, organizationId);
                        break;
                    default:
                        // find*, update*, delete*, count, aggregate, groupBy
                        a.where = { ...(a.where as Data | undefined), organizationId };
                }
                return query(a);
            },
        },
    },
});
