const express = require('express');
const db = require('./db');
const router = express.Router();

const {
    verificarToken
} = require('./middleware/auth');

router.get(
    '/',
    verificarToken,
    (req, res) => {

    const usuarioId = req.usuario.id;

    const sql = `
        SELECT
            tema,
            tamano_letra,
            alto_contraste,
            notificaciones
        FROM configuraciones_usuarios
        WHERE usuario_id = ?
    `;

    db.query(sql, [usuarioId], (err, result) => {
        if (err) {
            return res.status(500).json({
                mensaje: ' Error al botener las configuraciones'
            });
        }

        if (result.length === 0) {
            return res.json({
                tema: 'sistema',
                tamano_letra: 'normal',
                alto_contraste: false,
                notificaciones: true
            });
        }

        res.json(result[0]);
    });
});

router.put(
    '/',
    verificarToken,
    (req, res) => {
    const usuarioId = req.usuario.id;

    const {
        tema, 
        tamano_letra,
        alto_contraste,
        notificaciones,
    } = req.body;

    const sql = `
        INSERT INTO configuraciones_usuarios
        (
            usuario_id,
            tema,
            tamano_letra,
            alto_contraste,
            notificaciones
        )
        VALUES (?, ?, ?, ?, ?)

        ON DUPLICATE KEY UPDATE
            tema = VALUES(tema),
            tamano_letra = VALUES(tamano_letra),
            alto_contraste = VALUES(alto_contraste),
            notificaciones = VALUES(notificaciones)
    `;

    db.query(
        sql,
        [
            usuarioId,
            tema,
            tamano_letra,
            alto_contraste,
            notificaciones
        ],
        (err) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al guardar la configuracion'
            });
        }
        
        res.json({
            mensaje: 'Configuracion guardada con exito'
        });
    });
});

module.exports = router;