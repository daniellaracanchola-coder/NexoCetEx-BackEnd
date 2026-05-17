const express = require('express');
const db = require('./db');
const router = express.Router();
const bcrypt = require('bcrypt');

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

router.put(
    '/cambiar-password',
    verificarToken,
    async (req, res) => {
        const usuarioId = req.usuario.id;
        const { passwordActual, passwordNueva } = req.body;

        if (!passwordActual || !passwordNueva) {
            return res.status(400).json({
                mensaje: 'Faltan datos'
            });
        }

        const buscarSql = `
            SELECT password
            FROM usuarios
            WHERE id = ?
        `;

        db.query(buscarSql, [usuarioId], async (err, result) => {
            if (err || result.length === 0) {
                return res.status(500).json({
                    mensaje: 'Error al buscar usuario'
                });
            }

            const coincide = await bcrypt.compare(
                passwordActual,
                result[0].password
            );

            if (!coincide) {
                return res.status(400).json({
                    mensaje: 'La contraseña actual es incorrecta'
                });
            }

            const nuevaHash = await bcrypt.hash(passwordNueva, 10);

            const actualizarSql = `
                UPDATE usuarios
                SET password = ?
                WHERE id = ?
            `;

            db.query(actualizarSql, [nuevaHash, usuarioId], (err) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al cambiar contraseña'
                    });
                }

                res.json({
                    mensaje: 'Contraseña actualizada correctamente'
                });
            });
        });
    }
);

module.exports = router;