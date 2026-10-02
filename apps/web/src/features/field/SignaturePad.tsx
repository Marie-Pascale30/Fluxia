'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { saveSignature } from '@/app/actions';
import { useToast } from '@/components/ui/Toast';

/** Signature du client au doigt (ou à la souris) sur l'écran du technicien. */
export function SignaturePad({ interventionId, defaultName }: { interventionId: string; defaultName?: string }) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const [empty, setEmpty] = useState(true);
    const [name, setName] = useState(defaultName ?? '');
    const [pending, startTransition] = useTransition();
    const toast = useToast();

    // Résolution adaptée à l'écran (traits nets sur mobile)
    useEffect(() => {
        const el = canvas.current!;
        const ratio = window.devicePixelRatio || 1;
        el.width = el.clientWidth * ratio;
        el.height = el.clientHeight * ratio;
        const ctx = el.getContext('2d')!;
        ctx.scale(ratio, ratio);
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#182235';
    }, []);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const ctx = e.currentTarget.getContext('2d')!;
        const { x, y } = point(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
        if (!drawing.current) return;
        const ctx = e.currentTarget.getContext('2d')!;
        const { x, y } = point(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        setEmpty(false);
    };

    const clear = () => {
        const el = canvas.current!;
        el.getContext('2d')!.clearRect(0, 0, el.width, el.height);
        setEmpty(true);
    };

    const save = () =>
        startTransition(async () => {
            const result = await saveSignature(interventionId, name.trim(), canvas.current!.toDataURL('image/png'));
            if (!result.ok) toast(result.message, 'error');
        });

    return (
        <div className="form">
            <canvas
                ref={canvas}
                className="signature-pad"
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={() => (drawing.current = false)}
                onPointerLeave={() => (drawing.current = false)}
                aria-label="Zone de signature"
            />
            <div className="row-flex">
                <input className="input" style={{ maxWidth: 260 }} placeholder="Nom du signataire" value={name} onChange={(e) => setName(e.target.value)} />
                <button type="button" className="btn light sm" onClick={clear} disabled={empty || pending}>
                    Effacer
                </button>
                <button type="button" className="btn green" onClick={save} disabled={empty || name.trim().length < 2 || pending}>
                    {pending ? 'Enregistrement…' : 'Valider la signature'}
                </button>
            </div>
        </div>
    );
}
