import { cleanSubject } from '../requests/requests.service.js';
import { HeuristicProvider } from './heuristic.provider.js';

const ai = new HeuristicProvider();
const catalog = [
    { code: 'COND-CLIM', label: 'Condensateur', kind: 'PART' as const, keywords: ['condensateur'] },
    { code: 'MOT-VMC', label: 'Moteur VMC', kind: 'PART' as const, keywords: ['moteur vmc', 'moteur'] },
];

describe('HeuristicProvider.analyzeRequest', () => {
    it('qualifie une panne urgente de climatisation', async () => {
        const res = await ai.analyzeRequest({
            fromName: 'Marc',
            fromEmail: 'contact@leparisien.fr',
            subject: 'Urgent — climatisation en panne',
            body: 'La clim ne refroidit plus et fait un bruit bizarre. Pouvez-vous intervenir rapidement ?',
        });
        expect(res).toMatchObject({ category: 'BREAKDOWN', priority: 'URGENT', equipmentType: 'CLIMATISATION', suggestedAction: 'CREATE_INTERVENTION' });
        expect(res.symptoms).toEqual(['Absence de froid', 'Bruit inhabituel']);
    });

    it('reconnaît une demande de devis', async () => {
        const res = await ai.analyzeRequest({ fromName: 'C', fromEmail: 'c@x.fr', subject: 'Devis moteur VMC', body: 'Merci de chiffrer le remplacement du moteur.' });
        expect(res.category).toBe('QUOTE_REQUEST');
        expect(res.suggestedAction).toBe('PREPARE_QUOTE');
    });
});

describe('HeuristicProvider.draftReport', () => {
    it('structure le compte rendu et détecte la pièce remplacée', async () => {
        const res = await ai.draftReport({
            interventionTitle: 'Panne clim',
            problem: 'Ne refroidit plus',
            equipmentLabel: null,
            catalog,
            voiceNote:
                "J'ai trouvé le condensateur défectueux. Je l'ai remplacé, vérifié la pression et redémarré le groupe. Tout fonctionne normalement. Je recommande un nettoyage complet au prochain passage.",
        });
        expect(res.parts).toEqual([{ label: 'Condensateur', catalogCode: 'COND-CLIM', quantity: 1 }]);
        expect(res.result).toBe('Équipement opérationnel.');
        expect(res.recommendation).toMatch(/^Prévoir un nettoyage/);
        expect(res.laborHours).toBe(1);
    });

    it('ne facture pas une pièce simplement contrôlée', async () => {
        const res = await ai.draftReport({
            interventionTitle: 'Contrôle',
            problem: 'Contrôle',
            equipmentLabel: null,
            catalog,
            voiceNote: 'Condensateur contrôlé, en bon état. Intervention de 45 minutes.',
        });
        expect(res.parts).toEqual([]);
        expect(res.laborHours).toBe(1);
    });
});

describe('cleanSubject', () => {
    it('retire préfixes de réponse et mentions d’urgence', () => {
        expect(cleanSubject('RE: Urgent — climatisation en panne')).toBe('Climatisation en panne');
    });
});
