import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { RequestsService } from '../requests/requests.service.js';
import { stripQuotedReply } from './inbound.js';

/**
 * Relève d'une boîte mail en IMAP (Gmail, Outlook, OVH… avec mot de passe d'application).
 * Activée par IMAP_URL=imaps://utilisateur:motdepasse@imap.exemple.fr:993
 * Les messages non lus de la boîte de réception deviennent des demandes, puis sont marqués lus.
 */
@Injectable()
export class ImapPoller implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(ImapPoller.name);
    private timer?: NodeJS.Timeout;
    private running = false;

    constructor(private readonly requests: RequestsService) {}

    onModuleInit() {
        if (!process.env.IMAP_URL) return;
        const seconds = Number(process.env.IMAP_POLL_SECONDS ?? 60);
        this.logger.log(`Relève IMAP toutes les ${seconds} s`);
        this.timer = setInterval(() => void this.poll(), seconds * 1000);
        void this.poll();
    }

    onModuleDestroy() {
        clearInterval(this.timer);
    }

    private client() {
        const url = new URL(process.env.IMAP_URL!);
        return new ImapFlow({
            host: url.hostname,
            port: Number(url.port || (url.protocol === 'imaps:' ? 993 : 143)),
            secure: url.protocol === 'imaps:',
            auth: { user: decodeURIComponent(url.username), pass: decodeURIComponent(url.password) },
            logger: false,
        });
    }

    async poll() {
        if (this.running) return;
        this.running = true;
        const client = this.client();
        let imported = 0;
        try {
            await client.connect();
            const lock = await client.getMailboxLock(process.env.IMAP_MAILBOX ?? 'INBOX');
            try {
                const unseen = await client.search({ seen: false }, { uid: true });
                for (const uid of unseen || []) {
                    const message = await client.fetchOne(String(uid), { source: true }, { uid: true });
                    if (!message || !message.source) continue;
                    const mail = await simpleParser(message.source);
                    const from = mail.from?.value[0];
                    const text = mail.text?.trim();
                    if (from?.address && text) {
                        await this.requests.ingest(
                            {
                                fromName: from.name || from.address.split('@')[0],
                                fromEmail: from.address.toLowerCase(),
                                subject: mail.subject?.trim() || '(sans objet)',
                                body: (stripQuotedReply(text) || text).slice(0, 10_000),
                                attachments: Math.min(50, mail.attachments.length),
                            },
                            mail.messageId,
                        );
                        imported++;
                    }
                    await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true });
                }
            } finally {
                lock.release();
            }
            if (imported) this.logger.log(`${imported} email(s) importé(s)`);
        } catch (error) {
            this.logger.warn(`Relève IMAP impossible : ${(error as Error).message}`);
        } finally {
            await client.logout().catch(() => undefined);
            this.running = false;
        }
    }
}
