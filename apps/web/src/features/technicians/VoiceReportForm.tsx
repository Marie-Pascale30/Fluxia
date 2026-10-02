'use client';

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { submitVoiceReport, transcribeAudio } from '@/app/actions';
import { useToast } from '@/components/ui/Toast';
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

const hasRecorder = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const append = (prev: string, text: string) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${text.trim()}`;

/**
 * Compte rendu du technicien, tapé ou dicté ; l'IA en tire le rapport.
 * Dictée : reconnaissance vocale du navigateur, ou enregistrement transcrit par le serveur
 * (`serverTranscription`), qui fonctionne sur tous les navigateurs.
 */
export function VoiceReportForm({ interventionId, serverTranscription = false }: { interventionId: string; serverTranscription?: boolean }) {
    const draftKey = `fluxia:note:${interventionId}`;
    const { formAction, pending } = useActionToast(submitVoiceReport.bind(null, interventionId), () => {
        try {
            localStorage.removeItem(draftKey);
        } catch {
            // stockage indisponible
        }
    });
    const [note, setNoteState] = useState('');
    const restored = useRef(false);

    // Brouillon conservé sur l'appareil : rien n'est perdu en cas de coupure ou de rechargement
    useEffect(() => {
        if (restored.current) return;
        restored.current = true;
        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) queueMicrotask(() => setNoteState(saved));
        } catch {
            // stockage indisponible
        }
    }, [draftKey]);

    const setNote = (value: string | ((prev: string) => string)) =>
        setNoteState((prev) => {
            const next = typeof value === 'function' ? value(prev) : value;
            try {
                if (next) localStorage.setItem(draftKey, next);
                else localStorage.removeItem(draftKey);
            } catch {
                // stockage indisponible
            }
            return next;
        });
    const [listening, setListening] = useState(false);
    // Dictée disponible uniquement dans les navigateurs compatibles (false au rendu serveur)
    const supported = useSyncExternalStore(noopSubscribe, hasRecognition, () => false);
    const canRecord = useSyncExternalStore(noopSubscribe, hasRecorder, () => false) && serverTranscription;
    const recognition = useRef<Recognition | null>(null);
    const recorder = useRef<MediaRecorder | null>(null);
    const [recording, setRecording] = useState(false);
    const [transcribing, startTranscribing] = useTransition();
    const toast = useToast();

    useEffect(
        () => () => {
            recognition.current?.stop();
            recorder.current?.stream.getTracks().forEach((t) => t.stop());
        },
        [],
    );

    const toggleRecording = async () => {
        if (recording) {
            recorder.current?.stop();
            return;
        }
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            toast("Accès au micro refusé : autorisez-le dans les réglages du navigateur", 'error');
            return;
        }
        const rec = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        rec.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            setRecording(false);
            const audio = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
            startTranscribing(async () => {
                const form = new FormData();
                form.append('file', audio, 'note-vocale');
                const result = await transcribeAudio(interventionId, form);
                if (result.ok) setNote((prev) => append(prev, (result.data as { text: string }).text));
                else toast(result.message, 'error');
            });
        };
        recorder.current = rec;
        rec.start();
        setRecording(true);
    };

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
            if (text) setNote((prev) => `${append(prev, text)}.`);
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
                {supported && !canRecord && (
                    <button type="button" className={`btn ${listening ? 'danger' : 'light'}`} onClick={toggleDictation}>
                        {listening ? '■ Arrêter la dictée' : '🎙 Dicter'}
                    </button>
                )}
                {canRecord && (
                    <button type="button" className={`btn ${recording ? 'danger' : 'light'}`} onClick={toggleRecording} disabled={transcribing}>
                        {transcribing ? 'Transcription…' : recording ? '■ Terminer l’enregistrement' : '🎙 Enregistrer'}
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
