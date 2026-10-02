'use client';

import { useState, useTransition } from 'react';
import { portalDecision } from '@/app/portal-actions';

/** Acceptation ou refus d'un devis par le client, avec son nom (valeur d'accord). */
export function QuoteDecision({ token, quoteId, defaultName }: { token: string; quoteId: string; defaultName: string }) {
    const [name, setName] = useState(defaultName);
    const [agree, setAgree] = useState(false);
    const [refusing, setRefusing] = useState(false);
    const [note, setNote] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const decide = (accept: boolean) =>
        startTransition(async () => {
            setError(null);
            const result = await portalDecision(token, quoteId, accept, name.trim(), note.trim());
            if (result.ok) setDone(result.message);
            else setError(result.message);
        });

    if (done) return <div className="notice success">{done}</div>;

    return (
        <div className="form mt">
            <label>
                Votre nom
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </label>
            {refusing ? (
                <>
                    <label>
                        Motif (facultatif)
                        <textarea className="textarea" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                    </label>
                    <div className="row-flex">
                        <button type="button" className="btn danger" onClick={() => decide(false)} disabled={pending || name.trim().length < 2}>
                            Confirmer le refus
                        </button>
                        <button type="button" className="btn light" onClick={() => setRefusing(false)}>
                            Retour
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <label className="check">
                        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> J&apos;accepte ce devis et
                        ses conditions (bon pour accord)
                    </label>
                    <div className="row-flex">
                        <button type="button" className="btn green" onClick={() => decide(true)} disabled={pending || !agree || name.trim().length < 2}>
                            {pending ? 'Envoi…' : 'Accepter le devis'}
                        </button>
                        <button type="button" className="btn light" onClick={() => setRefusing(true)} disabled={pending}>
                            Refuser
                        </button>
                    </div>
                </>
            )}
            {error && <div className="form-error">{error}</div>}
        </div>
    );
}
