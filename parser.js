const fs = require('fs');
const path = require('path');
const hex = require('string-hex');

function parse(query) {
    console.log(query);
    return searchDirectory(query.path, query.signatures);
}

function searchDirectory(directory, signatures) {
    let oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

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
                date: stats.mtime.toString(),
                size: stats.size,
                buffer: buffer.toString('base64')
            });
        }
    }

    return results;
}

function parseFileSig(filePath, signatures) {
    signatures = signatures.map((signature) => signature.toLowerCase());
    const data = fs.readFileSync(filePath);
    const hexString = data.toString('hex');
    for (const signature of signatures) {
        if (hexString.includes(signature)) {
            const buffer = parseFileBody(hexString, signature);
            return buffer;
        }
    }
    return null;
}

function parseFileBody(hexString, signature) {
    const body = signature + hexString.split(signature)[1];
    const buffer = Buffer.from(body, 'hex');
    console.log(buffer);
    // fs.writeFileSync("test.png", buffer);
    return buffer;
}

module.exports = parse;

// const filepath = "C:\\Users\\prest\\AppData\\Local\\Temp\\Roblox\\http\\4fe333ca69da81e72ed47f18333d8300";

// (async () => {
//     if (await parseFileSig(filepath, ["89504E470D0A1A0A".toLowerCase()])) {
//         console.log('Found file');
//     }
// })()