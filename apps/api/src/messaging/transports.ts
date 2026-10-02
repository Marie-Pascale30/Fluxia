// Transports de messages. Choisis par configuration ; par défaut, simulation ("log").
import { Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

export interface OutgoingAttachment {
    filename: string;
    content: Buffer;
    contentType: string;
}

export interface OutgoingEmail {
    to: string;
    subject: string;
    text: string;
    attachments: OutgoingAttachment[];
}

export interface DeliveryReceipt {
    transport: string;
    providerId?: string;
}

export interface EmailTransport {
    readonly name: string;
    send(email: OutgoingEmail): Promise<DeliveryReceipt>;
}

export interface SmsTransport {
    readonly name: string;
    send(to: string, body: string): Promise<DeliveryReceipt>;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Version HTML minimale d'un texte brut (paragraphes, retours à la ligne). */
export const textToHtml = (text: string) =>
    `<div style="font-family:system-ui,sans-serif;font-size:14px;line-height:1.5">${text
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
        .join('')}</div>`;

/** Simulation : rien ne sort du serveur, le message est simplement tracé. */
export class LogEmailTransport implements EmailTransport {
    readonly name = 'log';
    private readonly logger = new Logger('Email(simulation)');
    async send(email: OutgoingEmail): Promise<DeliveryReceipt> {
        this.logger.log(`→ ${email.to} : ${email.subject}${email.attachments.length ? ` (+${email.attachments.length} PJ)` : ''}`);
        return { transport: this.name };
    }
}

/** SMTP (OVH, Gmail, Office 365, Brevo, Mailjet…) : SMTP_URL=smtps://user:pass@smtp.exemple.fr:465 */
export class SmtpEmailTransport implements EmailTransport {
    readonly name = 'smtp';
    private readonly transporter;
    constructor(
        url: string,
        private readonly from: string,
    ) {
        this.transporter = nodemailer.createTransport(url);
    }
    async send(email: OutgoingEmail): Promise<DeliveryReceipt> {
        const info = await this.transporter.sendMail({
            from: this.from,
            to: email.to,
            subject: email.subject,
            text: email.text,
            html: textToHtml(email.text),
            attachments: email.attachments,
        });
        return { transport: this.name, providerId: info.messageId };
    }
}

export class LogSmsTransport implements SmsTransport {
    readonly name = 'log';
    private readonly logger = new Logger('SMS(simulation)');
    async send(to: string, body: string): Promise<DeliveryReceipt> {
        this.logger.log(`→ ${to} : ${body.slice(0, 80)}`);
        return { transport: this.name };
    }
}

/** Numéro français ou international → format E.164 (+33…). */
export function toE164(phone: string): string {
    const digits = phone.replace(/[^\d+]/g, '');
    if (digits.startsWith('+')) return digits;
    if (digits.startsWith('00')) return `+${digits.slice(2)}`;
    if (digits.startsWith('0') && digits.length === 10) return `+33${digits.slice(1)}`;
    return digits;
}

/** Twilio (API REST, sans SDK) : TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM. */
export class TwilioSmsTransport implements SmsTransport {
    readonly name = 'twilio';
    constructor(
        private readonly accountSid: string,
        private readonly authToken: string,
        private readonly from: string,
    ) {}
    async send(to: string, body: string): Promise<DeliveryReceipt> {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
            method: 'POST',
            headers: {
                authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}`,
                'content-type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: toE164(to), From: this.from, Body: body }),
            signal: AbortSignal.timeout(10_000),
        });
        const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
        if (!res.ok) throw new Error(`Twilio ${res.status} : ${json.message ?? 'erreur inconnue'}`);
        return { transport: this.name, providerId: json.sid };
    }
}

export function emailTransportFromEnv(): EmailTransport {
    const url = process.env.SMTP_URL;
    if (!url) return new LogEmailTransport();
    return new SmtpEmailTransport(url, process.env.MAIL_FROM ?? 'Fluxia <no-reply@fluxia.local>');
}

export function smsTransportFromEnv(): SmsTransport {
    const { TWILIO_ACCOUNT_SID: sid, TWILIO_AUTH_TOKEN: token, TWILIO_FROM: from } = process.env;
    return sid && token && from ? new TwilioSmsTransport(sid, token, from) : new LogSmsTransport();
}
