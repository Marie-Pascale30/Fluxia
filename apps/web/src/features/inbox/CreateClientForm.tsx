import { createClientFromRequest } from '@/app/actions';
import { ActionForm } from '@/components/ui/ActionForm';
import { ClientFields, SiteFields, splitAddress } from '@/components/forms/fields';
import type { InboundRequestDetail } from '@/lib/types';

/** Fiche client pré-remplie avec ce que l'IA a repéré dans la demande. */
export function CreateClientForm({ request }: { request: InboundRequestDetail }) {
    const address = splitAddress(request.extractedAddress);
    return (
        <ActionForm action={createClientFromRequest.bind(null, request.id)} submitLabel="Créer le client et le rattacher" pendingLabel="Géolocalisation…" variant="ai">
            <ClientFields defaults={{ name: request.fromName, email: request.fromEmail, phone: request.extractedPhone, contactName: request.fromName }} />
            <SiteFields labelName="siteLabel" defaults={{ label: 'Site principal', ...address }} />
            {request.extractedAddress && (
                <div className="muted small">Adresse repérée dans le message : « {request.extractedAddress} »</div>
            )}
        </ActionForm>
    );
}
