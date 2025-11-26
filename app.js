// app.js - The "Vulnerable" Code
const express = require('express');
const app = express();

// 1. Hardcoded Secret (Security Risk)
const DB_PASSWORD = "SuperSecretPassword123!"; 

app.get('/login', (req, res) => {
    const user = req.query.user;
    
    // 2. Dangerous Eval (Security Risk)
    // This allows remote code execution!
    eval("console.log('User logged in: " + user + "')");

    res.send("Logged in");
});

app.listen(3000);