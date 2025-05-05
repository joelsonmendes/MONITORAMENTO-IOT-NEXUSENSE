// Configurações do broker MQTT Adafruit IO
// Atenção: Para maior segurança, evite expor suas credenciais diretamente no frontend.
// Considere usar um backend para gerenciar a conexão MQTT ou variáveis de ambiente.

const MQTT_CONFIG = {
    brokerUrl: 'wss://io.adafruit.com:443/mqtt',
    username: 'Joelson88',
    password: 'aio_XXVA49guKoIg0v3y1QTVtjLqm6lH',
    topicReservatorio: 'Joelson88/feeds/Reservat%C3%B3rio',
    topicCisterna: 'Joelson88/feeds/Cisterna'
};

// Configurações para notificações
const NOTIFICATION_CONFIG = {
    whatsappApiUrl: 'https://api.exemplo.com/sendWhatsApp', // URL da API para enviar mensagens WhatsApp
    whatsappApiKey: 'SUA_CHAVE_API_WHATSAPP',
    whatsappRecipient: 'whatsapp:+5568996055488',
    emailApiUrl: 'https://api.exemplo.com/sendEmail', // URL da API para enviar emails
    emailApiKey: 'SUA_CHAVE_API_EMAIL',
    emailRecipient: 'jmdev.eng88@gmail.com'
};
