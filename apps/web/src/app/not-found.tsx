import Link from 'next/link';
import { EmptyState } from '@/components/ui';

export default function NotFound() {
    return (
        <div className="card">
            <EmptyState icon="?" title="Page introuvable">
                <Link href="/" className="btn light">
                    Retour à l&apos;accueil
                </Link>
            </EmptyState>
        </div>
    );
}
