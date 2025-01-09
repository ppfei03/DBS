const express = require('express');
const { DynamoDBClient, ScanCommand, QueryCommand } = require('@aws-sdk/client-dynamodb');
const path = require('path');
const { exec } = require('child_process');
const winston = require('winston');

const app = express();
const PORT = 3000;

// Logger konfigurieren
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'server.log' })
    ],
});

// DynamoDB Client konfigurieren
const dynamoDbClient = new DynamoDBClient({ region: 'us-east-1' });

// Middleware zur Protokollierung der eingehenden Verbindungen
app.use((req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    logger.info(`Neue Verbindung von: ${clientIp} - ${req.method} ${req.url}`);
    next();
});

// Zentrale Fehlerbehandlungs-Middleware
app.use((err, req, res, next) => {
    logger.error(err.message);
    res.status(500).json({ error: err.message });
});

// Funktion zum Ausführen von Python-Skripten
const runPythonScript = (scriptName, res) => {
    const scriptPath = path.join(__dirname, 'scripts', scriptName);
    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            logger.error(`Fehler beim Ausführen des Python-Skripts: ${error.message}`);
            res.status(500).send(`Fehler beim Ausführen des Skripts: ${error.message}`);
        } else if (stderr) {
            logger.error(`Fehler im Python-Skript: ${stderr}`);
            res.status(500).send(`Fehler im Skript: ${stderr}`);
        } else {
            logger.info(`Ergebnis des Python-Skripts: ${stdout}`);
            res.send(`Skript erfolgreich ausgeführt: ${stdout}`);
        }
    });
};

// API-Route für DynamoDB-Scans mit Limitierung und Paginierung
const dynamoDbScan = async (tableName, res, limit = 10, lastKey = null, retryCount = 0) => {
    const params = { TableName: tableName, Limit: limit };
    if (lastKey) params.ExclusiveStartKey = JSON.parse(decodeURIComponent(lastKey));

    try {
        const command = new ScanCommand(params);
        const data = await dynamoDbClient.send(command);
        res.json({
            items: data.Items,
            lastKey: data.LastEvaluatedKey ? encodeURIComponent(JSON.stringify(data.LastEvaluatedKey)) : null,
        });
    } catch (err) {
        if (err.name === 'ProvisionedThroughputExceededException' && retryCount < 5) {
            const delay = Math.pow(2, retryCount) * 100; // Exponential backoff
            setTimeout(async () => {
                await dynamoDbScan(tableName, res, limit, lastKey, retryCount + 1);
            }, delay);
        } else {
            logger.error(`Fehler beim Abrufen der Daten aus ${tableName}:`, err);
            res.status(500).send(`Fehler beim Abrufen der Daten: ${err.message}`);
        }
    }
};

// DynamoDB-API-Routen
app.get('/api/data/:tableName', async (req, res) => {
    const { tableName } = req.params;
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
        logger.error('Fehler bei der Abfrage:', err);
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
            IndexName: 'UnitIndex',
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

        // 2. Messwerte für jeden Sensor abrufen mit Limitierung und Paginierung
        const measurements = [];
        for (const sensor of sensors) {
            const sensorId = sensor.sensorId.S;

            let lastKey = null;
            let retryCount = 0;
            do {
                const measurementsParams = {
                    TableName: 'MeasurementsTable',
                    FilterExpression: '#sensorId = :sensorIdValue',
                    ExpressionAttributeNames: {
                        '#sensorId': 'sensorId',
                    },
                    ExpressionAttributeValues: {
                        ':sensorIdValue': { S: sensorId },
                    },
                    Limit: 100,  // Limitierung
                    ExclusiveStartKey: lastKey,
                };
                try {
                    const measurementsCommand = new ScanCommand(measurementsParams);
                    const measurementsResponse = await dynamoDbClient.send(measurementsCommand);

                    // Messwerte hinzufügen
                    measurements.push(...measurementsResponse.Items.map(item => ({
                        sensorId: item.sensorId.S,
                        value: item.value.S,
                        createdAt: item.createdAt.S,
                        boxId: item.boxId.S,
                    })));

                    lastKey = measurementsResponse.LastEvaluatedKey;
                } catch (err) {
                    if (err.name === 'ProvisionedThroughputExceededException' && retryCount < 5) {
                        const delay = Math.pow(2, retryCount) * 100; // Exponential backoff
                        await new Promise(resolve => setTimeout(resolve, delay));
                        retryCount++;
                    } else {
                        throw err;
                    }
                }
            } while (lastKey);
        }

        // Ergebnisse zurückgeben
        res.json({ sensors: sensors.length, measurements });
    } catch (err) {
        logger.error('Fehler beim Abrufen der Daten:', err);
        res.status(500).json({ error: 'Fehler beim Abrufen der Daten.', details: err.message });
    }
});

// API: Alle Sensoren und Messwerte abrufen, dann auf dem Server nach Einheit filtern
app.get('/api/all-sensor-measurements', async (req, res) => {
    const { unit } = req.query;

    if (!unit) {
        return res.status(400).json({ error: 'Einheit (unit) muss angegeben werden.' });
    }

    try {
        // Alle Sensoren abrufen
        const sensors = [];
        let lastKey = null;
        do {
            const params = {
                TableName: 'SensorsTable',
                ExclusiveStartKey: lastKey,
            };
            const command = new ScanCommand(params);
            const data = await dynamoDbClient.send(command);
            
            sensors.push(...data.Items);
            lastKey = data.LastEvaluatedKey;
        } while (lastKey);

        // Alle Messwerte abrufen
        const measurements = [];
        lastKey = null;
        do {
            const params = {
                TableName: 'MeasurementsTable',
                ExclusiveStartKey: lastKey,
            };
            const command = new ScanCommand(params);
            const data = await dynamoDbClient.send(command);
            
            measurements.push(...data.Items);
            lastKey = data.LastEvaluatedKey;
        } while (lastKey);

        // Sensoren nach Einheit filtern
        const filteredSensors = sensors.filter(sensor => sensor.unit.S === unit);

        // Messwerte nach gefilterten Sensoren filtern
        const filteredMeasurements = measurements.filter(measurement => 
            filteredSensors.some(sensor => sensor.sensorId.S === measurement.sensorId.S)
        );

        res.json({ sensors: filteredSensors, measurements: filteredMeasurements });
    } catch (err) {
        logger.error('Fehler beim Abrufen der Daten:', err);
        res.status(500).json({ error: 'Fehler beim Abrufen der Daten.', details: err.message });
    }
});

// Server starten
const server = app.listen(PORT, () => {
    logger.info(`Server läuft auf http://localhost:${PORT}`);
});

server.timeout = 300000; // 300 Sekunden (5 Minuten)
