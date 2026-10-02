// Normalisation des emails entrants, quelle que soit leur provenance
// (webhook Postmark / Mailgun / SendGrid / format générique, relève IMAP).

export interface InboundEmail {
    fromName: string;
    fromEmail: string;
    subject: string;
    text: string;
    attachments: number;
    externalId?: string;
}

const ADDRESS = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/;

/** "Marc Petit <contact@leparisien.fr>" → { name, email } */
export function parseAddress(value: string): { name: string; email: string } {
    const match = ADDRESS.exec(value);
    if (match) return { name: match[1].trim() || match[2].split('@')[0], email: match[2].trim().toLowerCase() };
    const email = value.trim().toLowerCase();
    return { name: email.split('@')[0], email };
}

/** Supprime l'historique cité d'une réponse ("Le … a écrit :", lignes "> …"). */
export function stripQuotedReply(text: string): string {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const cut = lines.findIndex(
        (l) => /^(le|on)\s.+(a écrit|wrote)\s*:\s*$/i.test(l.trim()) || /^-{2,}\s*(message d'origine|original message)/i.test(l.trim()),
    );
    const kept = (cut >= 0 ? lines.slice(0, cut) : lines).filter((l) => !l.startsWith('>'));
    return kept.join('\n').trim();
}

type Payload = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

/** Reconnaît les principaux formats de webhooks d'emails entrants. */
export function normalizeInbound(payload: Payload): InboundEmail | null {
    let from: { name: string; email: string } | undefined;
    let subject: string | undefined;
    let text: string | undefined;
    let attachments = 0;
    let externalId: string | undefined;

    const fromFull = payload.FromFull as { Email?: string; Name?: string } | undefined;
    if (fromFull?.Email) {
        // Postmark
        from = { name: fromFull.Name || fromFull.Email.split('@')[0], email: fromFull.Email.toLowerCase() };
        subject = str(payload.Subject);
        text = str(payload.StrippedTextReply) || str(payload.TextBody);
        attachments = Array.isArray(payload.Attachments) ? payload.Attachments.length : 0;
        externalId = str(payload.MessageID);
    } else if (payload['body-plain'] !== undefined) {
        // Mailgun
        from = parseAddress(str(payload.from) ?? str(payload.sender) ?? '');
        subject = str(payload.subject);
        text = str(payload['stripped-text']) || str(payload['body-plain']);
        attachments = Number(payload['attachment-count'] ?? 0);
        externalId = str(payload['Message-Id']);
    } else {
        // SendGrid Inbound Parse et format générique { from, subject, text }
        const rawFrom = payload.from;
        from =
            typeof rawFrom === 'object' && rawFrom && 'email' in rawFrom
                ? { email: String((rawFrom as Payload).email).toLowerCase(), name: String((rawFrom as Payload).name ?? '') }
                : parseAddress(str(rawFrom) ?? '');
        subject = str(payload.subject);
        text = str(payload.text) ?? str(payload.body);
        const att = payload.attachments;
        attachments = Array.isArray(att) ? att.length : Number(att ?? 0) || 0;
        externalId = str(payload.messageId) ?? str(payload['message-id']);
    }

    if (!from?.email.includes('@') || !text?.trim()) return null;
    return {
        fromName: from.name || from.email.split('@')[0],
        fromEmail: from.email,
        subject: subject?.trim() || '(sans objet)',
        text: stripQuotedReply(text) || text.trim(),
        attachments,
        externalId,
    };
}
