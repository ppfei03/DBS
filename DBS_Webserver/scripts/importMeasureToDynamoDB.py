import boto3
import requests
from datetime import datetime, timedelta

# DynamoDB-Client erstellen
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')  # Region anpassen
sensors_table = dynamodb.Table("SensorsTable")
measurements_table = dynamodb.Table("MeasurementsTable")

# Funktion, um das neuste Datum aus der MeasurementsTable zu holen
def get_latest_measurement_date(box_id):
    response = measurements_table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('boxId').eq(box_id),
        ScanIndexForward=False,  # Sortiert nach dem neuesten Datum
        Limit=1
    )
    if response['Items']:
        return response['Items'][0]['createdAt']  # Rückgabe des neuesten Datums
    else:
        return None



# Funktion, um die Messdaten eines Sensors zu holen
def fetch_sensor_data(box_id, sensor_id, from_date, to_date):
    url = f"https://api.opensensemap.org/boxes/{box_id}/data/{sensor_id}?from-date={from_date}&to-date={to_date}&format=json"
    print(f"Rufe Daten von {url} ab...")
    response = requests.get(url)

    if response.status_code == 200:
        return response.json()
    else:
        print(f"Fehler beim Abrufen der Daten: {response.status_code} - {response.text}")
        return []

# Funktion, um die Daten in die MeasurementsTable zu schreiben
def import_measurements(box_id, sensor_id, measurements):
    with measurements_table.batch_writer() as batch:
        for measurement in measurements:
            item = {
                "boxId": box_id,
                "createdAt": measurement['createdAt'],
                "sensorId": sensor_id,
                "value": measurement['value']
            }
            batch.put_item(Item=item)
    print(f"{len(measurements)} Messungen für Sensor {sensor_id} importiert.")

# Funktion, um alle Sensoren aus der SensorsTable zu holen
def fetch_sensors():
    print("Lese alle Sensoren aus der SensorsTable...")
    scan = sensors_table.scan()
    sensors = scan['Items']

    # Paginierung, falls mehr als 1 MB an Daten vorliegt
    while 'LastEvaluatedKey' in scan:
        scan = sensors_table.scan(ExclusiveStartKey=scan['LastEvaluatedKey'])
        sensors.extend(scan['Items'])

    print(f"{len(sensors)} Sensoren gefunden.")
    return sensors

def format_timestamp_rfc3339(dt):
    """Format datetime im RFC3339-Format ohne Mikrosekunden."""
    return dt.isoformat(timespec='seconds') + 'Z'  # 'Z' für UTC-Zeit anhängen


# Hauptfunktion
def main():
    sensors = fetch_sensors()
    now = datetime.utcnow()

    for sensor in sensors:
        box_id = sensor['boxId']
        sensor_id = sensor['sensorId']

        # Neustes Datum aus der MeasurementsTable abrufen
        latest_date = get_latest_measurement_date(box_id)

        if latest_date:
            from_date = latest_date
        else:
            from_date = format_timestamp_rfc3339(now - timedelta(hours=72))  # 48 Stunden zurück

        to_date = format_timestamp_rfc3339(now)

        # Messdaten abrufen und importieren
        measurements = fetch_sensor_data(box_id, sensor_id, from_date, to_date)

        if measurements:
            import_measurements(box_id, sensor_id, measurements)
        else:
            print(f"Keine neuen Messwerte für Sensor {sensor_id} gefunden.")



if __name__ == "__main__":
    main()
