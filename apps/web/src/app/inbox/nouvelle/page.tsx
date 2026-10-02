import { Card, PageHeader } from '@/components/ui';
import { NewRequestForm } from '@/features/inbox/NewRequestForm';

export const metadata = { title: 'Nouvelle demande' };

export default function NewRequestPage() {
    return (
        <>
            <PageHeader
                title="Simuler une demande entrante"
                subtitle="En production, les demandes arrivent automatiquement (boîte mail, formulaire web, standard)."
            />
            <Card className="mb" title="Nouvelle demande">
                <NewRequestForm />
            </Card>
        </>
    );
}
