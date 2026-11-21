import {
    BadRequestException,
    Controller,
    Get,
    Headers,
    HttpCode,
    Injectable,
    Logger,
    Module,
    NotFoundException,
    Post,
    Req,
    ServiceUnavailableException,
    type RawBodyRequest,
} from '@nestjs/common';
import type { Request } from 'express';
import Stripe from 'stripe';
import { ActivityService } from '../activity/activity.service.js';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser, Public, SubscriptionExempt } from '../auth/decorators.js';
import { asOrganization, requireOrganizationId } from '../common/tenant.js';
import type { Organization } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { canWrite, mapStripeStatus, trialDaysLeft } from './subscription.js';

const WEB_URL = () => (process.env.PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const STATUS_LABEL: Record<Organization['subscriptionStatus'], string> = {
    TRIALING: 'essai',
    ACTIVE: 'actif',
    PAST_DUE: 'paiement en retard',
    CANCELED: 'résilié',
};

/**
 * Abonnement des entreprises à Fluxia, géré par Stripe :
 * Checkout pour souscrire, portail client pour gérer (carte, factures, résiliation),
 * webhook signé pour synchroniser le statut. Variables : STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_WEBHOOK_SECRET.
 */
@Injectable()
export class BillingService {
    private readonly logger = new Logger(BillingService.name);
    private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_non_configure');

    constructor(
        private readonly prisma: PrismaService,
        private readonly activity: ActivityService,
    ) {}

    get configured() {
        return !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_PRICE_ID;
    }

    private current() {
        return this.prisma.organization.findUniqueOrThrow({ where: { id: requireOrganizationId() } });
    }

    async status() {
        const org = await this.current();
        return {
            status: org.subscriptionStatus,
            trialEndsAt: org.trialEndsAt,
            trialDaysLeft: trialDaysLeft(org),
            currentPeriodEnd: org.currentPeriodEnd,
            canWrite: canWrite(org),
            hasCustomer: !!org.stripeCustomerId,
            configured: this.configured,
        };
    }

    private assertConfigured() {
        if (!this.configured) throw new ServiceUnavailableException("Le paiement en ligne n'est pas encore configuré sur cette plateforme");
    }

    /** Page de paiement Stripe pour souscrire l'abonnement. */
    async checkout(user: AuthUser) {
        this.assertConfigured();
        const org = await this.current();
        let customer = org.stripeCustomerId;
        if (!customer) {
            const created = await this.stripe.customers.create({
                name: org.name,
                email: org.email || user.email,
                metadata: { organizationId: org.id },
            });
            customer = created.id;
            await this.prisma.organization.update({ where: { id: org.id }, data: { stripeCustomerId: customer } });
        }
        const session = await this.stripe.checkout.sessions.create({
            mode: 'subscription',
            customer,
            client_reference_id: org.id,
            line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
            subscription_data: { metadata: { organizationId: org.id } },
            allow_promotion_codes: true,
            billing_address_collection: 'required',
            tax_id_collection: { enabled: true },
            customer_update: { name: 'auto', address: 'auto' },
            locale: 'fr',
            success_url: `${WEB_URL()}/abonnement?succes=1`,
            cancel_url: `${WEB_URL()}/abonnement`,
        });
        return { url: session.url! };
    }

    /** Portail client Stripe : moyen de paiement, factures, résiliation. */
    async portal() {
        this.assertConfigured();
        const org = await this.current();
        if (!org.stripeCustomerId) throw new BadRequestException("Aucun abonnement à gérer : souscrivez d'abord");
        const session = await this.stripe.billingPortal.sessions.create({ customer: org.stripeCustomerId, locale: 'fr', return_url: `${WEB_URL()}/abonnement` });
        return { url: session.url };
    }

    /** Événement Stripe signé : met à jour l'abonnement de l'entreprise concernée. */
    async webhook(payload: Buffer | undefined, signature: string | undefined) {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret) throw new NotFoundException();
        let event: Stripe.Event;
        try {
            event = this.stripe.webhooks.constructEvent(payload ?? Buffer.alloc(0), signature ?? '', secret);
        } catch {
            throw new BadRequestException('Signature Stripe invalide');
        }

        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const id = session.client_reference_id ?? undefined;
                if (!id) break;
                await this.apply(event, { id }, {
                    stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
                    stripeSubscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
                    ...(session.payment_status === 'paid' ? { subscriptionStatus: 'ACTIVE' as const } : {}),
                });
                break;
            }
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
                const status = event.type === 'customer.subscription.deleted' ? 'CANCELED' : mapStripeStatus(subscription.status);
                const periodEnd = subscription.items?.data?.[0]?.current_period_end;
                await this.apply(event, subscription.metadata?.organizationId ? { id: subscription.metadata.organizationId } : { stripeCustomerId: customer }, {
                    stripeCustomerId: customer,
                    stripeSubscriptionId: subscription.id,
                    ...(status ? { subscriptionStatus: status } : {}),
                    ...(periodEnd ? { currentPeriodEnd: new Date(periodEnd * 1000) } : {}),
                });
                break;
            }
            default:
                break;
        }
        return { received: true };
    }

    private async apply(event: Stripe.Event, where: { id: string } | { stripeCustomerId: string }, data: Partial<Organization>) {
        const org = await this.prisma.organization.findUnique({ where });
        if (!org) {
            this.logger.warn(`Événement Stripe ${event.id} (${event.type}) : entreprise introuvable`);
            return;
        }
        const at = new Date(event.created * 1000);
        // Les événements peuvent arriver dans le désordre : un événement plus ancien que le dernier appliqué est ignoré
        if (org.stripeEventAt && at < org.stripeEventAt) return;
        const updated = await this.prisma.organization.update({ where: { id: org.id }, data: { ...data, stripeEventAt: at } });
        if (updated.subscriptionStatus !== org.subscriptionStatus) {
            await asOrganization(org.id, () =>
                this.activity.log({
                    actor: 'SYSTEM',
                    type: 'SUBSCRIPTION_CHANGED',
                    message: `Abonnement : ${STATUS_LABEL[org.subscriptionStatus]} → ${STATUS_LABEL[updated.subscriptionStatus]}`,
                    entityType: 'ORGANIZATION',
                    entityId: org.id,
                }),
            );
        }
    }
}

@SubscriptionExempt()
@Controller('billing')
class BillingController {
    constructor(private readonly billing: BillingService) {}

    @Get()
    status() {
        return this.billing.status();
    }

    @Post('checkout')
    @HttpCode(200)
    checkout(@CurrentUser() user: AuthUser) {
        return this.billing.checkout(user);
    }

    @Post('portal')
    @HttpCode(200)
    portal() {
        return this.billing.portal();
    }

    @Public()
    @Post('webhook')
    @HttpCode(200)
    webhook(@Req() request: RawBodyRequest<Request>, @Headers('stripe-signature') signature?: string) {
        return this.billing.webhook(request.rawBody, signature);
    }
}

@Module({
    controllers: [BillingController],
    providers: [BillingService],
})
export class BillingModule {}
