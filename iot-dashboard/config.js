const configEndpoint = '/getConfig'; // Endpoint protegido no backend

let MQTT_CONFIG = {};
let NOTIFICATION_CONFIG = {};

async function fetchConfig(authUser, authPass) {
  const headers = new Headers();
  const basicAuth = btoa(`${authUser}:${authPass}`);
  headers.append('Authorization', `Basic ${basicAuth}`);

  try {
    const response = await fetch(configEndpoint, { headers });
    if (!response.ok) {
      throw new Error(`Erro ao obter configuração: ${response.statusText}`);
    }
    const config = await response.json();
    MQTT_CONFIG = config.mqtt;
    NOTIFICATION_CONFIG = config.notification;
    console.log('Configuração carregada com sucesso.');
  } catch (error) {
    console.error('Falha ao carregar configuração:', error);
  }
}

// Exemplo de uso:
// fetchConfig('usuario', 'senha');

