const express = require('express');
const path = require('path');
const { parse, getFileBody, fileTypeToSignatures } = require('./parser.js');
const app = express();

const PORT = 4000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/search', async (req, res, next) => {
    let query = req.query;
    query.path = decodeURIComponent(query.path);
    query.signatures = JSON.parse(decodeURIComponent(query.signatures));
    query.timeframe = decodeURIComponent(query.timeframe);
    try {
        const results = parse(query);
        res.setHeader('Cache-Control', 'no-store');
        res.status(200);
        res.send(results);
    } catch (err) {
        next(err);
    }
});

app.get('/file', async (req, res, next) => {
    try {
        const file = getFileBody(req.query.path, req.query.signature);
        if (file === null) {
            res.status(404).send("File no longer matches signature");
            return;
        }
        res.setHeader('Cache-Control', 'no-store');
        res.type(file.type);
        res.status(200);
        res.send(file.buffer);
    } catch (err) {
        next(err);
    }
});

app.get('/fileTypeToSignatures', async (req, res, next) => {
    try {
        res.status(200);
        res.send(JSON.stringify(fileTypeToSignatures));
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(400).send(err.message);
});

console.log("\nPress CTRL+C to terminate the application")
app.listen(PORT, () => console.log(`Open localhost:${PORT} in your browser`));