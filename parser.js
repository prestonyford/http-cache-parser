const fs = require('fs');
const path = require('path');

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
    // "webp": ["WEBP"]
};

const extMap = ext => {
    switch (ext) {
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'webp':
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
    if (!query.timeframe.match(/^\d{1,2}:\d{1,2}$/)) {
        throw new Error("Invalid timeframe format");
    }

    const timeframe = new Date();
    timeframe.setHours(timeframe.getHours() - parseInt(query.timeframe.split(':')[0]));
    timeframe.setMinutes(timeframe.getMinutes() - parseInt(query.timeframe.split(':')[1]));

    // Signatures all lowercase and no spaces
    return searchDirectory(query.path, timeframe, query.signatures.map((sig) => sig.toLowerCase().replace(/\s/g, '')));
}

function searchDirectory(directory, timeframe, signatures) {
    let files = fs.readdirSync(directory);
    files = files.filter((file) => {
        const stats = fs.statSync(path.join(directory, file));
        return stats.mtime > timeframe;
    });

    let results = []
    
    for (const file of files) {
        const buffer = parseFileSig(path.join(directory, file), signatures);
        if (buffer != null) {
            const stats = fs.statSync(path.join(directory, file));
            results.push({
                name: file,
                type: category[signatures[0]] ? category[signatures[0]][0] : "image/png",
                date: stats.mtime.toLocaleString(),
                size: stats.size,
                buffer: buffer.toString('base64')
            });
        }
    }

    return results;
}

function parseFileSig(filePath, signatures) {
    // All lowercase and no spaces
    const data = fs.readFileSync(filePath);
    const hexString = data.toString('hex');

    for (const signature of signatures) {
        const regex = sigToRegex(signature);
        const match = regex.exec(hexString);
        if (match) {
            return parseFileBody(match);
        }
    }
    return null;
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

module.exports = { parse, fileTypeToSignatures };