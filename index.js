const express = require('express');
const parse = require('./parser.js');
const app = express();

const PORT = 4000;

app.use(express.static('public'));

// Use Cache-Control: no-store

app.get('/search', (req, res) => {
    const query = req.query;
    query.signatures = decodeURIComponent(query.signatures);
    query.signatures = JSON.parse(query.signatures);
    const results = parse(query);
    res.set('Cache-Control', 'no-store');
    res.send('Received');
});

app.use((err, req, res, next) => {
    console.error(err.message);
    res.status(400).send(err.message);
});

app.listen(PORT, () => console.log('Listening on port ' + PORT));