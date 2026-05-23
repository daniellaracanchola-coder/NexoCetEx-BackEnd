const admin = require('./firebase');

/**
 * @param {string} token
 * @param {string} titulo
 * @param {string} mensaje
 * @param {{ ruta?: string }} [opciones]
 */
async function enviarNotificacion(token, titulo, mensaje, opciones = {}) {
    const ruta = opciones.ruta || '/home';

    const data = {
        ruta: String(ruta),
    };

    const message = {
        notification: {
            title: titulo,
            body: mensaje,
        },
        data,
        token,
        android: {
            priority: 'high',
        },
    };

    try {
        const response = await admin.messaging().send(message);
        console.log('Notificacion enviada:', response, 'ruta:', ruta);
    } catch (error) {
        console.error('Error enviando la notificacion:', error);
    }
}

module.exports = enviarNotificacion;
