import boto3

# DynamoDB-Client erstellen
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')  # Region anpassen

# Funktion zum Löschen aller Einträge in einer Tabelle
def delete_all_items(table_name):
    table = dynamodb.Table(table_name)
    print(f"Lösche alle Einträge in der Tabelle '{table_name}'...")

    # Schlüssel (Primary Key) aus der Tabelle extrahieren
    keys = [key['AttributeName'] for key in table.key_schema]

    # Paginierung verwenden, um alle Daten abzurufen
    scan_kwargs = {}
    done = False
    while not done:
        scan = table.scan(**scan_kwargs)
        with table.batch_writer() as batch:
            for item in scan['Items']:
                # Nur die Schlüssel des Items verwenden
                key = {k: item[k] for k in keys}
                batch.delete_item(Key=key)

        # Falls LastEvaluatedKey existiert, gibt es weitere Seiten
        scan_kwargs['ExclusiveStartKey'] = scan.get('LastEvaluatedKey', None)
        done = 'LastEvaluatedKey' not in scan

    print(f"Alle Einträge in der Tabelle '{table_name}' wurden gelöscht.")

# Tabellen definieren
tables = ["BoxesTable", "MeasurementsTable", "SensorsTable"]

# Alle Einträge in allen Tabellen löschen
for table_name in tables:
    delete_all_items(table_name)
