import { deleteAttachment } from '@/app/actions';
import { ActionButton } from '@/components/ui/ActionButton';
import { formatDateTime } from '@/lib/format';
import type { Attachment } from '@/lib/types';

/** Photos d'une intervention (servies par /files/[id], droits vérifiés par l'API). */
export function PhotoGallery({ attachments, editable = false }: { attachments: Attachment[]; editable?: boolean }) {
    const photos = attachments.filter((a) => a.kind === 'PHOTO');
    if (!photos.length) return null;

    return (
        <div className="gallery">
            {photos.map((p) => (
                <figure key={p.id}>
                    <a href={`/files/${p.id}`} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé relayé, non optimisable */}
                        <img src={`/files/${p.id}`} alt={p.caption ?? 'Photo d’intervention'} loading="lazy" />
                    </a>
                    <figcaption>
                        <span className="grow">{p.caption ?? formatDateTime(p.createdAt)}</span>
                        {editable && (
                            <ActionButton action={deleteAttachment.bind(null, p.id)} variant="light" size="sm" confirm="Supprimer cette photo ?" title="Supprimer">
                                ✕
                            </ActionButton>
                        )}
                    </figcaption>
                </figure>
            ))}
        </div>
    );
}

/** Signature du client, si recueillie. */
export function SignatureView({ attachments, signedBy, signedAt }: { attachments: Attachment[]; signedBy: string | null; signedAt: string | null }) {
    const signature = attachments.find((a) => a.kind === 'SIGNATURE');
    if (!signature || !signedBy) return null;
    return (
        <div className="signature-view">
            {/* eslint-disable-next-line @next/next/no-img-element -- fichier privé relayé */}
            <img src={`/files/${signature.id}`} alt={`Signature de ${signedBy}`} />
            <div className="muted small">
                Signé par <b>{signedBy}</b>
                {signedAt && ` le ${formatDateTime(signedAt)}`}
            </div>
        </div>
    );
}
