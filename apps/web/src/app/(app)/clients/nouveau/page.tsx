import { createClient } from '@/app/actions';
import { ClientFields, SiteFields } from '@/components/forms/fields';
import { Card, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/ui/ActionForm';

export const metadata = { title: 'Nouveau client' };

export default function NewClientPage() {
    return (
        <>
            <PageHeader title="Nouveau client" subtitle="L'adresse du site est géolocalisée pour calculer les trajets des techniciens." />
            <Card className="mb" title="Fiche client">
                <ActionForm action={createClient} submitLabel="Créer le client" pendingLabel="Géolocalisation…">
                    <ClientFields />
                    <div className="label mt">Premier site (facultatif)</div>
                    <SiteFields prefix="site." required={false} />
                </ActionForm>
            </Card>
        </>
    );
}
