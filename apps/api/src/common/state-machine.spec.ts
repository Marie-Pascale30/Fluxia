import { ConflictException } from '@nestjs/common';
import { assertTransition, canTransition, INTERVENTION_TRANSITIONS, QUOTE_TRANSITIONS } from './state-machine.js';

describe('state machine', () => {
    it('autorise le parcours nominal d’une intervention', () => {
        const path = ['TO_SCHEDULE', 'SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED'] as const;
        for (let i = 0; i < path.length - 1; i++) {
            expect(canTransition(INTERVENTION_TRANSITIONS, path[i], path[i + 1])).toBe(true);
        }
    });

    it('refuse d’envoyer une mission non planifiée', () => {
        expect(() => assertTransition(INTERVENTION_TRANSITIONS, 'TO_SCHEDULE', 'DISPATCHED', 'Intervention')).toThrow(
            ConflictException,
        );
    });

    it('interdit l’envoi d’un devis non validé', () => {
        expect(canTransition(QUOTE_TRANSITIONS, 'DRAFT', 'SENT')).toBe(false);
        expect(canTransition(QUOTE_TRANSITIONS, 'VALIDATED', 'SENT')).toBe(true);
    });
});
