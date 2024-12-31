import boto3
import requests

# DynamoDB-Client erstellen
dynamodb = boto3.resource('dynamodb', region_name='us-east-1')  # Region anpassen
sensors_table = dynamodb.Table("SensorsTable")
measurements_table = dynamodb.Table("MeasurementsTable")

# Funktion, um die letzten 10 Messungen für einen Sensor zu holen
def fetch_sensor_data(box_id, sensor_id):
    url = f"https://api.opensensemap.org/boxes/{box_id}/data/{sensor_id}?format=json&limit=10"
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

# Hauptfunktion
def main():
    sensors = fetch_sensors()
    
    for sensor in sensors:
        box_id = sensor['boxId']
        sensor_id = sensor['sensorId']
        measurements = fetch_sensor_data(box_id, sensor_id)
        print(sensor)
        if measurements:
            import_measurements(box_id, sensor_id, measurements)

if __name__ == "__main__":
    main()
