const express = require('express');
const app = express();

const DB_PASSWORD = process.env.DB_PASSWORD;

app.get('/login', (req, res) => {
    const user = req.query.user;

    console.log(`User logged in: ${user}`);

    res.send("Logged In");
});

app.listen(3000);