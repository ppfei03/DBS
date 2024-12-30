const express = require('express');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const path = require('path');

const app = express();
const PORT = 3000;

// DynamoDB Client konfigurieren
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-2' });

// Statische Dateien bereitstellen
app.use(express.static('public'));

// API-Route, um Daten aus DynamoDB zu holen
app.get('/api/data/BoxesTable', async (req, res) => {
    const params = {
        TableName: 'BoxesTable', // Ersetzen Sie dies durch den Namen Ihrer DynamoDB-Tabelle
    };

    try {
        const command = new ScanCommand(params);
        const data = await dynamoDbClient.send(command);
        res.json(data.Items);
    } catch (err) {
        console.error('Fehler beim Abrufen der Daten:', err);
        res.status(500).send('Fehler beim Abrufen der Daten');
    }
});
// API-Route, um Daten aus DynamoDB zu holen
app.get('/api/data/SensorsTable', async (req, res) => {
    const params = {
        TableName: 'SensorsTable', // Ersetzen Sie dies durch den Namen Ihrer DynamoDB-Tabelle
    };

    try {
        const command = new ScanCommand(params);
        const data = await dynamoDbClient.send(command);
        res.json(data.Items);
    } catch (err) {
        console.error('Fehler beim Abrufen der Daten:', err);
        res.status(500).send('Fehler beim Abrufen der Daten');
    }
});

// API-Route, um Daten aus DynamoDB zu holen
app.get('/api/data/SensorsTableLasy', async (req, res) => {
    const { lastKey } = req.query;

    const params = {
        TableName: 'SensorsTable',
        Limit: 50, // Anzahl der Datensätze pro Anfrage
    };

    if (lastKey) {
        params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));
    }

    try {
        const command = new ScanCommand(params);
        const data = await dynamoDbClient.send(command);

        res.json({
            items: data.Items,
            lastKey: data.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(data.LastEvaluatedKey)) : null,
        });
    } catch (err) {
        console.error('Fehler beim Abrufen der Daten:', err);
        res.status(500).send('Fehler beim Abrufen der Daten');
    }
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
