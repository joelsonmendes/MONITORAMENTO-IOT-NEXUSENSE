#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <PubSubClient.h>

// Configurações MQTT Adafruit IO
const char* mqtt_server = "io.adafruit.com";
const int mqtt_port = 1883;
const char* mqtt_user = "Joelson88";
const char* mqtt_password = "aio_XXVA49guKoIg0v3y1QTVtjLqm6lH";

// Pinos do sensor ultrassônico AJ-SR04M
const int trigPin = 5;  // Ajuste conforme seu circuito
const int echoPin = 18; // Ajuste conforme seu circuito

// Variáveis para armazenar configurações
String wifiSSID;
String wifiPassword;
float largura = 0;
float comprimento = 0;
float profundidade = 0;
String tipoTanque = "reservatorio"; // "reservatorio" ou "cisterna"

// MQTT
WiFiClient espClient;
PubSubClient client(espClient);

// Web server para configuração
WebServer server(80);

// Preferências para salvar configurações
Preferences preferences;

bool shouldSaveConfig = false;
unsigned long saveConfigTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  preferences.begin("config", false);
  loadConfig();

  if (wifiSSID == "") {
    // Sem configuração WiFi, iniciar modo AP para configuração
    startConfigAP();
  } else {
    // Tentar conectar WiFi
    connectWiFi();
  }

  client.setServer(mqtt_server, mqtt_port);
}

void loop() {
  if (shouldSaveConfig) {
    // Aguarda 2 segundos para garantir que o cliente receba a resposta antes de reiniciar
    if (millis() - saveConfigTime > 2000) {
      saveConfig();
      shouldSaveConfig = false;
      ESP.restart();
    }
  }

  if (WiFi.status() != WL_CONNECTED) {
    // Se desconectado, tentar reconectar WiFi
    connectWiFi();
  } else {
    if (!client.connected()) {
      reconnectMQTT();
    }
    client.loop();

    float distancia = readUltrasonicDistance(trigPin, echoPin);
    if (distancia >= 0) {
      float volume = calcularVolume(distancia);
      publishVolume(volume);
      Serial.print("Distância: ");
      Serial.print(distancia);
      Serial.print(" cm, Volume: ");
      Serial.print(volume);
      Serial.println(" L");
    }
    delay(5000);
  }

  server.handleClient();
}

void startConfigAP() {
  Serial.println("Iniciando modo AP para configuração...");
  WiFi.softAP("ESP32_Config");

  server.on("/", HTTP_GET, []() {
    String html = "<html><head><title>Configuração ESP32</title></head><body>";
    html += "<h1>Configuração do ESP32</h1>";
    html += "<form action=\"/save\" method=\"POST\">";
    html += "SSID WiFi: <input type=\"text\" name=\"ssid\"><br>";
    html += "Senha WiFi: <input type=\"password\" name=\"password\"><br>";
    html += "Largura (cm): <input type=\"number\" step=\"0.1\" name=\"largura\"><br>";
    html += "Comprimento (cm): <input type=\"number\" step=\"0.1\" name=\"comprimento\"><br>";
    html += "Profundidade (cm): <input type=\"number\" step=\"0.1\" name=\"profundidade\"><br>";
    html += "Tipo de tanque: <select name=\"tipo\">";
    html += "<option value=\"reservatorio\">Reservatório</option>";
    html += "<option value=\"cisterna\">Cisterna</option>";
    html += "</select><br><br>";
    html += "<input type=\"submit\" value=\"Salvar\">";
    html += "</form></body></html>";
    server.send(200, "text/html", html);
  });

  server.on("/save", HTTP_POST, []() {
    wifiSSID = server.arg("ssid");
    wifiPassword = server.arg("password");
    largura = server.arg("largura").toFloat();
    comprimento = server.arg("comprimento").toFloat();
    profundidade = server.arg("profundidade").toFloat();
    tipoTanque = server.arg("tipo");

    shouldSaveConfig = true;
    saveConfigTime = millis();

    String response = "<html><body><h1>Configurações salvas. Reiniciando...</h1></body></html>";
    server.send(200, "text/html", response);
  });

  server.begin();
  Serial.println("Servidor web iniciado no modo AP. Acesse http://192.168.4.1 para configurar.");
}

void connectWiFi() {
  Serial.print("Conectando-se à rede WiFi: ");
  Serial.println(wifiSSID);
  WiFi.begin(wifiSSID.c_str(), wifiPassword.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi conectado!");
    Serial.print("Endereço IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("Falha ao conectar WiFi. Reiniciando para modo AP.");
    ESP.restart();
  }
}

void reconnectMQTT() {
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
  float distance = (duration * 0.0343) / 2;
  return distance;
}

float calcularVolume(float distancia) {
  // Calcula o volume em litros baseado na distância e dimensões do tanque
  // volume = largura * comprimento * (profundidade - distancia) em cm³
  // 1 litro = 1000 cm³
  float alturaAgua = profundidade - distancia;
  if (alturaAgua < 0) alturaAgua = 0;
  float volumeCm3 = largura * comprimento * alturaAgua;
  float volumeLitros = volumeCm3 / 1000.0;
  return volumeLitros;
}

void publishVolume(float volume) {
  String topic;
  if (tipoTanque == "reservatorio") {
    topic = "Joelson88/feeds/Reservat%C3%B3rio";
  } else {
    topic = "Joelson88/feeds/Cisterna";
  }
  char msg[10];
  dtostrf(volume, 4, 2, msg);
  client.publish(topic.c_str(), msg);
}

void loadConfig() {
  wifiSSID = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("password", "");
  largura = preferences.getFloat("largura", 0);
  comprimento = preferences.getFloat("comprimento", 0);
  profundidade = preferences.getFloat("profundidade", 0);
  tipoTanque = preferences.getString("tipo", "reservatorio");
}

void saveConfig() {
  preferences.putString("ssid", wifiSSID);
  preferences.putString("password", wifiPassword);
  preferences.putFloat("largura", largura);
  preferences.putFloat("comprimento", comprimento);
  preferences.putFloat("profundidade", profundidade);
  preferences.putString("tipo", tipoTanque);
  preferences.end();
}
