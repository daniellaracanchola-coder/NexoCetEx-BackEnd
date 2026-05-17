const express = require('express');
const db = require('./db');
const router = express.Router();

const {
    verificarToken,
    verificarAdmin
} = require('./middleware/auth');

router.get(
    '/pendientes', 
    verificarToken,
    verificarAdmin,
    (req, res) => {
    const sql = `
        SELECT id, username, rol, grado, grupo
        FROM usuarios
        WHERE autorizado = 0
    `;

    db.query(sql, (err, result) => {
        if(err) {
            return res.status(500).json({
                mensaje: 'Error al obtener usuarios'
            });
        }

        res.json(result);
    });
});

router.put(
    '/aprobar/:id', 
    verificarToken,
    verificarAdmin,
    (req,res) => {
    const sql = `
        UPDATE usuarios
        SET autorizado = 1
        WHERE id = ?
    `;
    db.query(sql, [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al aprobar usuario'
            });
        }

        res.json({
            mensaje: 'Usuario aprobado'
        });
    });
});

router.delete(
    '/rechazar/:id', 
    verificarToken,
    verificarAdmin,
    (req, res) => {
    const sql = `
        DELETE FROM usuarios
        WHERE id = ?
    `;

    db.query(sql, [req.params.id], (err) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al rechazar al usuario'
            });
        }

        res.json({
            mensaje: 'Usuario rechazado'
        });
    });
});

router.put(
    '/cambiar-rol/:id', 
    verificarToken,
    verificarAdmin,
    (req, res) => {
    const { rol } = req.body;

    const sql = `
        UPDATE usuarios
        SET rol = ?
        WHERE id = ?
    `;

    db.query(sql, [rol, req.params.id], (err) => {
        if(err) {
            return res.status(500).json({
                mensaje: 'Error al cambiar el rol'
            });
        }

        res.json({
            mensaje: 'Rol actualizado'
        });
    });
});

//Para revisar usuarios ya creados
router.get(
    '/usuarios',
    verificarToken,
    verificarAdmin,
    (req, res) => {
        const sql = `
            SELECT id, username, rol, autorizado, grado, grupo
            FROM usuarios
            WHERE autorizado = 1
        `;

        db.query(sql, (err, result) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al obtener los usuarios'
                });
            }

            res.json(result);
        });
    }
);

//Dar de baja al usuarios
router.put(
    '/baja/:id',
    verificarToken,
    verificarAdmin,
    (req, res) => {

        if (Number(req.params.id) === req.usuario.id) {
            return res.status(400).json({
                mensaje: 'No puedes darte de baja a ti mismo'
            });
        }
        
        const sql = `
            UPDATE usuarios
            SET autorizado = 0
            WHERE id = ?
        `;

        db.query(sql, [req.params.id], (err) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al dar de baja al usuario'
                });
            }

            res.json({
                mensaje: 'Usuario dado de baja'
            });
        });
    }
);

module.exports = router;