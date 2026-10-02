'use client';

import { useState, useTransition } from 'react';
import { draftReply, sendReply } from '@/app/actions';
import { useToast } from '@/components/ui/Toast';
import { useActionToast } from '@/components/ui/useActionToast';
import { providerLabel } from '@/lib/format';
import type { ReplyDraft } from '@/lib/types';

/** L'IA rédige un brouillon fondé sur les faits établis ; le responsable relit, corrige et envoie. */
export function ReplyComposer({ requestId, recipient }: { requestId: string; recipient: string }) {
    const [draft, setDraft] = useState<ReplyDraft | null>(null);
    const [drafting, startDrafting] = useTransition();
    const toast = useToast();
    const { formAction, pending } = useActionToast(sendReply.bind(null, requestId), () => setDraft(null));

    const generate = () =>
        startDrafting(async () => {
            const result = await draftReply(requestId);
            if (result.ok && result.data) setDraft(result.data as ReplyDraft);
            else toast(result.message, 'error');
        });

    if (!draft) {
        return (
            <button type="button" className="btn ai" onClick={generate} disabled={drafting}>
                {drafting ? 'Rédaction…' : '✨ Rédiger une réponse'}
            </button>
        );
    }

    return (
        <form action={formAction} className="form" style={{ width: '100%' }}>
            <div className="muted small">
                Brouillon {providerLabel(draft.provider)} · destinataire {recipient}
                {draft.facts.length > 0 && ` · faits repris : ${draft.facts.join(' ; ')}`}
            </div>
            <label>
                Objet
                <input name="subject" className="input" defaultValue={draft.subject} required minLength={3} />
            </label>
            <label>
                Message
                <textarea name="body" className="textarea" rows={9} defaultValue={draft.body} required minLength={10} />
            </label>
            <div className="row-flex">
                <button className="btn green" disabled={pending}>
                    {pending ? 'Envoi…' : 'Envoyer la réponse'}
                </button>
                <button type="button" className="btn light" onClick={() => setDraft(null)}>
                    Annuler
                </button>
            </div>
        </form>
    );
}
