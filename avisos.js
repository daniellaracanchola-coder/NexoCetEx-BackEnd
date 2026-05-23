const express = require('express');
const db = require('./db');
const router = express.Router();
const enviarNotificacion = require('./enviarNotificacion');
const {
    notificarRecordatorioAviso,
    obtenerUsuariosSinLeerAviso,
} = require('./utilNotificaciones');

const { verificarToken, verificarAdmin } = require('./middleware/auth');

//Backend para HomePage.vue o Avisos con conexion a Sql

//Obtener a los usuarios que ya vieron el aviso
router.get(
    '/', 
    verificarToken, 
    (req, res) => {
    const sql = `
        SELECT
            a.id,
            a.titulo,
            a.conte,
            a.autor,
            a.rolDes,
            a.tipo,
            a.fecha,
            GROUP_CONCAT(v.username) AS vistosPor
        FROM avisos a
        LEFT JOIN avisos_vistos v ON a.id = v.aviso_id
        GROUP BY a.id
        ORDER BY
            CASE WHEN a.tipo = 'importante' THEN 0 ELSE 1 END,
            a.fecha DESC
    `;

    db.query(sql, async (err, results) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al obtener avisos'
            });
        }

        const avisos = await Promise.all(
            results.map(async (a) => {
                const aviso = {
                    ...a,
                    vistosPor: a.vistosPor ? a.vistosPor.split(',') : [],
                };

                if (req.usuario.rol === 'admin') {
                    const sinLeer = await obtenerUsuariosSinLeerAviso(a.id);
                    aviso.pendientesLectura = sinLeer.length;
                    aviso.sinLeer = sinLeer.map((u) => u.username);
                }

                return aviso;
            })
        );

        res.json(avisos);
    });
});

//Para crear los avisos
router.post(
    '/', 
    verificarToken,
    (req, res) => {
    const { titulo, conte, autor, rolDes } = req.body;

    if (!titulo || !conte || !autor) {
        return res.status(400).json({
            mensaje: 'Faltan datos'
        });
    }

    const sql = `
        INSERT INTO avisos (titulo, conte, autor, rolDes, tipo)
        VALUES (?, ?, ?, ?, 'normal')
    `;

    db.query(sql, [titulo, conte, autor, rolDes || 'todos'], (err, result) => {
        if(err) {
            return res.status(500).json({
                mensaje: 'Error al crear el aviso'
            });
        }
        const obtenerTokenSql = `
            SELECT token_push
            FROM usuarios u
            LEFT JOIN configuraciones_usuarios c
                ON u.id = c.usuario_id
            WHERE autorizado = 1
            AND token_push IS NOT NULL
            AND u.username != ?
            AND COALESCE(c.notificaciones, 1) = 1
            AND (
                ? = 'todos'
                OR u.rol = ?
            )
        `;

        db.query(
            obtenerTokenSql, 
            [autor, rolDes || 'todos', rolDes || 'todos'], 
            async (err, usuarios) => {
            if (err) {
                console.error('Error al obtener tokens:', err);
            } else {
                for (const usuario of usuarios) {
                    await enviarNotificacion(
                        usuario.token_push,
                        titulo,
                        conte,
                        { ruta: '/home' }
                    );
                }
            }

            res.json({
            mensaje: 'Aviso creado',
            id: result.insertId
            });
        });
    });
});

// Recordatorio push a quienes no marcaron el aviso como leído (solo admin)
router.post(
    '/:id/recordar',
    verificarToken,
    verificarAdmin,
    async (req, res) => {
        try {
            const resultado = await notificarRecordatorioAviso(req.params.id);

            if (resultado.error === 'aviso_no_encontrado') {
                return res.status(404).json({
                    mensaje: 'Aviso no encontrado'
                });
            }

            res.json({
                mensaje: 'Recordatorios enviados',
                enviados: resultado.enviados
            });
        } catch (err) {
            console.error('Error al enviar recordatorios:', err);
            res.status(500).json({
                mensaje: 'Error al enviar recordatorios'
            });
        }
    }
);

//Para marcar como leido
router.post(
    '/:id/leido', 
    verificarToken,
    (req, res) => {
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({
            mensaje: 'Falta username'
        });
    }
    const sql = `
        INSERT INTO avisos_vistos (aviso_id, username)
        SELECT ?, ?
        WHERE NOT EXISTS (
            SELECT 1 FROM avisos_vistos
            WHERE aviso_id = ? AND username = ?
        )
    `;

    db.query(sql, [req.params.id, username, req.params.id, username], (err) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al marcar aviso como leido'
            });
        }

        res.json({
            mensaje: 'Aviso marcado como leido con exito'
        });
    });
});

//Para cambiar la importancia de los avisos
router.put(
    '/:id/tipo', 
    verificarToken,
    (req, res) => {
    const sql = `
        UPDATE avisos
        SET tipo = IF(tipo = 'importante', 'normal', 'importante')
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al cambiar importancia del aviso'
            });
        }

        res.json({
            mensaje: 'Tipo de aviso actualizado'
        });
    });
});

//Para eliminar avisos
router.delete(
    '/:id', 
    verificarToken,
    (req, res) => {
    const sql = `
        DELETE FROM avisos
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], (err) => {
        if(err) {
            return res.status(500).json({
                mensaje: 'Error al eliminar el aviso'
            });
        }

        res.json({
            mensaje: 'Aviso eliminado'
        });
    });
});

module.exports = router;