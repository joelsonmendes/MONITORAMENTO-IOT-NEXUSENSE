import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp();
}

export default async function handler(request, response) {
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
    console.log("Notificação enviada com sucesso:", result);
    response.status(200).send("Notificação enviada com sucesso.");
  } catch (error) {
    console.error("Erro ao enviar notificação:", error);
    response.status(500).send("Erro ao enviar notificação.");
  }
}
