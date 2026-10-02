'use client';

import { useState } from 'react';
import { updateRequest } from '@/app/actions';
import { useActionToast } from '@/components/ui/useActionToast';
import { CATEGORY, EQUIPMENT, PRIORITY } from '@/lib/format';
import type { ClientSummary, InboundRequestDetail } from '@/lib/types';

/** Correction humaine de l'analyse : l'IA propose, le responsable ajuste. */
export function CorrectionForm({ request, clients }: { request: InboundRequestDetail; clients: ClientSummary[] }) {
    const { formAction, pending } = useActionToast(updateRequest.bind(null, request.id));
    const [clientId, setClientId] = useState(request.clientId ?? '');
    const [siteId, setSiteId] = useState(request.siteId ?? '');

    // Sites/équipements connus uniquement pour le client actuellement rattaché
    const sameClient = clientId === request.clientId;
    const sites = sameClient ? (request.client?.sites ?? []) : [];
    const equipments = sites.find((s) => s.id === siteId)?.equipments ?? [];

    return (
        <form action={formAction} className="form">
            <div className="form-row">
                <label>
                    Catégorie
                    <select name="category" className="select" defaultValue={request.category ?? ''}>
                        {Object.entries(CATEGORY).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Priorité
                    <select name="priority" className="select" defaultValue={request.priority ?? 'NORMAL'}>
                        {Object.entries(PRIORITY).map(([k, v]) => (
                            <option key={k} value={k}>
                                {v.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <label>
                Client
                <select name="clientId" className="select" value={clientId} onChange={(e) => { setClientId(e.target.value); setSiteId(''); }}>
                    <option value="">— Non identifié —</option>
                    {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                            {c.name}
                        </option>
                    ))}
                </select>
            </label>
            {sameClient && sites.length > 0 && (
                <div className="form-row">
                    <label>
                        Site
                        <select name="siteId" className="select" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
                            <option value="">—</option>
                            {sites.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.label} — {s.address}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Équipement
                        <select name="equipmentId" className="select" defaultValue={request.equipmentId ?? ''} key={siteId}>
                            <option value="">—</option>
                            {equipments.map((e) => (
                                <option key={e.id} value={e.id}>
                                    {e.label} ({EQUIPMENT[e.type]})
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            )}
            {!sameClient && clientId && <div className="muted small">Enregistrez pour choisir ensuite le site et l&apos;équipement.</div>}
            <div>
                <button className="btn light" disabled={pending}>
                    {pending ? 'Enregistrement…' : 'Enregistrer la correction'}
                </button>
            </div>
        </form>
    );
}
