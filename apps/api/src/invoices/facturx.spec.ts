import { facturxXml, type FacturxInvoice } from './facturx.js';

const invoice: FacturxInvoice = {
    number: 'F-2026-0042',
    issuedAt: new Date('2026-11-21T10:00:00Z'),
    dueAt: new Date('2026-12-21T10:00:00Z'),
    vatRate: 0.2,
    title: 'Dépannage climatisation',
    paymentTermsDays: 30,
    lines: [
        { kind: 'LABOR', label: "Main d'œuvre", quantity: 1.5, unitPriceCents: 7500 },
        { kind: 'PART', label: 'Filtre <intérieur> & joint', quantity: 3, unitPriceCents: 333 },
    ],
};
const seller = { name: 'Clim & Co', siret: '12345678900012', vatNumber: 'fr 32 123456789', address: '1 rue X, 75002 Paris', email: 'bureau@clim.fr' };
const buyer = { name: 'SCI Rivoli', address: '42 rue de Rivoli', postalCode: '75001', city: 'Paris' };

const tag = (xml: string, name: string) => xml.match(new RegExp(`<ram:${name}[^>]*>([^<]*)</ram:${name}>`))?.[1];

describe('Facture électronique Factur-X (EN 16931)', () => {
    const xml = facturxXml(invoice, seller, buyer);

    it('déclare le profil EN 16931, le numéro, le type et la date', () => {
        expect(xml).toContain('<ram:ID>urn:cen.eu:en16931:2017</ram:ID>');
        expect(xml).toContain('<ram:ID>F-2026-0042</ram:ID>');
        expect(xml).toContain('<ram:TypeCode>380</ram:TypeCode>');
        expect(xml).toContain('<udt:DateTimeString format="102">20261121</udt:DateTimeString>');
    });

    it('a des totaux égaux à la somme des lignes arrondies', () => {
        // 1,5 × 75,00 = 112,50 ; 3 × 3,33 = 9,99 → HT 122,49, TVA 24,50, TTC 146,99
        expect(xml).toContain('<ram:LineTotalAmount>112.50</ram:LineTotalAmount>');
        expect(xml).toContain('<ram:LineTotalAmount>9.99</ram:LineTotalAmount>');
        expect(tag(xml, 'TaxBasisTotalAmount')).toBe('122.49');
        expect(tag(xml, 'TaxTotalAmount')).toBe('24.50');
        expect(tag(xml, 'GrandTotalAmount')).toBe('146.99');
        expect(tag(xml, 'DuePayableAmount')).toBe('146.99');
    });

    it('identifie le vendeur (SIREN, TVA normalisée) et l’acheteur', () => {
        expect(xml).toContain('<ram:ID schemeID="0002">123456789</ram:ID>');
        expect(xml).toContain('<ram:ID schemeID="VA">FR32123456789</ram:ID>');
        expect(xml).toContain('<ram:PostcodeCode>75001</ram:PostcodeCode><ram:LineOne>42 rue de Rivoli</ram:LineOne><ram:CityName>Paris</ram:CityName><ram:CountryID>FR</ram:CountryID>');
    });

    it('échappe les caractères spéciaux et code les unités', () => {
        expect(xml).toContain('Filtre &lt;intérieur&gt; &amp; joint');
        expect(xml).toContain('<ram:Name>Clim &amp; Co</ram:Name>');
        expect(xml).toContain('<ram:BilledQuantity unitCode="HUR">1.5</ram:BilledQuantity>');
        expect(xml).toContain('<ram:BilledQuantity unitCode="C62">3</ram:BilledQuantity>');
    });

    it('porte les mentions de paiement obligatoires en France', () => {
        for (const code of ['AAB', 'PMD', 'PMT']) expect(xml).toContain(`<ram:SubjectCode>${code}</ram:SubjectCode>`);
    });

    it('traite la franchise en base de TVA', () => {
        const exempt = facturxXml({ ...invoice, vatRate: 0 }, seller, buyer);
        expect(exempt).toContain('<ram:CategoryCode>E</ram:CategoryCode>');
        expect(exempt).toContain('<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>');
        expect(tag(exempt, 'TaxTotalAmount')).toBe('0.00');
    });
});
