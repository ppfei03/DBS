import boto3

# DynamoDB-Client erstellen
dynamodb = boto3.resource('dynamodb', region_name='us-east-2')  # Region anpassen

# Funktion zum Löschen aller Einträge in einer Tabelle
def delete_all_items(table_name):
    table = dynamodb.Table(table_name)
    print(f"Alle Einträge in der Tabelle '{table_name}' werden gelöscht...")

    # Daten in Blöcken scannen und löschen
    scan = table.scan()
    with table.batch_writer() as batch:
        for item in scan['Items']:
            batch.delete_item(Key={key: item[key] for key in table.key_schema[0].keys()})
    
    print(f"Alle Einträge in der Tabelle '{table_name}' wurden gelöscht.")

# Tabellen definieren
tables = ["BoxesTable", "MeasurementsTable", "SensorsTable"]

# Alle Einträge in allen Tabellen löschen
for table_name in tables:
    delete_all_items(table_name)
