import { decodePngDataUrl, detectFileType } from './file-types.js';

const pad = (bytes: number[]) => Buffer.from([...bytes, ...new Array(16).fill(0)]);

describe('detectFileType', () => {
    it('reconnaît images et audio par leur signature', () => {
        expect(detectFileType(pad([0xff, 0xd8, 0xff, 0xe0]))?.mimeType).toBe('image/jpeg');
        expect(detectFileType(pad([0x89, 0x50, 0x4e, 0x47]))?.mimeType).toBe('image/png');
        expect(detectFileType(Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBP'), Buffer.alloc(8)]))?.mimeType).toBe('image/webp');
        expect(detectFileType(pad([0x1a, 0x45, 0xdf, 0xa3]))?.family).toBe('audio');
        expect(detectFileType(Buffer.concat([Buffer.from('OggS'), Buffer.alloc(12)]))?.mimeType).toBe('audio/ogg');
    });

    it('rejette un fichier quelconque déguisé', () => {
        expect(detectFileType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
        expect(detectFileType(Buffer.from('MZ\x90\0executable...'))).toBeNull();
    });
});

describe('decodePngDataUrl', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(16).fill(0)]);

    it('décode une signature PNG', () => {
        expect(decodePngDataUrl(`data:image/png;base64,${png.toString('base64')}`)?.length).toBe(png.length);
    });

    it('refuse un autre contenu', () => {
        expect(decodePngDataUrl(`data:image/png;base64,${Buffer.from('pas une image, juste du texte').toString('base64')}`)).toBeNull();
        expect(decodePngDataUrl('data:text/html;base64,PGh0bWw+')).toBeNull();
    });
});
