#include <WiFi.h>
#include <PubSubClient.h>

// Configurações WiFi
const char* ssid = "SEU_SSID";
const char* password = "SUA_SENHA_WIFI";

// Configurações Adafruit IO
const char* mqtt_server = "io.adafruit.com";
const int mqtt_port = 1883;
const char* mqtt_user = "Joelson88";
const char* mqtt_password = "aio_XXVA49guKoIg0v3y1QTVtjLqm6lH";

// Tópicos MQTT para os feeds
const char* topicReservatorio = "Joelson88/feeds/Reservat%C3%B3rio";
const char* topicCisterna = "Joelson88/feeds/Cisterna";

// Pinos do sensor ultrassônico AJ-SR04M
const int trigPinReservatorio = 5; // ajuste conforme seu circuito
const int echoPinReservatorio = 18; // ajuste conforme seu circuito

const int trigPinCisterna = 17; // ajuste conforme seu circuito
const int echoPinCisterna = 16; // ajuste conforme seu circuito

WiFiClient espClient;
PubSubClient client(espClient);

long durationReservatorio;
float distanceReservatorio;

long durationCisterna;
float distanceCisterna;

void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Conectando-se a ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi conectado");
  Serial.print("Endereço IP: ");
  Serial.println(WiFi.localIP());
}

void reconnect() {
  // Loop até reconectar
  while (!client.connected()) {
    Serial.print("Conectando ao broker MQTT...");
    if (client.connect("ESP32Client", mqtt_user, mqtt_password)) {
      Serial.println("conectado");
    } else {
      Serial.print("falha, rc=");
      Serial.print(client.state());
      Serial.println(" tentando novamente em 5 segundos");
      delay(5000);
    }
  }
}

float readUltrasonicDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000); // timeout 30ms
  if (duration == 0) {
    return -1; // erro na leitura
  }
  // Calcular distância em cm (velocidade do som = 343 m/s)
  float distance = (duration * 0.0343) / 2;
  return distance;
}

void setup() {
  Serial.begin(115200);

  pinMode(trigPinReservatorio, OUTPUT);
  pinMode(echoPinReservatorio, INPUT);

  pinMode(trigPinCisterna, OUTPUT);
  pinMode(echoPinCisterna, INPUT);

  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  distanceReservatorio = readUltrasonicDistance(trigPinReservatorio, echoPinReservatorio);
  distanceCisterna = readUltrasonicDistance(trigPinCisterna, echoPinCisterna);

  if (distanceReservatorio >= 0) {
    // Publicar distância no feed Reservatório
    char msg[10];
    dtostrf(distanceReservatorio, 4, 2, msg);
    client.publish(topicReservatorio, msg);
    Serial.print("Reservatório: ");
    Serial.print(msg);
    Serial.println(" cm");
  }

  if (distanceCisterna >= 0) {
    // Publicar distância no feed Cisterna
    char msg[10];
    dtostrf(distanceCisterna, 4, 2, msg);
    client.publish(topicCisterna, msg);
    Serial.print("Cisterna: ");
    Serial.print(msg);
    Serial.println(" cm");
  }

  delay(5000); // intervalo de 5 segundos entre leituras
}
