const express = require('express');
const db = require('./db');
const router = express.Router();

const { verificarToken } = require('./middleware/auth');

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

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al obtener avisos'
            });
        }

        const avisos = results.map(a => ({
            ...a,
            vistosPor: a.vistosPor ? a.vistosPor.split(',') : []
        }));

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

        res.json({
            mensaje: 'Aviso creado',
            id: result.insertId
        });
    });
});

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