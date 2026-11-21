// Facture électronique Factur-X : XML CII (UN/CEFACT D16B), profil EN 16931.
// Ce XML est embarqué dans le PDF/A-3 de la facture (pdf.service.ts) et téléchargeable seul.
// Le profil EN 16931 couvre les données exigées par la réforme française de la facturation électronique.

import { zonedParts } from '../common/dates.js';
import { lineTotalCents, quoteTotals } from '../reports/billing.js';

export const FACTURX_PROFILE = 'urn:cen.eu:en16931:2017';
export const FACTURX_FILENAME = 'factur-x.xml';

export interface FacturxParty {
    name: string;
    /** SIRET (14 chiffres) : le SIREN (9 premiers) sert d'identifiant légal */
    siret?: string | null;
    vatNumber?: string | null;
    address?: string | null;
    postalCode?: string | null;
    city?: string | null;
    email?: string | null;
}

export interface FacturxInvoice {
    number: string;
    issuedAt: Date;
    dueAt: Date | null;
    vatRate: number;
    title: string;
    lines: { kind: string; label: string; quantity: number; unitPriceCents: number }[];
    paymentTermsDays: number;
}

const NS = {
    rsm: 'urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100',
    ram: 'urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100',
    qdt: 'urn:un:unece:uncefact:data:standard:QualifiedDataType:100',
    udt: 'urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100',
};

const esc = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);
const amount = (cents: number) => (cents / 100).toFixed(2);
const quantity = (q: number) => String(Math.round(q * 10_000) / 10_000);
const percent = (rate: number) => (rate * 100).toFixed(2);
/** Date au format 102 (AAAAMMJJ), dans le fuseau de l'entreprise */
const day = (d: Date) => {
    const { year, month, day } = zonedParts(d);
    return `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`;
};
const dateTime = (tag: string, d: Date) => `<${tag}><udt:DateTimeString format="102">${day(d)}</udt:DateTimeString></${tag}>`;
const digits = (value?: string | null) => (value ?? '').replace(/\D/g, '');
/** Unité : heure pour la main d'œuvre, unité sinon (codes UN/ECE rec. 20) */
const unitCode = (kind: string) => (kind === 'LABOR' ? 'HUR' : 'C62');

function party(tag: string, p: FacturxParty) {
    const siren = digits(p.siret).slice(0, 9);
    const address = [
        p.postalCode ? `<ram:PostcodeCode>${esc(p.postalCode)}</ram:PostcodeCode>` : '',
        p.address ? `<ram:LineOne>${esc(p.address)}</ram:LineOne>` : '',
        p.city ? `<ram:CityName>${esc(p.city)}</ram:CityName>` : '',
        '<ram:CountryID>FR</ram:CountryID>',
    ].join('');
    return [
        `<ram:${tag}>`,
        `<ram:Name>${esc(p.name)}</ram:Name>`,
        siren.length === 9 ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren}</ram:ID></ram:SpecifiedLegalOrganization>` : '',
        `<ram:PostalTradeAddress>${address}</ram:PostalTradeAddress>`,
        p.email ? `<ram:URIUniversalCommunication><ram:URIID schemeID="EM">${esc(p.email)}</ram:URIID></ram:URIUniversalCommunication>` : '',
        p.vatNumber ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(p.vatNumber.replace(/\s/g, '').toUpperCase())}</ram:ID></ram:SpecifiedTaxRegistration>` : '',
        `</ram:${tag}>`,
    ].join('');
}

/** XML Factur-X (EN 16931) d'une facture émise. */
export function facturxXml(invoice: FacturxInvoice, seller: FacturxParty, buyer: FacturxParty): string {
    const totals = quoteTotals(invoice.lines, invoice.vatRate);
    // Franchise en base de TVA (taux nul) : catégorie « exonéré » et motif légal
    const exempt = invoice.vatRate === 0;
    const category = exempt ? 'E' : 'S';
    const tax = (calculated?: number, basis?: number) =>
        [
            calculated !== undefined ? `<ram:CalculatedAmount>${amount(calculated)}</ram:CalculatedAmount>` : '',
            '<ram:TypeCode>VAT</ram:TypeCode>',
            exempt && calculated !== undefined ? '<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI</ram:ExemptionReason>' : '',
            basis !== undefined ? `<ram:BasisAmount>${amount(basis)}</ram:BasisAmount>` : '',
            `<ram:CategoryCode>${category}</ram:CategoryCode>`,
            exempt && calculated !== undefined ? '<ram:ExemptionReasonCode>VATEX-FR-FRANCHISE</ram:ExemptionReasonCode>' : '',
            `<ram:RateApplicablePercent>${percent(invoice.vatRate)}</ram:RateApplicablePercent>`,
        ].join('');

    const lines = invoice.lines.map((line, index) =>
        [
            '<ram:IncludedSupplyChainTradeLineItem>',
            `<ram:AssociatedDocumentLineDocument><ram:LineID>${index + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>`,
            `<ram:SpecifiedTradeProduct><ram:Name>${esc(line.label)}</ram:Name></ram:SpecifiedTradeProduct>`,
            `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${amount(line.unitPriceCents)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>`,
            `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${unitCode(line.kind)}">${quantity(line.quantity)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>`,
            '<ram:SpecifiedLineTradeSettlement>',
            `<ram:ApplicableTradeTax>${tax()}</ram:ApplicableTradeTax>`,
            `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${amount(lineTotalCents(line))}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>`,
            '</ram:SpecifiedLineTradeSettlement>',
            '</ram:IncludedSupplyChainTradeLineItem>',
        ].join(''),
    );

    // Mentions obligatoires en France : pénalités (PMD), indemnité forfaitaire (PMT), escompte (AAB)
    const notes = [
        ['AAB', "Pas d'escompte pour paiement anticipé."],
        ['PMD', "En cas de retard de paiement : pénalités au taux de 3 fois le taux d'intérêt légal (art. L441-10 du Code de commerce)."],
        ['PMT', 'Indemnité forfaitaire pour frais de recouvrement en cas de retard de paiement : 40 €.'],
    ]
        .map(([code, text]) => `<ram:IncludedNote><ram:Content>${esc(text)}</ram:Content><ram:SubjectCode>${code}</ram:SubjectCode></ram:IncludedNote>`)
        .join('');

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<rsm:CrossIndustryInvoice xmlns:rsm="${NS.rsm}" xmlns:ram="${NS.ram}" xmlns:qdt="${NS.qdt}" xmlns:udt="${NS.udt}">`,
        `<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${FACTURX_PROFILE}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>`,
        '<rsm:ExchangedDocument>',
        `<ram:ID>${esc(invoice.number)}</ram:ID>`,
        '<ram:TypeCode>380</ram:TypeCode>',
        dateTime('ram:IssueDateTime', invoice.issuedAt),
        notes,
        '</rsm:ExchangedDocument>',
        '<rsm:SupplyChainTradeTransaction>',
        ...lines,
        '<ram:ApplicableHeaderTradeAgreement>',
        party('SellerTradeParty', seller),
        party('BuyerTradeParty', buyer),
        '</ram:ApplicableHeaderTradeAgreement>',
        '<ram:ApplicableHeaderTradeDelivery/>',
        '<ram:ApplicableHeaderTradeSettlement>',
        '<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>',
        `<ram:ApplicableTradeTax>${tax(totals.vatCents, totals.totalHtCents)}</ram:ApplicableTradeTax>`,
        '<ram:SpecifiedTradePaymentTerms>',
        `<ram:Description>${esc(`Paiement à ${invoice.paymentTermsDays} jours`)}</ram:Description>`,
        invoice.dueAt ? dateTime('ram:DueDateDateTime', invoice.dueAt) : '',
        '</ram:SpecifiedTradePaymentTerms>',
        '<ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
        `<ram:LineTotalAmount>${amount(totals.totalHtCents)}</ram:LineTotalAmount>`,
        `<ram:TaxBasisTotalAmount>${amount(totals.totalHtCents)}</ram:TaxBasisTotalAmount>`,
        `<ram:TaxTotalAmount currencyID="EUR">${amount(totals.vatCents)}</ram:TaxTotalAmount>`,
        `<ram:GrandTotalAmount>${amount(totals.totalTtcCents)}</ram:GrandTotalAmount>`,
        `<ram:DuePayableAmount>${amount(totals.totalTtcCents)}</ram:DuePayableAmount>`,
        '</ram:SpecifiedTradeSettlementHeaderMonetarySummation>',
        '</ram:ApplicableHeaderTradeSettlement>',
        '</rsm:SupplyChainTradeTransaction>',
        '</rsm:CrossIndustryInvoice>',
    ].join('\n');
}

/** Métadonnées XMP Factur-X (avec la description d'extension exigée par PDF/A). */
export const facturxXmp = (conformanceLevel = 'EN 16931') => `
        <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
            <fx:DocumentType>INVOICE</fx:DocumentType>
            <fx:DocumentFileName>${FACTURX_FILENAME}</fx:DocumentFileName>
            <fx:Version>1.0</fx:Version>
            <fx:ConformanceLevel>${conformanceLevel}</fx:ConformanceLevel>
        </rdf:Description>
        <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
            <pdfaExtension:schemas>
                <rdf:Bag>
                    <rdf:li rdf:parseType="Resource">
                        <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
                        <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
                        <pdfaSchema:prefix>fx</pdfaSchema:prefix>
                        <pdfaSchema:property>
                            <rdf:Seq>
                                <rdf:li rdf:parseType="Resource">
                                    <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                                    <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                                    <pdfaProperty:category>external</pdfaProperty:category>
                                    <pdfaProperty:description>The name of the embedded XML document</pdfaProperty:description>
                                </rdf:li>
                                <rdf:li rdf:parseType="Resource">
                                    <pdfaProperty:name>DocumentType</pdfaProperty:name>
                                    <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                                    <pdfaProperty:category>external</pdfaProperty:category>
                                    <pdfaProperty:description>The type of the hybrid document in capital letters, e.g. INVOICE or ORDER</pdfaProperty:description>
                                </rdf:li>
                                <rdf:li rdf:parseType="Resource">
                                    <pdfaProperty:name>Version</pdfaProperty:name>
                                    <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                                    <pdfaProperty:category>external</pdfaProperty:category>
                                    <pdfaProperty:description>The actual version of the standard applying to the embedded XML document</pdfaProperty:description>
                                </rdf:li>
                                <rdf:li rdf:parseType="Resource">
                                    <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                                    <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                                    <pdfaProperty:category>external</pdfaProperty:category>
                                    <pdfaProperty:description>The conformance level of the embedded XML document</pdfaProperty:description>
                                </rdf:li>
                            </rdf:Seq>
                        </pdfaSchema:property>
                    </rdf:li>
                </rdf:Bag>
            </pdfaExtension:schemas>
        </rdf:Description>
`;
