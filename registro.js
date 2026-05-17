const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('./db');
const adminRoutes = require('./admin');

const router = express.Router();

router.post('/registro', async (req, res) => {
    const { 
        username, 
        password,
        rol,
        grado,
        grupo 
    } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            mensaje: 'Faltan datos'
        });
    }

    if (rol === 'alumno') {
        if(!grado || !grupo) {
            return res.status(400).json({
                mensaje: 'Grado y grupo son obligatorios para alumnos'
            });
        }
    }

    const rolesPermitidos = ['alumno', 'profesor'];
    if (!rolesPermitidos.includes(rol)){
        return res.status(400).json({
            mensaje: 'Rol invalido'
        });
    }
    
    const checkUserSql = 'SELECT * FROM usuarios WHERE username = ?';

    db.query(checkUserSql, [username], async (err, result) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error interno del servidor'
            });
        }
        
        if (result.length > 0) {
            return res.status(409).json({
                mensaje: 'El usuario ya existe'
            });
        }

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const insertSql = `
                INSERT INTO usuarios (username, password, autorizado, rol, grado, grupo)
                VALUES (?, ?, 0, ?, ?, ?)
            `;

            db.query(insertSql, 
                [
                    username, 
                    hashedPassword,
                    rol,
                    grado || null,
                    grupo || null
                ], 
                (err) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al crear el usuario'
                    });
                }
                adminRoutes.notificarUsuarioPendiente(username);
                
                return res.json({
                    mensaje: 'Usuario registrado correctamente'
                });
            });
        } catch (error) {
            return res.status(500).json({
                mensaje: 'Error al encriptar la contraseña'
            });
        }
    });
});

module.exports = router;