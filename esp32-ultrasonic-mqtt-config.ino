#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <DNSServer.h>

// Configurações MQTT Adafruit IO
const char* mqtt_server = "io.adafruit.com";
const int mqtt_port = 1883;
String mqtt_user;
String mqtt_password;
// Nome do cliente MQTT - precisa ser único
String clientId = "ESP32Client_";

// Pinos do sensor ultrassônico AJ-SR04M
const int trigPin = 5;
const int echoPin = 18;

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

// DNS Server para Portal Cativo
DNSServer dnsServer;
const byte DNS_PORT = 53;

// Web server para configuração
WebServer server(80);

// Preferências para salvar configurações
Preferences preferences;

bool shouldSaveConfig = false;
unsigned long saveConfigTime = 0;
bool configSaved = false;
bool isAPMode = false;
unsigned long lastMqttRetry = 0;
const int mqttRetryInterval = 30000; // 30 segundos entre tentativas de reconexão MQTT

void setup() {
  Serial.begin(115200);
  
  // Configura os pinos do sensor ultrassônico
  pinMode(trigPin, OUTPUT);
  pinMode(echoPin, INPUT);

  // Gera um ID de cliente único usando o endereço MAC
  uint64_t chipid = ESP.getEfuseMac();
  clientId += String((uint32_t)chipid, HEX);
  Serial.print("Client ID: ");
  Serial.println(clientId);

  // Inicia o armazenamento de preferências
  preferences.begin("config", false);
  loadConfig(); // Carrega configurações salvas

  if (wifiSSID == "" || wifiSSID.length() < 1) {
    // Sem configuração WiFi, iniciar modo AP para configuração
    Serial.println("Nenhuma configuração WiFi encontrada. Iniciando modo AP...");
    startConfigAP();
    isAPMode = true;
  } else {
    // Tentar conectar WiFi com as credenciais salvas
    Serial.print("Tentando conectar ao WiFi: ");
    Serial.println(wifiSSID);
    connectWiFi();
    
    // Configura o servidor MQTT apenas se estiver em modo cliente
    client.setServer(mqtt_server, mqtt_port);
    
    // Configurar callback para mensagens recebidas (opcional)
    // client.setCallback(callback);
  }
}

void loop() {
  // Sempre processar DNS se estiver em modo AP
  if (isAPMode) {
    dnsServer.processNextRequest();
  }
  
  // Trata requisições do servidor web
  server.handleClient();

  if (shouldSaveConfig && !configSaved) {
    // Aguarda 2 segundos para garantir que o cliente receba a resposta antes de reiniciar
    if (millis() - saveConfigTime > 2000) {
      saveConfig(); // Salva as configurações no armazenamento
      configSaved = true;
      Serial.println("Configurações salvas. Reiniciando...");
      delay(100); // Pequena pausa antes de reiniciar
      ESP.restart(); // Reinicia o ESP32 para aplicar as configurações
    }
  }

  // Se não estiver em modo AP, execute as operações normais
  if (!isAPMode) {
    if (WiFi.status() != WL_CONNECTED) {
      // Se desconectado, tentar reconectar WiFi
      Serial.println("WiFi desconectado. Tentando reconectar...");
      connectWiFi();
    } else {
      // Verifica se é hora de tentar reconectar ao MQTT
      unsigned long currentMillis = millis();
      
      if (!client.connected() && (currentMillis - lastMqttRetry > mqttRetryInterval)) {
        Serial.println("MQTT desconectado. Tentando reconectar...");
        reconnectMQTT();
        lastMqttRetry = currentMillis;
      }
      
      if (client.connected()) {
        client.loop();
      }

      // Lê a distância do sensor ultrassônico
      float distancia = readUltrasonicDistance(trigPin, echoPin);
      if (distancia >= 0) {
        // Calcula o volume baseado na distância lida
        float volume = calcularVolume(distancia);
        // Publica o volume no broker MQTT
        publishVolume(volume);
        Serial.print("Distância: ");
        Serial.print(distancia);
        Serial.print(" cm, Volume: ");
        Serial.print(volume);
        Serial.println(" L");
      }
      delay(5000); // Aguarda 5 segundos antes da próxima leitura
    }
  }
}

// Inicia o modo Access Point para configuração via web
void startConfigAP() {
  Serial.println("Iniciando modo AP para configuração...");
  WiFi.mode(WIFI_AP);
  WiFi.softAP("ESP32_Config");
  
  IPAddress myIP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(myIP);
  
  // Configurar DNS Server para redirecionar todas as solicitações para o ESP32
  dnsServer.start(DNS_PORT, "*", myIP);

  // Página web para configuração das credenciais e dimensões do tanque
  server.on("/", HTTP_GET, handleRoot);
  server.on("/save", HTTP_POST, handleSave);
  server.onNotFound(handleRoot);  // Redirecionar URLs desconhecidas para a raiz
  
  server.begin();
  Serial.println("Servidor web iniciado no modo AP. Acesse http://192.168.4.1 para configurar.");
}

void handleRoot() {
  String html = "<html><head><title>Configuração ESP32</title>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>body{font-family:Arial;margin:20px;} input,select{width:100%;padding:8px;margin:8px 0;box-sizing:border-box;} input[type=submit]{background-color:#4CAF50;color:white;}</style>";
  html += "</head><body>";
  html += "<h1>Configuração do ESP32</h1>";
  html += "<form action='/save' method='POST'>";
  html += "SSID WiFi: <input type='text' name='ssid'><br>";
  html += "Senha WiFi: <input type='password' name='password'><br>";
  html += "Usuário MQTT: <input type='text' name='mqtt_user' value='" + mqtt_user + "'><br>";
  html += "Senha MQTT: <input type='password' name='mqtt_password' value='" + mqtt_password + "'><br>";
  html += "Largura (cm): <input type='number' step='0.1' name='largura'><br>";
  html += "Comprimento (cm): <input type='number' step='0.1' name='comprimento'><br>";
  html += "Profundidade (cm): <input type='number' step='0.1' name='profundidade'><br>";
  html += "Tipo de tanque: <select name='tipo'>";
  html += "<option value='reservatorio'>Reservatório</option>";
  html += "<option value='cisterna'>Cisterna</option>";
  html += "</select><br><br>";
  html += "<input type='submit' value='Salvar'>";
  html += "</form></body></html>";
  server.send(200, "text/html", html);
}

void handleSave() {
  wifiSSID = server.arg("ssid");
  wifiPassword = server.arg("password");
  mqtt_user = server.arg("mqtt_user");
  mqtt_password = server.arg("mqtt_password");
  largura = server.arg("largura").toFloat();
  comprimento = server.arg("comprimento").toFloat();
  profundidade = server.arg("profundidade").toFloat();
  tipoTanque = server.arg("tipo");

  shouldSaveConfig = true;
  saveConfigTime = millis();

  String response = "<html><head><meta name='viewport' content='width=device-width, initial-scale=1'></head>";
  response += "<body><h1>Configurações salvas. Reiniciando...</h1>";
  response += "<p>O dispositivo irá reiniciar e tentar conectar à rede WiFi.</p></body></html>";
  server.send(200, "text/html", response);
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
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
    
    // Inicializar servidor web para página de status quando conectado ao WiFi
    server.on("/", HTTP_GET, []() {
      String html = "<html><head><title>Status ESP32</title>";
      html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
      html += "<meta http-equiv='refresh' content='10'>";
      html += "<style>body{font-family:Arial;margin:20px;}</style>";
      html += "</head><body>";
      html += "<h1>Status do Sistema</h1>";
      html += "<p>Conectado à rede: " + wifiSSID + "</p>";
      
      float distancia = readUltrasonicDistance(trigPin, echoPin);
      float volume = calcularVolume(distancia);
      
      html += "<p>Distância: " + String(distancia) + " cm</p>";
      html += "<p>Volume: " + String(volume) + " L</p>";
      html += "<p>Dimensões do tanque: " + String(largura) + "cm x " + String(comprimento) + "cm x " + String(profundidade) + "cm</p>";
      html += "<p>Tipo: " + tipoTanque + "</p>";
      html += "<p>Status MQTT: " + String(client.connected() ? "Conectado" : "Desconectado") + "</p>";
      html += "</body></html>";
      server.send(200, "text/html", html);
    });
    
    server.on("/reset", HTTP_GET, []() {
      String html = "<html><head><title>Resetando ESP32</title>";
      html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
      html += "</head><body>";
      html += "<h1>Resetando configurações...</h1>";
      html += "<p>O dispositivo irá reiniciar em modo de configuração.</p>";
      html += "</body></html>";
      server.send(200, "text/html", html);
      
      // Apagar configurações
      preferences.clear();
      delay(1000);
      ESP.restart();
    });
    
    server.begin();
  } else {
    Serial.println("Falha ao conectar WiFi. Reiniciando para modo AP.");
    // Limpar configurações WiFi para forçar modo AP na próxima inicialização
    preferences.putString("ssid", "");
    preferences.putString("password", "");
    preferences.end();
    delay(1000);
    ESP.restart();
  }
}

// Reconecta ao broker MQTT caso desconectado
void reconnectMQTT() {
  int attempts = 0;
  while (!client.connected() && attempts < 3) {
    Serial.print("Conectando ao broker MQTT...");
    
    // Tentar conectar usando o ID de cliente único e as credenciais
    if (client.connect(clientId.c_str(), mqtt_user.c_str(), mqtt_password.c_str())) {
      Serial.println("conectado!");
      // Opcional: inscrever em tópicos aqui
      // client.subscribe("Joelson88/feeds/comando");
      return;
    } else {
      int state = client.state();
      Serial.print("falha, rc=");
      Serial.print(state);
      
      // Mostrar mensagem específica para cada erro
      switch (state) {
        case -4: 
          Serial.println(" (MQTT_CONNECTION_TIMEOUT)");
          break;
        case -3: 
          Serial.println(" (MQTT_CONNECTION_LOST)");
          break;
        case -2: 
          Serial.println(" (MQTT_CONNECT_FAILED)");
          break;
        case -1: 
          Serial.println(" (MQTT_DISCONNECTED)");
          break;
        case 1: 
          Serial.println(" (MQTT_CONNECT_BAD_PROTOCOL)");
          break;
        case 2: 
          Serial.println(" (MQTT_CONNECT_BAD_CLIENT_ID)");
          break;
        case 3: 
          Serial.println(" (MQTT_CONNECT_UNAVAILABLE)");
          break;
        case 4: 
          Serial.println(" (MQTT_CONNECT_BAD_CREDENTIALS)");
          break;
        case 5: 
          Serial.println(" (MQTT_CONNECT_UNAUTHORIZED)");
          break;
        default:
          Serial.println(" (desconhecido)");
      }
      
      Serial.println(" Tentando novamente em 5 segundos");
      delay(5000);
      attempts++;
    }
  }
}

// Reconecta ao broker MQTT caso desconectado
void reconnectMQTT() {
  int attempts = 0;
  while (!client.connected() && attempts < 3) {
    Serial.print("Conectando ao broker MQTT...");
    
    // Tentar conectar usando o ID de cliente único e as credenciais
    if (client.connect(clientId.c_str(), mqtt_user, mqtt_password)) {
      Serial.println("conectado!");
      // Opcional: inscrever em tópicos aqui
      // client.subscribe("Joelson88/feeds/comando");
      return;
    } else {
      int state = client.state();
      Serial.print("falha, rc=");
      Serial.print(state);
      
      // Mostrar mensagem específica para cada erro
      switch (state) {
        case -4: 
          Serial.println(" (MQTT_CONNECTION_TIMEOUT)");
          break;
        case -3: 
          Serial.println(" (MQTT_CONNECTION_LOST)");
          break;
        case -2: 
          Serial.println(" (MQTT_CONNECT_FAILED)");
          break;
        case -1: 
          Serial.println(" (MQTT_DISCONNECTED)");
          break;
        case 1: 
          Serial.println(" (MQTT_CONNECT_BAD_PROTOCOL)");
          break;
        case 2: 
          Serial.println(" (MQTT_CONNECT_BAD_CLIENT_ID)");
          break;
        case 3: 
          Serial.println(" (MQTT_CONNECT_UNAVAILABLE)");
          break;
        case 4: 
          Serial.println(" (MQTT_CONNECT_BAD_CREDENTIALS)");
          break;
        case 5: 
          Serial.println(" (MQTT_CONNECT_UNAUTHORIZED)");
          break;
        default:
          Serial.println(" (desconhecido)");
      }
      
      Serial.println(" Tentando novamente em 5 segundos");
      delay(5000);
      attempts++;
    }
  }
}

// Lê a distância do sensor ultrassônico
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

// Calcula o volume em litros baseado na distância e dimensões do tanque
float calcularVolume(float distancia) {
  // volume = largura * comprimento * (profundidade - distancia) em cm³
  // 1 litro = 1000 cm³
  float alturaAgua = profundidade - distancia;
  if (alturaAgua < 0) alturaAgua = 0;
  float volumeCm3 = largura * comprimento * alturaAgua;
  float volumeLitros = volumeCm3 / 1000.0;
  return volumeLitros;
}

// Publica o volume no broker MQTT no tópico correto
void publishVolume(float volume) {
  if (!client.connected()) {
    Serial.println("MQTT desconectado, não foi possível publicar");
    return;
  }
  
  String topic;
  if (tipoTanque == "reservatorio") {
    topic = "Joelson88/feeds/nexusense.reservatorio";
  } else {
    topic = "Joelson88/feeds/nexusense.cisterna";
  }
  
  char msg[10];
  dtostrf(volume, 4, 2, msg);
  
  boolean success = client.publish(topic.c_str(), msg);
  if (success) {
    Serial.println("Volume publicado: " + String(msg) + " no tópico: " + topic);
  } else {
    Serial.println("Falha ao publicar mensagem MQTT");
  }
}

// Carrega as configurações salvas do armazenamento
void loadConfig() {
  wifiSSID = preferences.getString("ssid", "");
  wifiPassword = preferences.getString("password", "");
  largura = preferences.getFloat("largura", 0);
  comprimento = preferences.getFloat("comprimento", 0);
  profundidade = preferences.getFloat("profundidade", 0);
  tipoTanque = preferences.getString("tipo", "reservatorio");
  
  Serial.println("Configurações carregadas:");
  Serial.println("SSID: " + wifiSSID);
  Serial.println("Largura: " + String(largura));
  Serial.println("Comprimento: " + String(comprimento));
  Serial.println("Profundidade: " + String(profundidade));
  Serial.println("Tipo: " + tipoTanque);
}

// Salva as configurações no armazenamento
void saveConfig() {
  preferences.putString("ssid", wifiSSID);
  preferences.putString("password", wifiPassword);
  preferences.putFloat("largura", largura);
  preferences.putFloat("comprimento", comprimento);
  preferences.putFloat("profundidade", profundidade);
  preferences.putString("tipo", tipoTanque);
  preferences.end();
  
  Serial.println("Configurações salvas com sucesso!");
}

// Função opcional para processar mensagens recebidas
/*
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Mensagem recebida [");
  Serial.print(topic);
  Serial.print("] ");
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);
  
  // Aqui você pode processar comandos recebidos
}
*/