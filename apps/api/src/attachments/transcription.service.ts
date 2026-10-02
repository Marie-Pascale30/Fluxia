import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

/**
 * Transcription audio côté serveur, pour les navigateurs sans dictée vocale.
 * Compatible avec l'API « audio/transcriptions » au format OpenAI, proposée par de
 * nombreux services et par les serveurs Whisper auto-hébergés (faster-whisper-server, LocalAI…).
 *   TRANSCRIPTION_URL=https://…/v1/audio/transcriptions
 *   TRANSCRIPTION_API_KEY=…            (facultatif selon le service)
 *   TRANSCRIPTION_MODEL=whisper-1       (défaut)
 */
@Injectable()
export class TranscriptionService {
    private readonly logger = new Logger(TranscriptionService.name);
    private readonly url = process.env.TRANSCRIPTION_URL;

    get enabled() {
        return Boolean(this.url);
    }

    async transcribe(audio: Buffer, mimeType: string, extension: string): Promise<string> {
        if (!this.url) throw new ServiceUnavailableException("La transcription serveur n'est pas configurée");

        const form = new FormData();
        form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType }), `note.${extension}`);
        form.append('model', process.env.TRANSCRIPTION_MODEL ?? 'whisper-1');
        form.append('language', 'fr');
        form.append('response_format', 'json');

        const key = process.env.TRANSCRIPTION_API_KEY;
        const res = await fetch(this.url, {
            method: 'POST',
            headers: key ? { authorization: `Bearer ${key}` } : undefined,
            body: form,
            signal: AbortSignal.timeout(120_000),
        });
        const json = (await res.json().catch(() => ({}))) as { text?: string; error?: { message?: string } };
        if (!res.ok || typeof json.text !== 'string') {
            this.logger.warn(`Transcription en échec (${res.status}) : ${json.error?.message ?? 'réponse inattendue'}`);
            throw new ServiceUnavailableException('La transcription a échoué, réessayez ou saisissez le texte');
        }
        return json.text.trim();
    }
}
