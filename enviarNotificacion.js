const admin = require('./firebase');

async function enviarNotificacion(token, titulo, mensaje) {
    const message = {
        notification: {
            title: titulo,
            body: mensaje
        },
        token: token
    };
    try {
            const response = await admin.messaging().send(message);

            console.log('Notificacion enviada:', response);
        } catch (error) {
            console.error('Error enviando la notificacion:', error)
        }
}

module.exports = enviarNotificacion;