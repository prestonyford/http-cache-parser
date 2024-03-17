const express = require('express');
const app = express();

const PORT = 4000;

app.use(express.static('public'));

// Use Cache-Control: no-store

app.get('/search', (req, res) => {
    const query = req.query;
    query.signatures = decodeURIComponent(query.signatures);
    query.signatures = JSON.parse(query.signatures);
    res.set('Cache-Control', 'no-store');
    res.send('Received');
});

app.listen(PORT, () => console.log('Listening on port ' + PORT));