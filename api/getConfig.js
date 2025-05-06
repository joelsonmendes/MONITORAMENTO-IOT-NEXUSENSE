export default function handler(request, response) {
  const auth = request.headers.authorization;
  const expectedAuth = 'Basic ' + Buffer.from(process.env.BASIC_AUTH_USER + ':' + process.env.BASIC_AUTH_PASS).toString('base64');

  if (!auth || auth !== expectedAuth) {
    response.setHeader('WWW-Authenticate', 'Basic realm="Config"');
    response.status(401).send('Autenticação necessária.');
    return;
  }

  const config = {
    mqtt: {
      brokerUrl: process.env.MQTT_BROKER_URL || "wss://io.adafruit.com:443/mqtt",
      username: process.env.MQTT_USERNAME || "",
      password: process.env.MQTT_PASSWORD || "",
      topicReservatorio: process.env.MQTT_TOPIC_RESERVATORIO || "Joelson88/feeds/Reservat%C3%B3rio",
      topicCisterna: process.env.MQTT_TOPIC_CISTERNA || "Joelson88/feeds/Cisterna",
    },
    notification: {
      whatsappApiUrl: process.env.WHATSAPP_API_URL || "",
      whatsappApiKey: process.env.WHATSAPP_API_KEY || "",
      whatsappRecipient: process.env.WHATSAPP_RECIPIENT || "",
      emailApiUrl: process.env.EMAIL_API_URL || "",
      emailApiKey: process.env.EMAIL_API_KEY || "",
      emailRecipient: process.env.EMAIL_RECIPIENT || "",
    },
  };
  console.log('Configuração fornecida com sucesso.');
  response.status(200).json(config);
}
