import { BadRequestException, ConflictException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import type Stripe from 'stripe';
import { stripeClient } from '../billing/stripe.js';
import type { Organization } from '../generated/prisma/client.js';
import { asSystem, requireOrganizationId } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { verifyPassword } from '../auth/password.js';

export class DeleteOrganizationDto {
    /** Nom exact de l'entreprise, retapé pour confirmer */
    @IsString() @MinLength(1) confirmName: string;
    @IsString() @MinLength(1) password: string;
}

/**
 * Droits RGPD de l'entreprise cliente : portabilité (export complet) et effacement (suppression définitive).
 * Les fichiers déposés (photos, signatures, audio) sont listés dans l'export et supprimés avec l'entreprise.
 *
 * Factures : elles doivent être conservées 10 ans par l'entreprise qui les émet (C. com. L123-22).
 * Fluxia n'en garde pas de copie après la suppression (ce serait conserver des données personnelles de clients
 * sans finalité propre) : la suppression est donc refusée tant qu'un export complet, qui contient toutes les
 * factures, n'a pas été téléchargé après la dernière facture émise, payée ou annulée.
 */
@Injectable()
export class PrivacyService {
    private readonly logger = new Logger(PrivacyService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) {}

    /** Toutes les données de l'entreprise, lisibles et réutilisables (JSON). Aucun mot de passe ni secret. */
    async export() {
        const organizationId = requireOrganizationId();
        const p = this.prisma;
        const [organization, users, technicians, clients, catalog, requests, interventions, reports, quotes, invoices, attachments, activities, messages] =
            await Promise.all([
                p.organization.findUniqueOrThrow({ where: { id: organizationId } }),
                p.user.findMany({ select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, lastLoginAt: true, technicianId: true } }),
                p.technician.findMany(),
                p.client.findMany({ include: { sites: { include: { equipments: true } }, contracts: true } }),
                p.catalogItem.findMany(),
                p.inboundRequest.findMany(),
                p.intervention.findMany(),
                p.report.findMany(),
                p.quote.findMany({ include: { lines: { orderBy: { position: 'asc' } } } }),
                p.invoice.findMany({ include: { lines: { orderBy: { position: 'asc' } } } }),
                p.attachment.findMany(),
                p.activity.findMany({ orderBy: { createdAt: 'asc' } }),
                // Emails de sécurité adressés à un utilisateur (réinitialisation du mot de passe) : exclus
                p.outboundMessage.findMany({ where: { sensitive: false }, orderBy: { createdAt: 'asc' }, omit: { template: true, sensitive: true } }),
            ]);
        const { inboundToken: _secret, stripeCustomerId: _customer, stripeSubscriptionId: _subscription, stripeEventAt: _event, ...company } = organization;
        // Trace de l'export : condition de la suppression de l'entreprise (conservation des factures)
        await this.prisma.organization.update({ where: { id: organizationId }, data: { dataExportedAt: new Date() } });
        return {
            format: 'fluxia-export',
            version: 1,
            exportedAt: new Date().toISOString(),
            organization: company,
            users,
            technicians,
            clients,
            catalog,
            requests,
            interventions,
            reports,
            quotes,
            invoices,
            attachments,
            activities,
            messages,
        };
    }

    /** Suppression définitive de l'entreprise, de toutes ses données et de ses fichiers. */
    async deleteOrganization(userId: string, dto: DeleteOrganizationDto) {
        const organizationId = requireOrganizationId();
        const [organization, user] = await Promise.all([
            this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
            this.prisma.user.findUniqueOrThrow({ where: { id: userId } }),
        ]);
        if (dto.confirmName.trim() !== organization.name) throw new BadRequestException("Le nom saisi ne correspond pas au nom de l'entreprise");
        if (!(await verifyPassword(dto.password, user.passwordHash))) throw new BadRequestException('Mot de passe incorrect');
        await this.assertInvoicesExported(organization);

        // Abonnement résilié et client Stripe supprimé avant d'effacer l'entreprise (aucun prélèvement après suppression)
        await this.closeStripe(organization);

        const files = await this.prisma.attachment.findMany({ select: { storageKey: true } });
        // La suppression de l'entreprise emporte toutes ses données (clés étrangères en cascade)
        await asSystem(() => this.prisma.organization.delete({ where: { id: organizationId } }));
        for (const { storageKey } of files) await this.storage.remove(storageKey).catch(() => undefined);
        this.logger.warn(`Entreprise ${organizationId} supprimée à la demande de l'utilisateur ${userId} (${files.length} fichier(s))`);
    }

    /** Factures émises : un export postérieur à leur dernier changement est exigé avant la suppression. */
    private async assertInvoicesExported(organization: Organization) {
        const { _count, _max } = await this.prisma.invoice.aggregate({
            where: { number: { not: null } },
            _count: { _all: true },
            _max: { issuedAt: true, paidAt: true, cancelledAt: true },
        });
        if (!_count._all) return;
        const lastChange = Math.max(...[_max.issuedAt, _max.paidAt, _max.cancelledAt].map((d) => d?.getTime() ?? 0));
        if (!organization.dataExportedAt || organization.dataExportedAt.getTime() < lastChange) {
            throw new ConflictException(
                `Votre entreprise a émis ${_count._all} facture(s), à conserver 10 ans (article L123-22 du Code de commerce). ` +
                    "Téléchargez d'abord l'export complet des données (bouton « Exporter toutes les données »), puis recommencez la suppression.",
            );
        }
    }

    /**
     * Résilie l'abonnement Stripe et supprime le client Stripe (coordonnées de facturation).
     * Sans Stripe configuré (démo), rien à faire. Une erreur Stripe bloque la suppression : mieux vaut
     * réessayer que laisser un abonnement actif rattaché à une entreprise disparue.
     */
    private async closeStripe(organization: Organization) {
        if (!organization.stripeSubscriptionId && !organization.stripeCustomerId) return;
        const stripe = stripeClient();
        if (!stripe) {
            this.logger.warn(`Entreprise ${organization.id} : identifiants Stripe présents mais Stripe non configuré, résiliation impossible ici`);
            return;
        }
        const missing = (error: unknown) => (error as Stripe.errors.StripeError)?.code === 'resource_missing';
        try {
            if (organization.stripeSubscriptionId) {
                await stripe.subscriptions.cancel(organization.stripeSubscriptionId).catch((error) => {
                    if (!missing(error)) throw error;
                });
            }
            // Supprimer le client résilie aussi ses éventuels autres abonnements et efface ses moyens de paiement
            if (organization.stripeCustomerId) {
                await stripe.customers.del(organization.stripeCustomerId).catch((error) => {
                    if (!missing(error)) throw error;
                });
            }
        } catch (error) {
            this.logger.error(`Résiliation Stripe impossible (entreprise ${organization.id}) : ${(error as Error).message}`);
            throw new ServiceUnavailableException("La résiliation de l'abonnement auprès de Stripe a échoué : rien n'a été supprimé, réessayez dans quelques minutes.");
        }
    }
}
