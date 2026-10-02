// Identification des fichiers par leur signature binaire (et non par l'extension
// ou le type annoncé par le navigateur, falsifiables).

export interface DetectedType {
    mimeType: string;
    extension: string;
    family: 'image' | 'audio';
}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString('ascii');

export function detectFileType(buf: Buffer): DetectedType | null {
    if (buf.length < 12) return null;
    if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', extension: 'jpg', family: 'image' };
    if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return { mimeType: 'image/png', extension: 'png', family: 'image' };
    if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return { mimeType: 'image/webp', extension: 'webp', family: 'image' };
    if (ascii(buf, 4, 8) === 'ftyp') {
        const brand = ascii(buf, 8, 12);
        if (['heic', 'heix', 'mif1', 'msf1'].includes(brand)) return { mimeType: 'image/heic', extension: 'heic', family: 'image' };
        return { mimeType: 'audio/mp4', extension: 'm4a', family: 'audio' };
    }
    if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return { mimeType: 'audio/webm', extension: 'webm', family: 'audio' };
    if (ascii(buf, 0, 4) === 'OggS') return { mimeType: 'audio/ogg', extension: 'ogg', family: 'audio' };
    if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WAVE') return { mimeType: 'audio/wav', extension: 'wav', family: 'audio' };
    if (ascii(buf, 0, 3) === 'ID3' || startsWith(buf, [0xff, 0xfb]) || startsWith(buf, [0xff, 0xf3])) {
        return { mimeType: 'audio/mpeg', extension: 'mp3', family: 'audio' };
    }
    return null;
}

/** "data:image/png;base64,…" → Buffer (PNG uniquement, pour les signatures). */
export function decodePngDataUrl(dataUrl: string): Buffer | null {
    const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if (!match) return null;
    const buf = Buffer.from(match[1], 'base64');
    return detectFileType(buf)?.mimeType === 'image/png' ? buf : null;
}
