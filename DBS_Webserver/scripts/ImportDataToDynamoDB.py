import requests
import boto3
from decimal import Decimal

# DynamoDB Clients
dynamodb = boto3.resource('dynamodb', region_name='us-east-2')
boxes_table = dynamodb.Table('BoxesTable')
sensors_table = dynamodb.Table('SensorsTable')
measurements_table = dynamodb.Table('MeasurementsTable')

# OpenSenseBox-API URL und Parameter
url = "https://api.opensensemap.org/boxes"
params = {
    "bbox": "9.6964,53.3951,10.2899,53.9647",  # Bounding Box für Hamburg
    "limit": 20,
    "classify": "true"
}

# Daten von der API abrufen
response = requests.get(url, params=params)

if response.status_code == 200:
    boxes = response.json()
    print(f"{len(boxes)} Boxen abgerufen.")

    for box in boxes:
        if box.get("state") == "active":  # Nur aktive Boxen verarbeiten
            try:
                # Box-Daten speichern
                box_item = {
                    "boxId": box["_id"],
                    "boxName": box.get("name", "Unbekannt"),
                    "location": [
                        Decimal(str(box["currentLocation"]["coordinates"][1])),
                        Decimal(str(box["currentLocation"]["coordinates"][0]))
                    ],
                    "state": box.get("state", "unknown")
                }
                boxes_table.put_item(Item=box_item)
                print(f"Box gespeichert: {box_item['boxId']}")

                # Sensoren speichern
                for sensor in box.get("sensors", []):
                    sensor_item = {
                        "sensorId": sensor["_id"],
                        "boxId": box["_id"],
                        "type": sensor.get("title", "Unbekannter Sensor"),
                        "unit": sensor.get("unit", "N/A"),
                        "lastMeasurement": sensor.get("lastMeasurement", "N/A")
                    }
                    sensors_table.put_item(Item=sensor_item)
                    print(f"Sensor gespeichert: {sensor_item['sensorId']}")

                    
            except Exception as e:
                print(f"Fehler beim Speichern der Box {box.get('_id', 'Unbekannt')}: {e}")
else:
    print(f"Fehler beim Abrufen der Daten: {response.status_code}")
