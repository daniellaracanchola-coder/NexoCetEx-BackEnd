const express = require('express');
const router = express.Router();
const db = require('./db');
const enviarNotificacion = require('./enviarNotificacion');

router.post('/guardar-token', async (req, res) => {
    const { id, token } = req.body;
    console.log('USUARIO RECIBIDO:', id);
    console.log('TOKEN RECIBIDO:', token);

    const sql = `
        UPDATE usuarios
        SET token_push = ?
        WHERE id = ?
    `;

    db.query(sql, [token, id], async (err, result) => {
        if (err) {
            console.error('Error al guardan token:', err);
            return res.status(500).json({
                mensaje: 'Error al guardan el token'
            });
        }
        res.json({
        mensaje: 'Token guardado correctamente'
        });

    });
    
});

module.exports = router;