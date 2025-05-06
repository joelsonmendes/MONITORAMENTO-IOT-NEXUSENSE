import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_AUTH_DOMAIN",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_STORAGE_BUCKET",
  messagingSenderId: "SEU_MESSAGING_SENDER_ID",
  appId: "SEU_APP_ID",
  measurementId: "SEU_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

Notification.requestPermission().then((permission) => {
  if (permission === 'granted') {
    console.log('Permissão para notificações concedida.');

    getToken(messaging, { vapidKey: 'SUA_VAPID_KEY' }).then((currentToken) => {
      if (currentToken) {
        console.log('Token do dispositivo:', currentToken);
        // Aqui você pode enviar o token para seu backend para armazenar e usar para enviar notificações
      } else {
        console.log('Nenhum token disponível. Solicite permissão para gerar um token.');
      }
    }).catch((err) => {
      console.log('Erro ao obter token: ', err);
    });
  } else {
    console.log('Permissão para notificações negada.');
  }
});

onMessage(messaging, (payload) => {
  console.log('Mensagem recebida: ', payload);
  // Aqui você pode mostrar notificações customizadas no app
});
