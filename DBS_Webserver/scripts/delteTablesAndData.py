import boto3
import time

# DynamoDB-Client erstellen
dynamodb = boto3.client('dynamodb', region_name='us-east-2')  # Passen Sie die Region an

# Tabelle löschen
def delete_table(table_name):
    try:
        print(f"Lösche Tabelle: {table_name}...")
        dynamodb.delete_table(TableName=table_name)
        # Warten, bis die Tabelle gelöscht wurde
        waiter = dynamodb.get_waiter('table_not_exists')
        waiter.wait(TableName=table_name)
        print(f"Tabelle '{table_name}' erfolgreich gelöscht.")
    except dynamodb.exceptions.ResourceNotFoundException:
        print(f"Tabelle '{table_name}' existiert nicht und kann nicht gelöscht werden.")
    except Exception as e:
        print(f"Fehler beim Löschen der Tabelle '{table_name}': {e}")

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
            {"AttributeName": "lastMeasurement", "AttributeType": "S"}
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
            }
        ]
    }
]

# Tabellen löschen und neu erstellen
for table in tables:
    delete_table(table["TableName"])
    time.sleep(5)  # Kurze Wartezeit, um sicherzustellen, dass die Löschung vollständig ist
    create_table(table)
