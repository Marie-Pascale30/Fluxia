// Groupes de champs réutilisés par plusieurs formulaires (rendus côté serveur).
import { EQUIPMENT } from '@/lib/format';
import type { EquipmentType } from '@/lib/types';

export function ClientFields({
    defaults = {},
}: {
    defaults?: { name?: string | null; email?: string | null; phone?: string | null; contactName?: string | null };
}) {
    return (
        <>
            <div className="form-row">
                <label>
                    Nom / raison sociale
                    <input name="name" className="input" required minLength={2} defaultValue={defaults.name ?? ''} />
                </label>
                <label>
                    Contact
                    <input name="contactName" className="input" defaultValue={defaults.contactName ?? ''} />
                </label>
            </div>
            <div className="form-row">
                <label>
                    Email
                    <input name="email" type="email" className="input" defaultValue={defaults.email ?? ''} />
                </label>
                <label>
                    Téléphone
                    <input name="phone" type="tel" className="input" defaultValue={defaults.phone ?? ''} />
                </label>
            </div>
        </>
    );
}

/** Adresse d'un site ; elle est géolocalisée côté serveur pour le calcul des trajets. */
export function SiteFields({
    prefix = '',
    labelName = 'label',
    defaults = {},
    required = true,
}: {
    prefix?: string;
    labelName?: string;
    defaults?: { label?: string; address?: string; postalCode?: string; city?: string };
    required?: boolean;
}) {
    return (
        <>
            <div className="form-row">
                <label>
                    Nom du site
                    <input name={`${prefix}${labelName}`} className="input" placeholder="Siège, Magasin, Domicile…" defaultValue={defaults.label ?? ''} required={required} />
                </label>
                <label>
                    Adresse
                    <input name={`${prefix}address`} className="input" placeholder="12 rue des Lilas" defaultValue={defaults.address ?? ''} required={required} minLength={3} />
                </label>
            </div>
            <div className="form-row">
                <label>
                    Code postal
                    <input name={`${prefix}postalCode`} className="input" inputMode="numeric" defaultValue={defaults.postalCode ?? ''} />
                </label>
                <label>
                    Ville
                    <input name={`${prefix}city`} className="input" defaultValue={defaults.city ?? ''} />
                </label>
            </div>
        </>
    );
}

export function SkillsField({ defaults = [] }: { defaults?: EquipmentType[] }) {
    return (
        <fieldset className="checks">
            <legend>Compétences</legend>
            {(Object.entries(EQUIPMENT) as [EquipmentType, string][]).map(([value, label]) => (
                <label key={value} className="check">
                    <input type="checkbox" name="skills" value={value} defaultChecked={defaults.includes(value)} /> {label}
                </label>
            ))}
        </fieldset>
    );
}

/** "12 rue des Lilas, 75015 Paris" → { address, postalCode, city } */
export function splitAddress(value: string | null | undefined) {
    if (!value) return {};
    const match = /^(.*?),?\s*(\d{5})\s+(.+)$/.exec(value.trim());
    if (match) return { address: match[1].trim(), postalCode: match[2], city: match[3].trim() };
    const district = /^(Paris|Lyon|Marseille)\s+(\d{1,2})e$/i.exec(value.trim());
    if (district) {
        const prefix = { paris: '750', lyon: '6900', marseille: '130' }[district[1].toLowerCase()] ?? '';
        return { city: district[1], postalCode: `${prefix}${district[2].padStart(prefix.length === 4 ? 1 : 2, '0')}` };
    }
    return { address: value };
}
