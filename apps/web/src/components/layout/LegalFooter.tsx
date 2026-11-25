import Link from 'next/link';

/** Liens légaux des pages publiques (connexion, inscription, pages légales, portail). */
export function LegalFooter() {
    return (
        <footer className="legal-footer muted small">
            <span>Fluxia · projet de démonstration non commercialisé</span>
            <nav aria-label="Informations légales">
                <Link href="/mentions-legales">Mentions légales</Link>
                <Link href="/conditions">Conditions d’utilisation</Link>
                <Link href="/confidentialite">Confidentialité</Link>
            </nav>
        </footer>
    );
}
