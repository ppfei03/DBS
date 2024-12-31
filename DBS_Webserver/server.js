const express = require('express');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3000;

// DynamoDB Client konfigurieren
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });

// CORS konfigurieren
app.use(cors({
    origin: ['https://dbs.philipppfeiffer.de','https://api.philipppfeiffer.de'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

//app.use(cors())

// Statische Dateien bereitstellen
app.use(express.static('public'));

// Middleware zur Protokollierung der eingehenden Verbindungen
app.use((req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(`Neue Verbindung von: ${clientIp} - ${req.method} ${req.url}`);
    next();
});

// Standardroute für den Zugriff auf index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dynamisches Routing für HTML-Dateien
app.get('/:file', (req, res) => {
    const filePath = path.join(__dirname, 'public', req.params.file);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Fehler beim Laden der Datei: ${filePath}`);
            res.status(404).send('Seite nicht gefunden');
        }
    });
});

// Funktion zum Ausführen von Python-Skripten
const runPythonScript = (scriptName, res) => {
    const scriptPath = path.join(__dirname, 'scripts', scriptName);
    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Fehler beim Ausführen des Python-Skripts: ${error.message}`);
            res.status(500).send(`Fehler beim Ausführen des Skripts: ${error.message}`);
        } else if (stderr) {
            console.error(`Fehler im Python-Skript: ${stderr}`);
            res.status(500).send(`Fehler im Skript: ${stderr}`);
        } else {
            console.log(`Ergebnis des Python-Skripts: ${stdout}`);
            res.send(`Skript erfolgreich ausgeführt: ${stdout}`);
        }
    });
};

// API-Route für DynamoDB-Scans
const dynamoDbScan = async (tableName, res, limit = null, lastKey = null) => {
    const params = { TableName: tableName };
    if (limit) params.Limit = limit;
    if (lastKey) params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));

    try {
        const command = new ScanCommand(params);
        const data = await dynamoDbClient.send(command);
        res.json({
            items: data.Items,
            lastKey: data.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(data.LastEvaluatedKey)) : null,
        });
    } catch (err) {
        console.error(`Fehler beim Abrufen der Daten aus ${tableName}:`, err);
        res.status(500).send(`Fehler beim Abrufen der Daten: ${err.message}`);
    }
};

// DynamoDB-API-Routen

app.get('/api/data/:tableName', async (req, res) => {
    const { tableName } = req.params;
    //tableName = tableName.replace("Lasy", "");
    const { lastKey } = req.query;
    await dynamoDbScan(tableName, res, 50, lastKey);
});

// Python-Skript-API-Routen
app.get('/run-python/insertData', (req, res) => runPythonScript('importDataToDynamoDB.py', res));
app.get('/run-python/insertDataMeasure', (req, res) => runPythonScript('importMeasureToDynamoDB.py', res));
app.get('/run-python/deleteData', (req, res) => runPythonScript('deleteTablesAndData.py', res));
app.get('/run-python/deleteAllData', (req, res) => runPythonScript('deleteAllItems.py', res));

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
