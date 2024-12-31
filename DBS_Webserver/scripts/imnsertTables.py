import boto3
import time

# DynamoDB-Client erstellen
dynamodb = boto3.client('dynamodb', region_name='us-east-1')  # Passen Sie die Region an

# Tabelle erstellen
def create_table(params):
    try:
        print(f"Erstelle Tabelle: {params['TableName']}...")
        dynamodb.create_table(**params)
        # Warten, bis die Tabelle erstellt wurde
        waiter = dynamodb.get_waiter('table_exists')
        waiter.wait(TableName=params['TableName'])
        print(f"Tabelle '{params['TableName']}' erfolgreich erstellt.")
    except Exception as e:
        print(f"Fehler beim Erstellen der Tabelle '{params['TableName']}': {e}")

# Definitionen für die Tabellen
tables = [
    {
        "TableName": "BoxesTable",
        "AttributeDefinitions": [
            {"AttributeName": "boxId", "AttributeType": "S"}
        ],
        "KeySchema": [
            {"AttributeName": "boxId", "KeyType": "HASH"}
        ],
        "BillingMode": "PAY_PER_REQUEST"
    },
    {
        "TableName": "MeasurementsTable",
        "AttributeDefinitions": [
            {"AttributeName": "boxId", "AttributeType": "S"},
            {"AttributeName": "createdAt", "AttributeType": "S"}
        ],
        "KeySchema": [
            {"AttributeName": "boxId", "KeyType": "HASH"},
            {"AttributeName": "createdAt", "KeyType": "RANGE"}
        ],
        "BillingMode": "PAY_PER_REQUEST"
    },
    {
        "TableName": "SensorsTable",
        "AttributeDefinitions": [
            {"AttributeName": "sensorId", "AttributeType": "S"},
            {"AttributeName": "lastMeasurement", "AttributeType": "S"},
            {"AttributeName": "unit", "AttributeType": "S"}  # Neues Attribut für GSI
        ],
        "KeySchema": [
            {"AttributeName": "sensorId", "KeyType": "HASH"}
        ],
        "BillingMode": "PAY_PER_REQUEST",
        "GlobalSecondaryIndexes": [
            {
                "IndexName": "LastMeasurementIndex",
                "KeySchema": [
                    {"AttributeName": "lastMeasurement", "KeyType": "HASH"}
                ],
                "Projection": {
                    "ProjectionType": "ALL"
                }
            },
            {
                "IndexName": "UnitIndex",  # Neuer Index
                "KeySchema": [
                    {"AttributeName": "unit", "KeyType": "HASH"}  # unit als Partition Key
                ],
                "Projection": {
                    "ProjectionType": "ALL"  # Alle Attribute im Index verfügbar
                }
            }
        ]
    }
]

# Tabellen löschen und neu erstellen
for table in tables:
    create_table(table)
