import { NextResponse, type NextRequest } from 'next/server';
import { homeFor, readClaims, SESSION_COOKIE } from '@/lib/session';

// Redirections "optimistes" avant le rendu : sans session → /login,
// technicien → uniquement sa vue terrain et ses rapports.
// L'autorisation réelle reste appliquée par l'API à chaque requête.

const PUBLIC_PATHS = ['/login', '/portail'];
const TECHNICIAN_PATHS = (tid: string) => [`/techniciens/${tid}`, '/rapports/', '/files/', '/pdf/rapport/'];

export function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

    const claims = readClaims(request.cookies.get(SESSION_COOKIE)?.value);
    if (!claims) {
        const login = new URL('/login', request.url);
        if (pathname !== '/') login.searchParams.set('next', pathname + search);
        return NextResponse.redirect(login);
    }

    if (claims.role === 'TECHNICIAN') {
        const allowed = claims.tid ? TECHNICIAN_PATHS(claims.tid) : [];
        if (!allowed.some((p) => pathname === p || pathname.startsWith(p))) {
            return NextResponse.redirect(new URL(homeFor(claims), request.url));
        }
    }
    return NextResponse.next();
}

export const config = {
    // Tout sauf les fichiers statiques et internes de Next
    matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)'],
};
