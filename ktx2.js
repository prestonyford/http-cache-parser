const zlib = require('zlib');

// Converts KTX2 textures (as stored in the Roblox cache) to PNG so they can be previewed in the browser.
// Only the largest mip level is decoded. Supports BC1 and BC3 block compression, optionally Zstandard supercompressed.

const VK_FORMAT = {
    131: 'bc1', 132: 'bc1',             // BC1_RGB_UNORM, BC1_RGB_SRGB
    133: 'bc1a', 134: 'bc1a',           // BC1_RGBA_UNORM, BC1_RGBA_SRGB
    137: 'bc3', 138: 'bc3',             // BC3_UNORM, BC3_SRGB
    37: 'rgba8', 43: 'rgba8'            // R8G8B8A8_UNORM, R8G8B8A8_SRGB
};

const SUPERCOMPRESSION_NONE = 0;
const SUPERCOMPRESSION_ZSTD = 2;

function ktx2ToPng(data) {
    const { width, height, format, pixels } = decodeKtx2(data);
    return { png: encodePng(width, height, pixels), width, height, format };
}

function decodeKtx2(data) {
    const vkFormat = data.readUInt32LE(12);
    const width = data.readUInt32LE(20);
    const height = Math.max(1, data.readUInt32LE(24));
    const supercompression = data.readUInt32LE(44);

    const format = VK_FORMAT[vkFormat];
    if (!format) {
        throw new Error(`Unsupported KTX2 vkFormat ${vkFormat}`);
    }

    // Level index starts at byte 80; level 0 is the full size image
    const levelOffset = Number(data.readBigUInt64LE(80));
    const levelLength = Number(data.readBigUInt64LE(88));
    let level = data.subarray(levelOffset, levelOffset + levelLength);

    if (supercompression === SUPERCOMPRESSION_ZSTD) {
        level = zlib.zstdDecompressSync(level);
    } else if (supercompression !== SUPERCOMPRESSION_NONE) {
        throw new Error(`Unsupported KTX2 supercompression scheme ${supercompression}`);
    }

    let pixels;
    if (format === 'rgba8') {
        pixels = Buffer.from(level.subarray(0, width * height * 4));
    } else {
        pixels = decodeBlocks(level, width, height, format);
    }
    return { width, height, format, pixels };
}

// Decodes BCn 4x4 blocks into an RGBA pixel buffer
function decodeBlocks(level, width, height, format) {
    const pixels = Buffer.alloc(width * height * 4);
    const blockSize = format === 'bc3' ? 16 : 8;
    const blocksX = Math.ceil(width / 4);
    const blocksY = Math.ceil(height / 4);
    const block = new Uint8Array(64);

    for (let by = 0; by < blocksY; by++) {
        for (let bx = 0; bx < blocksX; bx++) {
            const offset = (by * blocksX + bx) * blockSize;
            if (format === 'bc3') {
                decodeBc1Block(level, offset + 8, block, false, false);
                decodeBc3Alpha(level, offset, block);
            } else {
                decodeBc1Block(level, offset, block, true, format === 'bc1a');
            }

            // Copy the block into the image, clipping at the right and bottom edges
            for (let y = 0; y < 4 && by * 4 + y < height; y++) {
                for (let x = 0; x < 4 && bx * 4 + x < width; x++) {
                    const dst = ((by * 4 + y) * width + bx * 4 + x) * 4;
                    const src = (y * 4 + x) * 4;
                    pixels[dst] = block[src];
                    pixels[dst + 1] = block[src + 1];
                    pixels[dst + 2] = block[src + 2];
                    pixels[dst + 3] = block[src + 3];
                }
            }
        }
    }
    return pixels;
}

// Scratch palettes reused across blocks to avoid allocating per block
const palette = new Uint8Array(16);
const alphas = new Uint8Array(8);

function writeRgb565(value, out, offset) {
    const r = (value >> 11) & 0x1f;
    const g = (value >> 5) & 0x3f;
    const b = value & 0x1f;
    out[offset] = (r << 3) | (r >> 2);
    out[offset + 1] = (g << 2) | (g >> 4);
    out[offset + 2] = (b << 3) | (b >> 2);
    out[offset + 3] = 255;
}

function decodeBc1Block(data, offset, out, allowThreeColor, punchThroughAlpha) {
    const c0 = data[offset] | (data[offset + 1] << 8);
    const c1 = data[offset + 2] | (data[offset + 3] << 8);
    const indices = data.readUInt32LE(offset + 4);
    writeRgb565(c0, palette, 0);
    writeRgb565(c1, palette, 4);

    if (c0 > c1 || !allowThreeColor) {
        for (let i = 0; i < 3; i++) {
            palette[8 + i] = Math.round((2 * palette[i] + palette[4 + i]) / 3);
            palette[12 + i] = Math.round((palette[i] + 2 * palette[4 + i]) / 3);
        }
        palette[11] = 255;
        palette[15] = 255;
    } else {
        for (let i = 0; i < 3; i++) {
            palette[8 + i] = Math.round((palette[i] + palette[4 + i]) / 2);
            palette[12 + i] = 0;
        }
        palette[11] = 255;
        palette[15] = punchThroughAlpha ? 0 : 255;
    }

    for (let i = 0; i < 16; i++) {
        const p = ((indices >>> (2 * i)) & 3) * 4;
        out[i * 4] = palette[p];
        out[i * 4 + 1] = palette[p + 1];
        out[i * 4 + 2] = palette[p + 2];
        out[i * 4 + 3] = palette[p + 3];
    }
}

function decodeBc3Alpha(data, offset, out) {
    const a0 = data[offset];
    const a1 = data[offset + 1];
    alphas[0] = a0;
    alphas[1] = a1;
    if (a0 > a1) {
        for (let i = 1; i <= 6; i++) alphas[i + 1] = Math.round(((7 - i) * a0 + i * a1) / 7);
    } else {
        for (let i = 1; i <= 4; i++) alphas[i + 1] = Math.round(((5 - i) * a0 + i * a1) / 5);
        alphas[6] = 0;
        alphas[7] = 255;
    }

    // 48 bits of 3-bit indices, read as two 24-bit halves of 8 indices each
    for (let half = 0; half < 2; half++) {
        const o = offset + 2 + half * 3;
        const bits = data[o] | (data[o + 1] << 8) | (data[o + 2] << 16);
        for (let i = 0; i < 8; i++) {
            out[(half * 8 + i) * 4 + 3] = alphas[(bits >> (3 * i)) & 7];
        }
    }
}

function encodePng(width, height, pixels) {
    // Each row is prefixed with filter type 0 (none)
    const raw = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) {
        pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;  // bit depth
    ihdr[9] = 6;  // color type RGBA

    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        pngChunk('IHDR', ihdr),
        // Fastest compression level: these PNGs are generated on demand for previews
        pngChunk('IDAT', zlib.deflateSync(raw, { level: 1 })),
        pngChunk('IEND', Buffer.alloc(0))
    ]);
}

function pngChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(typeAndData));
    return Buffer.concat([length, typeAndData, crc]);
}

module.exports = { ktx2ToPng };
