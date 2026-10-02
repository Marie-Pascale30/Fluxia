// Formulaires de la fiche client (rendus côté serveur, envoyés via Server Actions).
import { addContract, addEquipment, addSite, deleteEquipment, updateClient } from '@/app/actions';
import { ClientFields, SiteFields } from '@/components/forms/fields';
import { ActionButton } from '@/components/ui/ActionButton';
import { ActionForm } from '@/components/ui/ActionForm';
import { EQUIPMENT } from '@/lib/format';
import type { ClientDetail, Equipment } from '@/lib/types';

export function EditClientForm({ client }: { client: ClientDetail }) {
    return (
        <ActionForm action={updateClient.bind(null, client.id)} submitLabel="Enregistrer" variant="light">
            <ClientFields defaults={client} />
        </ActionForm>
    );
}

export function AddSiteForm({ clientId }: { clientId: string }) {
    return (
        <ActionForm action={addSite.bind(null, clientId)} submitLabel="Ajouter le site" pendingLabel="Géolocalisation…" variant="light" resetOnSuccess>
            <SiteFields />
        </ActionForm>
    );
}

export function AddEquipmentForm({ siteId }: { siteId: string }) {
    return (
        <ActionForm action={addEquipment.bind(null, siteId)} submitLabel="Ajouter" variant="light" resetOnSuccess>
            <div className="form-row">
                <label>
                    Type
                    <select name="type" className="select" required defaultValue="CLIMATISATION">
                        {Object.entries(EQUIPMENT).map(([value, label]) => (
                            <option key={value} value={value}>
                                {label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Désignation
                    <input name="label" className="input" required minLength={2} placeholder="Climatisation salle" />
                </label>
                <label>
                    Marque
                    <input name="brand" className="input" />
                </label>
                <label>
                    Modèle
                    <input name="model" className="input" />
                </label>
            </div>
        </ActionForm>
    );
}

export function DeleteEquipmentButton({ equipment }: { equipment: Equipment }) {
    return (
        <ActionButton
            action={deleteEquipment.bind(null, equipment.id)}
            variant="light"
            size="sm"
            confirm={`Supprimer « ${equipment.label} » ? (impossible s'il a un historique)`}
            title="Supprimer"
        >
            ✕
        </ActionButton>
    );
}

export function AddContractForm({ clientId }: { clientId: string }) {
    const year = new Date().getFullYear();
    return (
        <ActionForm action={addContract.bind(null, clientId)} submitLabel="Ajouter le contrat" variant="light" resetOnSuccess>
            <div className="form-row">
                <label>
                    Référence
                    <input name="reference" className="input" required minLength={3} placeholder={`MAINT-${year}-001`} />
                </label>
                <label>
                    Intitulé
                    <input name="label" className="input" required minLength={3} placeholder="Maintenance CVC annuelle" />
                </label>
            </div>
            <div className="form-row">
                <label>
                    Début
                    <input name="startDate" type="date" className="input" required defaultValue={`${year}-01-01`} />
                </label>
                <label>
                    Fin
                    <input name="endDate" type="date" className="input" required defaultValue={`${year}-12-31`} />
                </label>
                <label>
                    Prochain entretien
                    <input name="nextServiceDate" type="date" className="input" />
                </label>
                <label>
                    Périodicité
                    <select name="serviceIntervalMonths" className="select" defaultValue="12">
                        <option value="">Aucune</option>
                        <option value="3">Trimestrielle</option>
                        <option value="6">Semestrielle</option>
                        <option value="12">Annuelle</option>
                        <option value="24">Tous les 2 ans</option>
                    </select>
                </label>
            </div>
            <fieldset className="checks">
                <legend>Inclus dans le forfait</legend>
                <label className="check">
                    <input type="checkbox" name="coversLabor" defaultChecked /> Main d&apos;œuvre
                </label>
                <label className="check">
                    <input type="checkbox" name="coversTravel" defaultChecked /> Déplacement
                </label>
                <label className="check">
                    <input type="checkbox" name="coversParts" /> Pièces
                </label>
            </fieldset>
        </ActionForm>
    );
}
