const fs = require('fs');
const path = require('path');

const category = Object.fromEntries(
    Object.entries({
        "89 50 4E 47 0D 0A 1A 0A" : ["image", "png"],
        "FF D8 FF DB" : ["image", "jpeg"],
        "FF D8 FF E0 00 10 4A 46 49 46 00 01" : ["image", "jpeg"],
        "FF D8 FF E8" : ["image", "jpeg"],
        "FF D8 FF EE" : ["image", "jpeg"],
        "FF D8 FF E0" : ["image", "jpeg"],
        "49 44 33" : ["audio", "mp3"],
        "FF FB" : ["audio", "mp3"],
        "FF F3" : ["audio", "mp3"],
        "4F 67 67 53" : ["audio", "ogg"],
    }).map(([key, value]) => [key.toLowerCase().replace(/\s/g, ''), value])
);

function parse(query) {
    console.log(query);

    // Signatures all lowercase and no spaces
    return searchDirectory(query.path, query.signatures.map((sig) => sig.toLowerCase().replace(/\s/g, '')));
}

function searchDirectory(directory, signatures) {
    let oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 5);

    let files = fs.readdirSync(directory);
    files = files.filter((file) => {
        const stats = fs.statSync(path.join(directory, file));
        return stats.mtime > oneHourAgo;
    });

    let results = []
    
    for (const file of files) {
        const buffer = parseFileSig(path.join(directory, file), signatures);
        if (buffer != null) {
            const stats = fs.statSync(path.join(directory, file));
            results.push({
                name: file,
                type: category[signatures[0]] ? category[signatures[0]][0] : "image/png",
                date: stats.mtime.toString(),
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
        const regex = new RegExp(signature, 'g');
        const match = regex.exec(hexString);
        if (match) {
            console.log(match.index);
            return parseFileBody(match, signature);
        }
    }
    return null;
}

function parseFileBody(match, signature) {
    const body = signature + match.input.substring(match.index + signature.length);
    const buffer = Buffer.from(body, 'hex');
    // console.log(buffer);
    // fs.writeFileSync("test.png", buffer);
    return buffer;
}

module.exports = { parse, category };