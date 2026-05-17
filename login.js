const express = require('express');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require ('dotenv').config();

const router = express.Router();

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({
            mensaje: 'Faltan datos, reviselo por favor'
        });
    }

    const sql = `
        SELECT * FROM usuarios
        WHERE username = ? 
    `;

    db.query( sql, [username], async (err, result) => {
            if (err) {
                return res.status(500).json({
                mensaje: 'Error interno del servidor'
                });
            }
            
            if (result.length === 0) {
                return res.status(401).json({
                    mensaje: 'Usuario o contraseña incorrectos'
                });
            }

            const usuario = result[0];
            
            const passwordCorrecto = await bcrypt.compare(
            password,
            usuario.password
            );

            if (!passwordCorrecto) {
                return res.status(401).json({
                    mensaje: 'Usuario o contraseña incorrectos'
                });
            }

            

            if(!usuario.autorizado) {
                return res.status(403).json({
                    mensaje: 'Usuario pendiente de autorizacion'
                });
            }

            const token = jwt.sign(
                {
                    id: usuario.id,
                    rol: usuario.rol
                },
                process.env.JWT_SECRET,
                {
                    expiresIn: '7d'
                }
            );

            res.json({
                mensaje: 'Login correcto',
                token,
                usuario: {
                    id: usuario.id,
                    username: usuario.username,
                    rol: usuario.rol,
                    grado: usuario.grado,
                    grupo: usuario.grupo
                }   
            });
        }
    );
});

module.exports = router;