const express = require('express');
const { parse, category } = require('./parser.js');
const app = express();

const PORT = 4000;

app.use(express.static('public'));

// Use Cache-Control: no-store

app.get('/search', async (req, res, next) => {
    let query = req.query;
    query.path = decodeURIComponent(query.path);
    query.signatures = JSON.parse(decodeURIComponent(query.signatures));
    query.timeframe = decodeURIComponent(query.timeframe);
    try {
        const results = parse(query);
        res.setHeader('Cache-Control', 'no-store');
        // res.setHeader('Content-Type', `${category[query.signatures[0]][0]}/${category[query.signatures[0]][1]}`);
        // res.setHeader('Content-length', results.size);
        res.status(200);
        res.send(results);
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(400).send(err.message);
});

app.listen(PORT, () => console.log('Listening on port ' + PORT));