const {onRequest} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

// Função para retornar credenciais MQTT e notificações de forma segura com autenticação básica
exports.getConfig = onRequest((request, response) => {
  const auth = request.get('authorization');
  const expectedAuth = `Basic ${Buffer.from(`${process.env.BASIC_AUTH_USER}:${process.env.BASIC_AUTH_PASS}`).toString('base64')}`;

  if (!auth || auth !== expectedAuth) {
    logger.warn('Acesso não autorizado à getConfig');
    response.set('WWW-Authenticate', 'Basic realm="Config"');
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
  logger.info('Configuração fornecida com sucesso.');
  response.json(config);
});

// Função para enviar notificação via FCM
exports.sendNotification = onRequest(async (request, response) => {
  try {
    const { token, title, body } = request.body;

    if (!token || !title || !body) {
      response.status(400).send("Parâmetros token, title e body são obrigatórios.");
      return;
    }

    const message = {
      notification: {
        title: title,
        body: body,
      },
      token: token,
    };

    const result = await admin.messaging().send(message);
    logger.info("Notificação enviada com sucesso:", result);
    response.status(200).send("Notificação enviada com sucesso.");
  } catch (error) {
    logger.error("Erro ao enviar notificação:", error);
    response.status(500).send("Erro ao enviar notificação.");
  }
});
