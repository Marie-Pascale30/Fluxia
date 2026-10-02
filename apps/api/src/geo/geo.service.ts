import { BadRequestException, Global, Injectable, Logger, Module } from '@nestjs/common';

export interface GeocodedAddress {
    lat: number;
    lng: number;
    /** Adresse normalisée par le géocodeur */
    label: string;
    postalCode: string;
    city: string;
}

export interface AddressInput {
    address: string;
    postalCode?: string;
    city?: string;
}

const PARIS_CENTER = { lat: 48.8566, lng: 2.3522 };

/**
 * Géocodage des adresses (indispensable au calcul des trajets du planning).
 * GEOCODER=ign (défaut) : service public de l'IGN, sans clé (ex-Base Adresse Nationale).
 * GEOCODER=none : pas d'appel réseau (tests, hors ligne) — coordonnées du centre de Paris.
 */
@Injectable()
export class GeoService {
    private readonly logger = new Logger(GeoService.name);
    private readonly mode = process.env.GEOCODER ?? 'ign';
    private readonly url = process.env.GEOCODER_URL ?? 'https://data.geopf.fr/geocodage/search';

    async geocode(input: AddressInput): Promise<GeocodedAddress> {
        const query = [input.address, input.postalCode, input.city].filter(Boolean).join(' ').trim();
        if (this.mode === 'none') {
            return { ...PARIS_CENTER, label: query, postalCode: input.postalCode ?? '', city: input.city ?? '' };
        }

        let feature: { geometry: { coordinates: [number, number] }; properties: Record<string, unknown> } | undefined;
        try {
            const res = await fetch(`${this.url}?${new URLSearchParams({ q: query, limit: '1' })}`, {
                signal: AbortSignal.timeout(5000),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            feature = (await res.json()).features?.[0];
        } catch (error) {
            this.logger.warn(`Géocodage indisponible (${(error as Error).message})`);
            throw new BadRequestException("Service de géolocalisation indisponible : réessayez ou saisissez les coordonnées");
        }

        const score = Number(feature?.properties.score ?? 0);
        if (!feature || score < 0.4) {
            throw new BadRequestException(`Adresse introuvable : « ${query} ». Vérifiez-la (numéro, rue, code postal).`);
        }
        const [lng, lat] = feature.geometry.coordinates;
        // Adresse normalisée seulement si le numéro exact est reconnu ; sinon on garde la saisie
        const exact = feature.properties.type === 'housenumber';
        return {
            lat,
            lng,
            label: exact ? String(feature.properties.name) : input.address,
            postalCode: String(feature.properties.postcode ?? input.postalCode ?? ''),
            city: String(feature.properties.city ?? input.city ?? ''),
        };
    }
}

@Global()
@Module({ providers: [GeoService], exports: [GeoService] })
export class GeoModule {}
