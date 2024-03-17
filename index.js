const express = require('express');
const parse = require('./parser.js');
const app = express();

const PORT = 4000;

app.use(express.static('public'));

// Use Cache-Control: no-store

app.get('/search', async (req, res, next) => {
    let query = req.query;
    query.path = decodeURIComponent(query.path);
    query.signatures = decodeURIComponent(query.signatures);
    query.signatures = JSON.parse(query.signatures);
    try {
        const results = parse(query);
        res.setHeader('Cache-Control', 'no-store');
        res.send('Received');
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(400).send(err.message);
});

app.listen(PORT, () => console.log('Listening on port ' + PORT));