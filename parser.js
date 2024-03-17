function parse(query) {
    console.log(query);
    searchDirectory(query.directory);
}

function searchDirectory(directory) {
    throw new Error('Not implemented');
}

module.exports = parse;