const express = require('express');
const router = express.Router();
const db = require('./db');
const enviarNotificacion = require('./enviarNotificacion');
const {
    notificarAutorizacionUsuario,
    queryAsync,
} = require('./utilNotificaciones');

router.post('/guardar-token', async (req, res) => {
    const { id, token } = req.body;

    if (!id || !token) {
        return res.status(400).json({
            mensaje: 'Faltan datos'
        });
    }

    console.log('USUARIO RECIBIDO:', id);
    console.log('TOKEN RECIBIDO:', token);

    const sql = `
        UPDATE usuarios
        SET token_push = ?
        WHERE id = ?
    `;

    try {
        await queryAsync(sql, [token, id]);

        const pendientes = await queryAsync(
            `
            SELECT aviso_autorizacion_pendiente
            FROM usuarios
            WHERE id = ?
            `,
            [id]
        );

        if (
            pendientes.length > 0 &&
            pendientes[0].aviso_autorizacion_pendiente === 1
        ) {
            await notificarAutorizacionUsuario(id);
        }

        res.json({
            mensaje: 'Token guardado correctamente'
        });
    } catch (err) {
        console.error('Error al guardar token:', err);
        res.status(500).json({
            mensaje: 'Error al guardar el token'
        });
    }
});

module.exports = router;