import { createCatalogItem, updateCatalogItem } from '@/app/actions';
import { Card, PageHeader } from '@/components/ui';
import { ActionForm } from '@/components/ui/ActionForm';
import { api } from '@/lib/api';
import { formatMoney, LINE_KIND } from '@/lib/format';
import type { CatalogItem } from '@/lib/types';

export const metadata = { title: 'Catalogue' };

function ItemFields({ item }: { item?: CatalogItem }) {
    return (
        <div className="form-row">
            {!item && (
                <label>
                    Code
                    <input name="code" className="input" required pattern="[A-Za-z0-9-]{2,20}" placeholder="FILT-CLIM" />
                </label>
            )}
            <label>
                Désignation
                <input name="label" className="input" required minLength={2} defaultValue={item?.label} />
            </label>
            <label>
                Type
                <select name="kind" className="select" defaultValue={item?.kind ?? 'PART'}>
                    {Object.entries(LINE_KIND).map(([value, label]) => (
                        <option key={value} value={value}>
                            {label}
                        </option>
                    ))}
                </select>
            </label>
            <label>
                Prix HT (€)
                <input name="price" className="input" inputMode="decimal" required defaultValue={item ? (item.unitPriceCents / 100).toFixed(2) : ''} />
            </label>
            <label>
                Mots-clés (détection IA)
                <input name="keywords" className="input" placeholder="filtre, filtres" defaultValue={item?.keywords.join(', ')} />
            </label>
        </div>
    );
}

export default async function CatalogPage() {
    const items = await api.catalog();

    return (
        <>
            <PageHeader
                title="Catalogue"
                subtitle="Prix appliqués aux devis. Les mots-clés permettent à l'IA de reconnaître les pièces citées par les techniciens."
            />
            <Card className="mb" title="Nouvel article">
                <ActionForm action={createCatalogItem} submitLabel="Ajouter" resetOnSuccess>
                    <ItemFields />
                </ActionForm>
            </Card>
            <Card>
                {items.map((item) => (
                    <details key={item.id} className="row" style={{ display: 'block' }}>
                        <summary className="row-flex">
                            <code className="small">{item.code}</code>
                            <span className="grow strong">{item.label}</span>
                            <span className="muted small">{LINE_KIND[item.kind]}</span>
                            <b>{formatMoney(item.unitPriceCents)}</b>
                        </summary>
                        <div className="mt">
                            <ActionForm action={updateCatalogItem.bind(null, item.id)} submitLabel="Enregistrer" variant="light">
                                <ItemFields item={item} />
                            </ActionForm>
                        </div>
                    </details>
                ))}
            </Card>
        </>
    );
}
