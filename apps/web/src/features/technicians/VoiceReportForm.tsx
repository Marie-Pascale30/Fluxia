'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { submitVoiceReport } from '@/app/actions';
import { useActionToast } from '@/components/ui/useActionToast';

// API Web Speech (Chrome, Edge, Safari) — non typée dans lib.dom
type Recognition = {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>; resultIndex: number }) => void) | null;
    onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | undefined {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

function createRecognition(): Recognition | null {
    const Ctor = recognitionCtor();
    return Ctor ? new Ctor() : null;
}

const noopSubscribe = () => () => {};
const hasRecognition = () => recognitionCtor() !== undefined;

const EXAMPLE =
    "J'ai trouvé le condensateur défectueux. Je l'ai remplacé, vérifié la pression et redémarré le groupe. Tout fonctionne normalement. Je recommande un nettoyage complet au prochain passage.";

/** Compte rendu du technicien, tapé ou dicté ; l'IA en tire le rapport. */
export function VoiceReportForm({ interventionId }: { interventionId: string }) {
    const { formAction, pending } = useActionToast(submitVoiceReport.bind(null, interventionId));
    const [note, setNote] = useState('');
    const [listening, setListening] = useState(false);
    // Dictée disponible uniquement dans les navigateurs compatibles (false au rendu serveur)
    const supported = useSyncExternalStore(noopSubscribe, hasRecognition, () => false);
    const recognition = useRef<Recognition | null>(null);

    useEffect(() => () => recognition.current?.stop(), []);

    const toggleDictation = () => {
        if (listening) {
            recognition.current?.stop();
            return;
        }
        const rec = createRecognition();
        if (!rec) return;
        rec.lang = 'fr-FR';
        rec.continuous = true;
        rec.interimResults = false;
        rec.onresult = (e) => {
            let text = '';
            for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
            if (text) setNote((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${text.trim()}.`);
        };
        rec.onend = () => setListening(false);
        recognition.current = rec;
        rec.start();
        setListening(true);
    };

    return (
        <form action={formAction} className="form">
            <textarea
                name="voiceNote"
                className="textarea"
                rows={6}
                required
                minLength={15}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Décrivez ce que vous avez constaté, les travaux réalisés, les pièces remplacées et vos recommandations…"
            />
            <div className="row-flex">
                <button className="btn ai" disabled={pending || note.trim().length < 15}>
                    {pending ? 'Rédaction du rapport…' : '✨ Générer le rapport'}
                </button>
                {supported && (
                    <button type="button" className={`btn ${listening ? 'danger' : 'light'}`} onClick={toggleDictation}>
                        {listening ? '■ Arrêter la dictée' : '🎙 Dicter'}
                    </button>
                )}
                {!note && (
                    <button type="button" className="btn light sm" onClick={() => setNote(EXAMPLE)}>
                        Exemple
                    </button>
                )}
            </div>
        </form>
    );
}
