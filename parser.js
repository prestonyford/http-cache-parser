const fs = require('fs');
const path = require('path');
const hex = require('string-hex');

function parse(query) {
    console.log(query);
    searchDirectory(query.path, query.signatures);
}

function searchDirectory(directory, signatures) {
    let oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    let files = fs.readdirSync(directory);
    files = files.filter((file) => {
        const stats = fs.statSync(path.join(directory, file));
        return stats.mtime > oneHourAgo;
    });
    
    for (const file of files) {
        console.log(file);
        if (parseFileSig(path.join(directory, file), signatures)) {
            console.log('Found file: ' + file);
        }
    }
}

function parseFileSig(filePath, signatures) {
    // signatures = signatures.map((signature) => encodeString(signature));
    const data = fs.readFileSync(filePath);
    const hexString = data.toString('hex');
    for (const signature of signatures) {
        if (hexString.includes(signature)) {
            return true;
        }
    }
    return false;
}

function parseFileBody(file) {

}

module.exports = parse;

// const filepath = "C:\\Users\\prest\\AppData\\Local\\Temp\\Roblox\\http\\4fe333ca69da81e72ed47f18333d8300";

// (async () => {
//     if (await parseFileSig(filepath, ["89504E470D0A1A0A".toLowerCase()])) {
//         console.log('Found file');
//     }
// })()