// Données de démonstration — relatives à la date du jour.
// Lancer : npm run db:reset (efface et recrée la base).
import { hashPassword } from '../src/auth/password.js';
import { addDays, atTime, fromZoned, startOfDay, zonedParts } from '../src/common/dates.js';
import type { EquipmentType, InterventionType } from '../src/generated/prisma/client.js';
import { createPrismaClient } from '../src/prisma/prisma.service.js';

const prisma = createPrismaClient();

/** Mot de passe des comptes de démonstration (à changer en production). */
const DEMO_PASSWORD = 'fluxia-demo';

// Dates calculées dans le fuseau métier (APP_TIMEZONE)
const today = startOfDay(new Date());
const { year, month } = zonedParts(today);
const at = (dayOffset: number, h: number, m = 0) => atTime(addDays(today, dayOffset), h, m);
const plus = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
const daysAgo = (n: number) => at(-n, 10);

async function main() {
    // Nettoyage (ordre inverse des dépendances)
    await prisma.$transaction([
        prisma.outboundMessage.deleteMany(),
        prisma.activity.deleteMany(),
        prisma.quoteLine.deleteMany(),
        prisma.quote.deleteMany(),
        prisma.report.deleteMany(),
        prisma.intervention.deleteMany(),
        prisma.inboundRequest.deleteMany(),
        prisma.contract.deleteMany(),
        prisma.equipment.deleteMany(),
        prisma.site.deleteMany(),
        prisma.client.deleteMany(),
        prisma.user.deleteMany(),
        prisma.technician.deleteMany(),
        prisma.catalogItem.deleteMany(),
        prisma.counter.deleteMany(),
    ]);

    // ── Catalogue ────────────────────────────────────────────────
    await prisma.catalogItem.createMany({
        data: [
            { code: 'COND-CLIM', kind: 'PART', label: 'Condensateur de démarrage climatisation', unitPriceCents: 8600, keywords: ['condensateur'] },
            { code: 'FILT-CLIM', kind: 'PART', label: 'Filtre unité intérieure', unitPriceCents: 3500, keywords: ['filtre'] },
            { code: 'GAZ-R32', kind: 'PART', label: 'Recharge fluide R32 (kg)', unitPriceCents: 12000, keywords: ['r32', 'recharge de gaz', 'recharge gaz', 'fluide frigorigene'] },
            { code: 'MOT-VMC', kind: 'PART', label: 'Moteur de VMC simple flux', unitPriceCents: 42000, keywords: ['moteur vmc', 'moteur de vmc', 'moteur'] },
            { code: 'CIRC-CH', kind: 'PART', label: 'Circulateur chauffage', unitPriceCents: 31000, keywords: ['circulateur'] },
            { code: 'VASE-EXP', kind: 'PART', label: "Vase d'expansion 18 L", unitPriceCents: 9500, keywords: ["vase d'expansion", 'vase expansion'] },
            { code: 'SONDE-T', kind: 'PART', label: 'Sonde de température', unitPriceCents: 4500, keywords: ['sonde'] },
            { code: 'NETT-CLIM', kind: 'OTHER', label: 'Nettoyage complet unité extérieure', unitPriceCents: 15000, keywords: ['nettoyage complet'] },
            { code: 'MO-H', kind: 'LABOR', label: "Main d'œuvre technicien (heure)", unitPriceCents: 7500, keywords: [] },
            { code: 'DEPL', kind: 'TRAVEL', label: 'Forfait déplacement Paris', unitPriceCents: 4500, keywords: [] },
        ],
    });

    // ── Techniciens ──────────────────────────────────────────────
    const thomas = await prisma.technician.create({
        data: { firstName: 'Thomas', lastName: 'Martin', email: 'thomas.martin@fluxia.fr', phone: '06 12 34 56 78', skills: ['CLIMATISATION', 'VMC'], baseLat: 48.8698, baseLng: 2.3522 },
    });
    const marc = await prisma.technician.create({
        data: { firstName: 'Marc', lastName: 'Lefèvre', email: 'marc.lefevre@fluxia.fr', phone: '06 23 45 67 89', skills: ['CHAUFFAGE', 'PLOMBERIE'], baseLat: 48.8352, baseLng: 2.3219 },
    });
    const sophie = await prisma.technician.create({
        data: { firstName: 'Sophie', lastName: 'Dubois', email: 'sophie.dubois@fluxia.fr', phone: '06 34 56 78 90', skills: ['CLIMATISATION', 'CHAUFFAGE', 'VMC'], baseLat: 48.8925, baseLng: 2.2386 },
    });

    // ── Comptes (mot de passe de démo commun) ────────────────────
    const passwordHash = await hashPassword(DEMO_PASSWORD);
    await prisma.user.create({ data: { email: 'julien@fluxia.fr', name: 'Julien Durand', role: 'MANAGER', passwordHash } });
    for (const t of [thomas, marc, sophie]) {
        await prisma.user.create({
            data: { email: t.email, name: `${t.firstName} ${t.lastName}`, role: 'TECHNICIAN', technicianId: t.id, passwordHash },
        });
    }

    // ── Clients, sites, équipements, contrats ────────────────────
    const parisien = await prisma.client.create({
        data: {
            name: 'Restaurant Le Parisien',
            email: 'contact@leparisien.fr',
            phone: '01 42 00 00 01',
            contactName: 'Marc Petit',
            sites: {
                create: {
                    label: 'Restaurant',
                    address: '18 rue de Rivoli',
                    postalCode: '75004',
                    city: 'Paris',
                    lat: 48.8559,
                    lng: 2.3589,
                    equipments: {
                        create: [
                            { type: 'CLIMATISATION', label: 'Climatisation — unité extérieure', brand: 'Daikin', model: 'RZAG71', installedAt: fromZoned(2021, 4, 1) },
                            { type: 'VMC', label: 'VMC cuisine', brand: 'Aldes' },
                            { type: 'CHAUFFAGE', label: 'Chaudière gaz', brand: 'Viessmann' },
                        ],
                    },
                },
            },
            contracts: {
                create: {
                    reference: 'MAINT-CVC-2026-014',
                    label: 'Maintenance CVC — main d’œuvre et déplacement inclus',
                    startDate: fromZoned(year, 1, 1),
                    endDate: fromZoned(year, 12, 31, 23, 59),
                    coversLabor: true,
                    coversParts: false,
                    coversTravel: true,
                },
            },
        },
        include: { sites: { include: { equipments: true } } },
    });

    const rivoli = await prisma.client.create({
        data: {
            name: 'SCI Rivoli',
            email: 'gestion@sci-rivoli.fr',
            contactName: 'Claire Rousseau',
            sites: {
                create: [
                    {
                        label: 'Immeuble Rivoli',
                        address: '42 rue de Rivoli',
                        postalCode: '75001',
                        city: 'Paris',
                        lat: 48.8606,
                        lng: 2.3417,
                        equipments: {
                            create: [
                                { type: 'VMC', label: 'VMC collective — caisson toiture' },
                                { type: 'CHAUFFAGE', label: 'Chaufferie collective' },
                                { type: 'CLIMATISATION', label: 'Climatisation hall' },
                            ],
                        },
                    },
                    {
                        label: 'Immeuble Sébastopol',
                        address: '12 boulevard de Sébastopol',
                        postalCode: '75004',
                        city: 'Paris',
                        lat: 48.8594,
                        lng: 2.3497,
                        equipments: { create: [{ type: 'VMC', label: 'VMC parties communes' }] },
                    },
                ],
            },
            contracts: {
                create: {
                    reference: 'MAINT-IMM-2025-007',
                    label: 'Maintenance préventive immeubles',
                    startDate: fromZoned(year - 1, 7, 1),
                    endDate: fromZoned(year + 1, 6, 30, 23, 59),
                    coversLabor: false,
                    coversParts: false,
                    coversTravel: true,
                },
            },
        },
        include: { sites: { include: { equipments: true } } },
    });

    const morel = await prisma.client.create({
        data: {
            name: 'Cabinet Morel',
            email: 'accueil@cabinet-morel.fr',
            contactName: 'Dr Morel',
            sites: {
                create: {
                    label: 'Cabinet médical',
                    address: '5 rue Oberkampf',
                    postalCode: '75011',
                    city: 'Paris',
                    lat: 48.8649,
                    lng: 2.3718,
                    equipments: { create: [{ type: 'CLIMATISATION', label: 'Climatisation réversible', brand: 'Mitsubishi' }] },
                },
            },
            contracts: {
                create: {
                    reference: 'ENT-2025-031',
                    label: 'Entretien annuel climatisation',
                    startDate: fromZoned(year - 1, month, 15),
                    endDate: fromZoned(year, month + 1, 14, 23, 59),
                    coversLabor: true,
                    coversParts: false,
                    coversTravel: true,
                    nextServiceDate: at(10, 9),
                    serviceIntervalMonths: 12,
                },
            },
        },
        include: { sites: true },
    });

    const others = await Promise.all(
        [
            { name: 'SCI Atlas', email: 'contact@sci-atlas.fr', address: '8 avenue de l’Opéra', postalCode: '75001', lat: 48.8651, lng: 2.3346, type: 'CHAUFFAGE', label: 'Chaudière collective' },
            { name: 'Résidence Opéra', email: 'syndic@residence-opera.fr', address: '3 rue Auber', postalCode: '75009', lat: 48.8718, lng: 2.3303, type: 'CHAUFFAGE', label: 'Chaufferie' },
            { name: 'École Victor Hugo', email: 'direction@ecole-victorhugo.fr', address: '27 rue de Turenne', postalCode: '75003', lat: 48.8594, lng: 2.3646, type: 'VMC', label: 'VMC double flux' },
            { name: 'Boulangerie ABC', email: 'contact@boulangerie-abc.fr', address: '61 rue Montmartre', postalCode: '75002', lat: 48.8667, lng: 2.3446, type: 'CLIMATISATION', label: 'Climatisation boutique' },
        ].map((c) =>
            prisma.client.create({
                data: {
                    name: c.name,
                    email: c.email,
                    sites: {
                        create: {
                            label: 'Site principal',
                            address: c.address,
                            postalCode: c.postalCode,
                            city: 'Paris',
                            lat: c.lat,
                            lng: c.lng,
                            equipments: { create: [{ type: c.type as EquipmentType, label: c.label }] },
                        },
                    },
                },
                include: { sites: { include: { equipments: true } } },
            }),
        ),
    );
    const [atlas, opera, ecole, abc] = others;

    // ── Historique : interventions passées chez Le Parisien ──────
    const parisienSite = parisien.sites[0];
    const parisienClim = parisienSite.equipments.find((e) => e.type === 'CLIMATISATION')!;
    let number = 4570;

    for (const [ago, title, diagnosis] of [
        [180, 'Entretien annuel climatisation', 'Filtres encrassés.'],
        [60, 'Climatisation — perte de puissance', 'Manque de fluide frigorigène.'],
    ] as const) {
        const start = daysAgo(ago);
        await prisma.intervention.create({
            data: {
                number: number++,
                type: 'MAINTENANCE',
                status: 'CLOSED',
                title,
                description: title,
                clientId: parisien.id,
                siteId: parisienSite.id,
                equipmentId: parisienClim.id,
                technicianId: thomas.id,
                scheduledStart: start,
                scheduledEnd: plus(start, 90),
                dispatchedAt: start,
                startedAt: start,
                completedAt: plus(start, 90),
                closedAt: plus(start, 120),
                report: {
                    create: {
                        status: 'SENT',
                        voiceNote: diagnosis,
                        reason: title,
                        diagnosis,
                        workDone: 'Nettoyage et contrôle complet.',
                        result: 'Équipement opérationnel.',
                        laborHours: 1.5,
                        aiProvider: 'heuristic',
                        sentAt: plus(start, 120),
                    },
                },
            },
        });
    }

    // ── Planning du jour ─────────────────────────────────────────
    const planned: [typeof thomas, (typeof others)[number], number, number, number, InterventionType, string][] = [
        [thomas, abc, 9, 0, 90, 'MAINTENANCE', 'Entretien climatisation'],
        [marc, atlas, 9, 0, 120, 'BREAKDOWN', 'Chaudière en sécurité'],
        [marc, atlas, 11, 30, 60, 'AFTER_SALES', 'Contrôle pression circuit'],
        [marc, opera, 14, 0, 120, 'AFTER_SALES', 'SAV chaufferie'],
        [marc, opera, 16, 15, 90, 'MAINTENANCE', 'Désembouage réseau'],
        [sophie, ecole, 9, 0, 120, 'MAINTENANCE', 'Maintenance VMC double flux'],
    ];
    for (const [tech, client, h, m, duration, type, title] of planned) {
        const start = at(0, h, m);
        await prisma.intervention.create({
            data: {
                number: number++,
                type,
                status: 'DISPATCHED',
                title,
                description: title,
                clientId: client.id,
                siteId: client.sites[0].id,
                equipmentId: client.sites[0].equipments[0].id,
                technicianId: tech.id,
                scheduledStart: start,
                scheduledEnd: plus(start, duration),
                estimatedMinutes: duration,
                dispatchedAt: at(-1, 17),
            },
        });
    }
    // Sophie : entretien SCI Rivoli l'après-midi
    const rivoliSite = rivoli.sites[0];
    await prisma.intervention.create({
        data: {
            number: number++,
            type: 'MAINTENANCE',
            status: 'DISPATCHED',
            title: 'Entretien VMC collective',
            description: 'Visite préventive semestrielle',
            clientId: rivoli.id,
            siteId: rivoliSite.id,
            equipmentId: rivoliSite.equipments[0].id,
            technicianId: sophie.id,
            scheduledStart: at(0, 13, 30),
            scheduledEnd: at(0, 16, 0),
            estimatedMinutes: 150,
            dispatchedAt: at(-1, 17),
        },
    });

    // ── Demandes entrantes ───────────────────────────────────────
    await prisma.inboundRequest.create({
        data: {
            fromName: 'Marc Petit',
            fromEmail: 'contact@leparisien.fr',
            subject: 'Urgent — climatisation en panne',
            body: "Bonjour,\n\nLa climatisation du restaurant ne refroidit plus depuis ce matin. Elle fait également un bruit assez inhabituel au niveau du groupe extérieur. Nous avons du monde ce midi et aurions besoin d'une intervention rapidement.\n\nMerci,\nMarc — Restaurant Le Parisien",
            receivedAt: at(0, 8, 42),
            status: 'ANALYZED',
            category: 'BREAKDOWN',
            priority: 'URGENT',
            summary: 'Panne signalée — absence de froid + bruit inhabituel — intervention rapide demandée.',
            symptoms: ['Absence de froid', 'Bruit inhabituel'],
            suggestedAction: 'CREATE_INTERVENTION',
            confidence: 0.92,
            aiProvider: 'heuristic',
            analyzedAt: at(0, 8, 42),
            clientId: parisien.id,
            siteId: parisienSite.id,
            equipmentId: parisienClim.id,
        },
    });

    await prisma.inboundRequest.create({
        data: {
            fromName: 'Claire Rousseau',
            fromEmail: 'gestion@sci-rivoli.fr',
            subject: 'Demande de devis — remplacement moteur VMC',
            body: "Bonjour,\n\nSuite au dernier passage, votre technicien nous a signalé que le moteur de la VMC collective (caisson toiture) était en fin de vie. Pourriez-vous nous faire parvenir un devis pour son remplacement ? Vous trouverez 3 photos en pièces jointes.\n\nCordialement,\nClaire Rousseau — SCI Rivoli",
            receivedAt: at(0, 8, 17),
            attachments: 3,
            status: 'ANALYZED',
            category: 'QUOTE_REQUEST',
            priority: 'NORMAL',
            summary: 'Demande de chiffrage — remplacement du moteur de VMC collective.',
            symptoms: [],
            suggestedAction: 'PREPARE_QUOTE',
            confidence: 0.88,
            aiProvider: 'heuristic',
            analyzedAt: at(0, 8, 17),
            clientId: rivoli.id,
            siteId: rivoliSite.id,
            equipmentId: rivoliSite.equipments[0].id,
        },
    });

    await prisma.inboundRequest.create({
        data: {
            fromName: 'Cabinet Morel',
            fromEmail: 'accueil@cabinet-morel.fr',
            subject: 'Entretien annuel de la climatisation',
            body: "Bonjour,\n\nNotre contrat d'entretien arrive à échéance le mois prochain. Pouvez-vous nous proposer une date pour la visite annuelle de la climatisation ?\n\nBien à vous,\nL'accueil du Cabinet Morel",
            receivedAt: at(-1, 16, 5),
            status: 'ANALYZED',
            category: 'MAINTENANCE',
            priority: 'NORMAL',
            summary: 'Demande d’entretien annuel — échéance du contrat le mois prochain.',
            symptoms: [],
            suggestedAction: 'SCHEDULE_MAINTENANCE',
            confidence: 0.85,
            aiProvider: 'heuristic',
            analyzedAt: at(-1, 16, 5),
            clientId: morel.id,
            siteId: morel.sites[0].id,
        },
    });

    // Une demande non encore analysée : permet de tester l'analyse IA
    await prisma.inboundRequest.create({
        data: {
            fromName: 'Syndic Résidence Opéra',
            fromEmail: 'syndic@residence-opera.fr',
            subject: 'Fuite sur la chaufferie',
            body: "Bonjour, le gardien a constaté une fuite d'eau sous la chaudière de la chaufferie ce matin, le chauffage fonctionne encore. Merci de passer dès que possible.",
            receivedAt: at(0, 9, 5),
            status: 'NEW',
        },
    });

    // Prochain numéro d'intervention : 4581 (les numéros < 4581 sont l'historique de démo)
    await prisma.counter.create({ data: { key: 'intervention', value: 4580 } });

    await prisma.activity.create({
        data: { actor: 'SYSTEM', type: 'SEED', message: 'Données de démonstration chargées', entityType: 'SYSTEM', entityId: 'seed' },
    });

    console.log(`Seed terminé : ${await prisma.client.count()} clients, ${await prisma.intervention.count()} interventions, ${await prisma.inboundRequest.count()} demandes.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
