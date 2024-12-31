const express = require('express');
const { DynamoDBClient, ScanCommand, QueryCommand  } = require('@aws-sdk/client-dynamodb');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3000;

// DynamoDB Client konfigurieren
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });

// CORS konfigurieren
const allowedOrigins = ['https://dbs.philipppfeiffer.de','https://api.philipppfeiffer.de']

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Zugriff nicht erlaubt.'));
        }
    },
}));





// Middleware zur Protokollierung der eingehenden Verbindungen
app.use((req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log(`Neue Verbindung von: ${clientIp} - ${req.method} ${req.url}`);
    next();
});


/**
// Statische Dateien bereitstellen
app.use(express.static('public'));

 
// Standardroute für den Zugriff auf index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dynamisches Routing für HTML-Dateien
app.get('/:file', (req, res, next) => {
    const fileName = `${req.params.file}.html`; // Anhängen von `` an den Dateinamen
    const filePath = path.join(__dirname, 'public', fileName);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error(`Fehler beim Laden der Datei: ${filePath}`);
            res.status(404).send('Seite nicht gefunden');
        }
    });
});
*/
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
app.get('/run-python/deleteDataAndTable', (req, res) => runPythonScript('deleteTablesAndData.py', res));
app.get('/run-python/deleteAllData', (req, res) => runPythonScript('deleteTablesAndData.py', res));
app.get('/run-python/insertTable', (req, res) => runPythonScript('insertTables.py', res));


// API-Route für die Abfrage
app.get('/api/sensors', async (req, res) => {
    const { unit } = req.query;

    if (!unit) {
        return res.status(400).json({ error: 'Einheit (unit) ist erforderlich.' });
    }

    const params = {
        TableName: 'SensorsTable',
        IndexName: 'UnitIndex',
        KeyConditionExpression: '#unit = :unitValue',
        ExpressionAttributeNames: {
            '#unit': 'unit',
        },
        ExpressionAttributeValues: {
            ':unitValue': { S: unit },
        },
    };

    try {
        const command = new QueryCommand(params);
        const data = await dynamoDbClient.send(command);

        res.json({
            items: data.Items,
            count: data.Count,
            scannedCount: data.ScannedCount,
        });
    } catch (err) {
        console.error('Fehler bei der Abfrage:', err);
        res.status(500).json({ error: 'Fehler beim Abrufen der Daten.', details: err.message });
    }
});


// API: Sensoren mit einer bestimmten Einheit und ihre Messwerte abrufen
app.get('/api/sensor-measurements', async (req, res) => {
    const { unit } = req.query;

    if (!unit) {
        return res.status(400).json({ error: 'Einheit (unit) muss angegeben werden.' });
    }

    try {
        // 1. Sensoren mit der gewünschten Einheit abrufen
        const sensorsParams = {
            TableName: 'SensorsTable',
            IndexName: 'UnitIndex', // GSI für 'unit'
            KeyConditionExpression: '#unit = :unitValue',
            ExpressionAttributeNames: {
                '#unit': 'unit',
            },
            ExpressionAttributeValues: {
                ':unitValue': { S: unit },
            },
        };
        const sensorsCommand = new QueryCommand(sensorsParams);
        const sensorsResponse = await dynamoDbClient.send(sensorsCommand);
        const sensors = sensorsResponse.Items || [];

        if (sensors.length === 0) {
            return res.json({ message: 'Keine Sensoren mit der angegebenen Einheit gefunden.', measurements: [] });
        }

        // 2. Messwerte für jeden Sensor abrufen
        const measurements = [];
        for (const sensor of sensors) {
            const sensorId = sensor.sensorId.S;

            // Messwerte für den aktuellen Sensor abrufen
            const measurementsParams = {
                TableName: 'MeasurementsTable',
                FilterExpression: '#sensorId = :sensorIdValue',
                ExpressionAttributeNames: {
                    '#sensorId': 'sensorId',
                },
                ExpressionAttributeValues: {
                    ':sensorIdValue': { S: sensorId },
                },
            };
            const measurementsCommand = new ScanCommand(measurementsParams);
            const measurementsResponse = await dynamoDbClient.send(measurementsCommand);

            // Messwerte hinzufügen
            measurements.push(...measurementsResponse.Items.map(item => ({
                sensorId: item.sensorId.S,
                value: item.value.S,
                createdAt: item.createdAt.S,
                boxId: item.boxId.S,
            })));
        }

        // Ergebnisse zurückgeben
        res.json({ sensors: sensors.length, measurements });
    } catch (err) {
        console.error('Fehler beim Abrufen der Daten:', err);
        res.status(500).json({ error: 'Fehler beim Abrufen der Daten.', details: err.message });
    }
});

/** 
// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
*/

const server = app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});

server.timeout = 300000; // 300 Sekunden (5 Minuten)