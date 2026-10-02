'use client';

import { useRef, useState, useTransition } from 'react';
import { uploadPhotos } from '@/app/actions';
import { useToast } from '@/components/ui/Toast';

const MAX_SIDE = 1600;

/** Réduit une photo (≤ 1600 px, JPEG) avant l'envoi : rapide même en 4G. */
async function compress(file: File): Promise<File> {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82));
        return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
    } catch {
        return file; // format non décodable par le navigateur (ex. HEIC) : envoyé tel quel
    }
}

export function PhotoUploader({ interventionId }: { interventionId: string }) {
    const input = useRef<HTMLInputElement>(null);
    const [caption, setCaption] = useState('');
    const [pending, startTransition] = useTransition();
    const toast = useToast();

    const send = (files: FileList | null) => {
        if (!files?.length) return;
        startTransition(async () => {
            const form = new FormData();
            for (const file of Array.from(files)) form.append('files', await compress(file));
            if (caption.trim()) form.append('caption', caption.trim());
            const result = await uploadPhotos(interventionId, form);
            if (!result.ok) toast(result.message, 'error');
            else setCaption('');
            if (input.current) input.current.value = '';
        });
    };

    return (
        <div className="row-flex">
            <input
                className="input"
                style={{ maxWidth: 260 }}
                placeholder="Légende (facultatif)"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
            />
            <label className={`btn light ${pending ? 'disabled' : ''}`} aria-disabled={pending}>
                {pending ? 'Envoi…' : '📷 Ajouter des photos'}
                <input
                    ref={input}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    hidden
                    disabled={pending}
                    onChange={(e) => send(e.target.files)}
                />
            </label>
        </div>
    );
}
