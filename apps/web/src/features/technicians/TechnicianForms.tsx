'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { createTechnician, resetTechnicianPassword, setTechnicianActive, updateTechnician } from '@/app/actions';
import { useToast } from '@/components/ui/Toast';
import { useActionToast } from '@/components/ui/useActionToast';
import { Notice } from '@/components/ui';
import type { Technician } from '@/lib/types';

/** Mot de passe provisoire : affiché une seule fois, à transmettre au technicien. */
function PasswordReveal({ email, password }: { email?: string; password: string }) {
    return (
        <Notice tone="success" title="Accès créé — à transmettre au technicien">
            {email && <>Identifiant : <b>{email}</b><br /></>}
            Mot de passe provisoire : <span className="password-reveal">{password}</span>
            <div className="muted small mt">Il ne sera plus affiché ensuite.</div>
        </Notice>
    );
}

export function CreateTechnicianForm({ fields }: { fields: ReactNode }) {
    const [reveal, setReveal] = useState<{ email: string; temporaryPassword: string } | null>(null);
    const { formAction, pending } = useActionToast(createTechnician, (result) => {
        setReveal(result.data as { email: string; temporaryPassword: string });
    });

    return (
        <>
            {reveal && <PasswordReveal email={reveal.email} password={reveal.temporaryPassword} />}
            <form action={formAction} className="form" key={reveal?.temporaryPassword}>
                {fields}
                <div>
                    <button className="btn" disabled={pending}>
                        {pending ? 'Création…' : 'Créer le technicien et son accès'}
                    </button>
                </div>
            </form>
        </>
    );
}

export function EditTechnicianForm({ technician, fields }: { technician: Technician; fields: ReactNode }) {
    const { formAction, pending } = useActionToast(updateTechnician.bind(null, technician.id));
    return (
        <form action={formAction} className="form">
            {fields}
            <div>
                <button className="btn light" disabled={pending}>
                    {pending ? 'Enregistrement…' : 'Enregistrer'}
                </button>
            </div>
        </form>
    );
}

export function TechnicianAccountActions({ technician }: { technician: Technician }) {
    const toast = useToast();
    const [pending, startTransition] = useTransition();
    const [password, setPassword] = useState<string | null>(null);

    const toggle = () => {
        const next = !technician.active;
        if (!next && !window.confirm(`Désactiver ${technician.firstName} ? Son accès sera coupé immédiatement.`)) return;
        startTransition(async () => {
            const result = await setTechnicianActive(technician.id, next);
            if (!result.ok) toast(result.message, 'error');
        });
    };

    const reset = () => {
        if (!window.confirm(`Générer un nouveau mot de passe pour ${technician.firstName} ?`)) return;
        startTransition(async () => {
            const result = await resetTechnicianPassword(technician.id);
            if (!result.ok) toast(result.message, 'error');
            if (result.ok) setPassword((result.data as { temporaryPassword: string }).temporaryPassword);
        });
    };

    return (
        <>
            {password && <PasswordReveal email={technician.email} password={password} />}
            <div className="row-flex">
                {technician.active && (
                    <button type="button" className="btn light sm" onClick={reset} disabled={pending}>
                        Réinitialiser le mot de passe
                    </button>
                )}
                <button type="button" className={`btn sm ${technician.active ? 'danger' : 'green'}`} onClick={toggle} disabled={pending}>
                    {technician.active ? 'Désactiver' : 'Réactiver'}
                </button>
            </div>
        </>
    );
}
