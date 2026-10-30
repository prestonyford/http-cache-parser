const fs = require('fs');
const path = require('path');
const { ktx2ToPng } = require('./ktx2.js');

const fileTypeToSignatures = {
    // "pdf": ["%PDF-"],
    "png": ["89 50 4E 47 0D 0A 1A 0A"],
    "jpg": ["FF D8 FF E0", "FF D8 FF EE", "FF D8 FF DB", "FF D8 FF E0 00 10 4A 46 49 46 00 01", "FF D8 FF E1 ?? ?? 45 78 69 66 00 00", "FF D8 FF E8", "FF 4F FF 51", "00 00 00 0C 4A 58 4C 20 0D 0A 87 0A", "FF 0A"], // missing FF D8 FF E1 ?? ?? 45 78 69 66 00 00
    // "gif": ["GIF87a", "GIF89a"],
    "webp": ["52 49 46 46 ?? ?? ?? ?? 57 45 42 50"],
    "zip": ["50 4B 03 04", "50 4B 05 06", "50 4B 07 08"],
    "exe": ["4D 5A"],
    "mp3": ["49 44 33", "FF FB", "FF F3"],
    "ogg": ["4F 67 67 53"],
    "ktx2": ["AB 4B 54 58 20 32 30 BB 0D 0A 1A 0A"],
    // "webp": ["WEBP"]
};

const extMap = ext => {
    switch (ext) {
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp':
        case 'ktx2':
            return 'image';
        case 'mp3':
        case 'ogg':
            return 'audio';
    }
}

const category = {}
Object.entries(fileTypeToSignatures).forEach(([ext, sigs]) => {
    sigs.forEach(sig => {
        category[sig.toLowerCase().replace(/\s/g, '')] = [extMap(ext), ext === "jpg" ? "jpeg" : ext]
    })
})

function parse(query) {
    if (query.signatures.length === 0 || query.signatures[0] === "") {
        throw new Error("No signatures provided");
    }
    if (query.timeframe !== "all" && !query.timeframe.match(/^\d{1,2}:\d{1,2}$/)) {
        throw new Error("Invalid timeframe format");
    }

    let timeframe;
    if (query.timeframe === "all") {
        timeframe = new Date(0);
    } else {
        timeframe = new Date();
        timeframe.setHours(timeframe.getHours() - parseInt(query.timeframe.split(':')[0]));
        timeframe.setMinutes(timeframe.getMinutes() - parseInt(query.timeframe.split(':')[1]));
    }

    // Signatures all lowercase and no spaces
    return searchDirectory(query.path, timeframe, query.signatures.map((sig) => sig.toLowerCase().replace(/\s/g, '')));
}

// Recursively collects files under directory modified after timeframe
function collectFiles(directory, timeframe) {
    let files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files = files.concat(collectFiles(fullPath, timeframe));
        } else if (entry.isFile()) {
            const stats = fs.statSync(fullPath);
            if (stats.mtime > timeframe) {
                files.push({ fullPath, stats });
            }
        }
    }
    return files;
}

function searchDirectory(directory, timeframe, signatures) {
    const files = collectFiles(directory, timeframe);

    let results = []

    for (const { fullPath, stats } of files) {
        const [buffer, sig] = parseFileSig(fullPath, signatures);
        if (buffer !== null) {
            // File contents are not included here; they are fetched individually with getFileBody
            results.push({
                name: path.relative(directory, fullPath),
                path: fullPath,
                signature: sig,
                type: sigToType(sig),
                date: stats.mtime.toLocaleString(),
                size: stats.size
            });
        }
    }

    return results;
}

function sigToType(sig) {
    return category[sig] ? `${category[sig][0]}/${category[sig][1]}` : "image/png";
}

// Returns the body of a single file matched by a previous search, or null if it no longer matches
function getFileBody(filePath, signature) {
    signature = signature.toLowerCase().replace(/\s/g, '');
    const [buffer, sig] = parseFileSig(filePath, [signature]);
    if (buffer === null) {
        return null;
    }
    const type = sigToType(sig);
    // Browsers can't display KTX2 textures, so convert them to PNG
    if (type === 'image/ktx2') {
        return { buffer: ktx2ToPng(buffer).png, type: 'image/png' };
    }
    return { buffer, type };
}

// Newer Roblox cache (rbx-storage) entries use a binary "RBXH" header instead of raw HTTP headers:
//   "RBXH" | u32 version | u32 urlLength | url | u8 | u32 status | u32 headersLength | u32 headersHash
//   | u32 bodyLength | u32 bodyHash | u32 unknown | headers | body
// Returns the body, or null if the data is not a valid RBXH entry
function parseRbxhBody(data) {
    if (data.length < 12 || data.toString('latin1', 0, 4) !== 'RBXH') {
        return null;
    }
    let offset = 12 + data.readUInt32LE(8) + 1;
    if (offset + 24 > data.length) {
        return null;
    }
    const headersLength = data.readUInt32LE(offset + 4);
    const bodyLength = data.readUInt32LE(offset + 12);
    offset += 24 + headersLength;
    if (offset + bodyLength !== data.length) {
        return null;
    }
    return data.subarray(offset);
}

function parseFileSig(filePath, signatures) {
    // All lowercase and no spaces
    const data = fs.readFileSync(filePath);

    const rbxhBody = parseRbxhBody(data);
    if (rbxhBody !== null) {
        // Body starts directly with the file contents, so only match at the start
        const hexBody = rbxhBody.toString('hex');
        for (const signature of signatures) {
            if (new RegExp(`^${signature.replace(/\?/g, '.')}`).test(hexBody)) {
                return [rbxhBody, signature];
            }
        }
        return [null, null];
    }

    const hexString = data.toString('hex');

    for (const signature of signatures) {
        const regex = sigToRegex(signature);
        const match = regex.exec(hexString);
        if (match) {
            return [parseFileBody(match), signature];
        }
    }
    return [null, null];
}

function sigToRegex(signature) {
    // Signatures are either at the very beginning of the file or after a CRLF following the header
    // Signatures are NOT GUARANTEED to be at the beginning of the file
    return new RegExp(`(^|0d0a)${signature.replace(/\?/g, '.')}`, 'g');
}

function parseFileBody(match) {
    const offset = match[1].length;
    const body = match.input.substring(match.index + offset);
    const buffer = Buffer.from(body, 'hex');
    return buffer;
}

module.exports = { parse, getFileBody, fileTypeToSignatures };