const express = require('express');
const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const path = require('path');
const { exec } = require('child_process');

const app = express();
const PORT = 3000;

// DynamoDB Client konfigurieren
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });

// Statische Dateien bereitstellen
//app.use(express.static('public'));

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

// API-Route, um Daten aus DynamoDB zu holen
app.get('/api/data/BoxesTableLasy', async (req, res) => {
    const { lastKey } = req.query;

    const params = {
        TableName: 'BoxesTable',
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

// API-Route, um Daten aus DynamoDB zu holen
app.get('/api/data/MeasurementsTableLasy', async (req, res) => {
    const { lastKey } = req.query;

    const params = {
        TableName: 'MeasurementsTable',
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

// API-Route zum Ausführen des Python-Skripts
app.get('/run-python/insertData', (req, res) => {
    // Relativer Pfad zum Python-Skript
    const scriptPath = path.join(__dirname, 'scripts', 'ImportDataToDynamoDB.py');

    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Fehler beim Ausführen des Python-Skripts: ${error.message}`);
            return res.status(500).send('Fehler beim Ausführen des Skripts.');
        }
        if (stderr) {
            console.error(`Fehler im Python-Skript: ${stderr}`);
            return res.status(500).send(`Fehler im Skript: ${stderr}`);
        }
        console.log(`Ergebnis des Python-Skripts: ${stdout}`);
        res.send(`Skript erfolgreich ausgeführt: ${stdout}`);
    });
});

// API-Route zum Ausführen des Python-Skripts
app.get('/run-python/insertDataMeasure', (req, res) => {
    // Relativer Pfad zum Python-Skript
    const scriptPath = path.join(__dirname, 'scripts', 'ImportMeasureToDynamoDB.py');

    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Fehler beim Ausführen des Python-Skripts: ${error.message}`);
            return res.status(500).send('Fehler beim Ausführen des Skripts.');
        }
        if (stderr) {
            console.error(`Fehler im Python-Skript: ${stderr}`);
            return res.status(500).send(`Fehler im Skript: ${stderr}`);
        }
        console.log(`Ergebnis des Python-Skripts: ${stdout}`);
        res.send(`Skript erfolgreich ausgeführt: ${stdout}`);
    });
});
    // API-Route zum Ausführen des Python-Skripts
app.get('/run-python/deleteData', (req, res) => {
    // Relativer Pfad zum Python-Skript
    const scriptPath = path.join(__dirname, 'scripts', 'delteTablesAndData.py');
    
        exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
            if (error) {
                console.error(`Fehler beim Ausführen des Python-Skripts: ${error.message}`);
                return res.status(500).send('Fehler beim Ausführen des Skripts.');
            }
            if (stderr) {
                console.error(`Fehler im Python-Skript: ${stderr}`);
                return res.status(500).send(`Fehler im Skript: ${stderr}`);
            }
            console.log(`Ergebnis des Python-Skripts: ${stdout}`);
            res.send(`Skript erfolgreich ausgeführt: ${stdout}`);
        });
    });

app.get('/run-python/deleteAllData', (req, res) => {
        // Relativer Pfad zum Python-Skript
        const scriptPath = path.join(__dirname, 'scripts', 'deleteAllItems.py');
        
            exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Fehler beim Ausführen des Python-Skripts: ${error.message}`);
                    return res.status(500).send('Fehler beim Ausführen des Skripts.');
                }
                if (stderr) {
                    console.error(`Fehler im Python-Skript: ${stderr}`);
                    return res.status(500).send(`Fehler im Skript: ${stderr}`);
                }
                console.log(`Ergebnis des Python-Skripts: ${stdout}`);
                res.send(`Skript erfolgreich ausgeführt: ${stdout}`);
            });
        });

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
});
