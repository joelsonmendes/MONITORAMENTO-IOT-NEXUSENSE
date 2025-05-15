#include <WiFi.h>
#include <PubSubClient.h>

// Configurações WiFi - substitua pelos seus dados reais
const char* ssid = "SEU_SSID";
const char* password = "SUA_SENHA_WIFI";

// Configurações Adafruit IO MQTT
const char* mqtt_server = "io.adafruit.com";
const int mqtt_port = 1883;
const char* mqtt_user = "Joelson88";
const char* mqtt_password = "aio_XXVA49guKoIg0v3y1QTVtjLqm6lH";

// Tópicos MQTT dos sensores
const char* topicReservatorio = "Joelson88/feeds/Reservat%C3%B3rio";
const char* topicCisterna = "Joelson88/feeds/Cisterna";

// Tópico MQTT para enviar dados para a nuvem (exemplo)
const char* topicGatewayToCloud = "Joelson88/feeds/GatewayToCloud";

WiFiClient espClient;
PubSubClient client(espClient);

// Variáveis para armazenar os dados recebidos
String dataReservatorio = "";
String dataCisterna = "";

// Função para conectar ao WiFi
void setup_wifi() {
  delay(10);
  Serial.println();
  Serial.print("Conectando-se a ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  // Aguarda conexão WiFi
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");
  Serial.println("WiFi conectado");
  Serial.print("Endereço IP: ");
  Serial.println(WiFi.localIP());
}

// Callback para receber mensagens MQTT
void callback(char* topic, byte* payload, unsigned int length) {
  // Converte payload para String
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }

  Serial.print("Mensagem recebida no tópico [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  // Armazena os dados conforme o tópico
  if (String(topic) == topicReservatorio) {
    dataReservatorio = message;
  } else if (String(topic) == topicCisterna) {
    dataCisterna = message;
  }

  // Aqui você pode implementar o envio dos dados para a nuvem
  // Por exemplo, publicar um JSON com os dois dados em outro tópico MQTT
  String jsonPayload = "{\"reservatorio\": \"" + dataReservatorio + "\", \"cisterna\": \"" + dataCisterna + "\"}";
  client.publish(topicGatewayToCloud, jsonPayload.c_str());
  Serial.print("Dados enviados para a nuvem: ");
  Serial.println(jsonPayload);
}

// Função para reconectar ao broker MQTT caso desconectado
void reconnect() {
  while (!client.connected()) {
    Serial.print("Conectando ao broker MQTT...");
    if (client.connect("ESP32Gateway", mqtt_user, mqtt_password)) {
      Serial.println("conectado");
      // Inscreve-se nos tópicos dos sensores
      client.subscribe(topicReservatorio);
      client.subscribe(topicCisterna);
    } else {
      Serial.print("falha, rc=");
      Serial.print(client.state());
      Serial.println(" tentando novamente em 5 segundos");
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);

  // Conecta ao WiFi
  setup_wifi();

  // Configura o cliente MQTT e define o callback
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Aqui você pode adicionar lógica adicional, se necessário

  delay(1000);
}
