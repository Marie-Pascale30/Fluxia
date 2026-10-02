'use client';

import { useRef } from 'react';
import { ingestRequest } from '@/app/actions';
import { useActionToast } from '@/components/ui/useActionToast';

// Exemples pour tester rapidement l'analyse IA
const EXAMPLES = [
    {
        label: 'Panne clim (client connu)',
        fromName: 'Marc Petit',
        fromEmail: 'contact@leparisien.fr',
        subject: 'Clim en panne à nouveau',
        body: "Bonjour,\nLa climatisation s'est de nouveau arrêtée ce midi, avec un code erreur E7 affiché sur la télécommande. La salle est pleine, c'est urgent.\nMarc",
    },
    {
        label: 'Demande de devis',
        fromName: 'Claire Rousseau',
        fromEmail: 'gestion@sci-rivoli.fr',
        subject: 'Chiffrage remplacement circulateur',
        body: "Bonjour,\nPouvez-vous nous chiffrer le remplacement du circulateur de la chaufferie de l'immeuble Rivoli ? Il est très bruyant.\nCordialement",
    },
    {
        label: 'Particulier inconnu',
        fromName: 'Julie Bernard',
        fromEmail: 'julie.bernard@gmail.com',
        subject: 'Chaudière qui ne chauffe plus',
        body: "Bonjour, ma chaudière ne chauffe plus depuis hier soir et affiche un voyant rouge. J'habite Paris 15e. Pouvez-vous passer ?",
    },
];

export function NewRequestForm() {
    const formRef = useRef<HTMLFormElement>(null);
    const { formAction, pending } = useActionToast(ingestRequest);

    const fill = (example: (typeof EXAMPLES)[number]) => {
        const form = formRef.current;
        if (!form) return;
        for (const key of ['fromName', 'fromEmail', 'subject', 'body'] as const) {
            (form.elements.namedItem(key) as HTMLInputElement).value = example[key];
        }
    };

    return (
        <>
            <div className="row-flex mb">
                <span className="muted">Exemples :</span>
                {EXAMPLES.map((ex) => (
                    <button key={ex.label} type="button" className="btn light sm" onClick={() => fill(ex)}>
                        {ex.label}
                    </button>
                ))}
            </div>
            <form ref={formRef} action={formAction} className="form">
                <div className="form-row">
                    <label>
                        Expéditeur
                        <input name="fromName" className="input" required minLength={2} />
                    </label>
                    <label>
                        Email
                        <input name="fromEmail" type="email" className="input" required />
                    </label>
                </div>
                <label>
                    Objet
                    <input name="subject" className="input" required minLength={3} />
                </label>
                <label>
                    Message
                    <textarea name="body" className="textarea" required minLength={10} rows={7} />
                </label>
                <div>
                    <button className="btn ai" disabled={pending}>
                        {pending ? 'Analyse en cours…' : '✨ Recevoir et analyser'}
                    </button>
                </div>
            </form>
        </>
    );
}
