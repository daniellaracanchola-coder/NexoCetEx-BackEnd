const express = require('express');
const db = require('./db');
const router = express.Router();
const bcrypt = require('bcryptjs');

const { verificarToken } = require('./middleware/auth');

/** Valores de tema admitidos por la app (nexo-ceti-express) */
const TEMAS_VALIDOS = ['sistema', 'claro', 'oscuro', 'extra'];
const TAMANOS_VALIDOS = ['normal', 'grande', 'muy-grande'];

function normalizarTema(tema) {
    if (TEMAS_VALIDOS.includes(tema)) {
        return tema;
    }
    return 'sistema';
}

function normalizarTamano(tamano) {
    if (TAMANOS_VALIDOS.includes(tamano)) {
        return tamano;
    }
    return 'normal';
}

router.get('/', verificarToken, (req, res) => {
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
            console.error('Error GET config:', err);
            return res.status(500).json({
                mensaje: 'Error al obtener las configuraciones',
            });
        }

        if (result.length === 0) {
            return res.json({
                tema: 'sistema',
                tamano_letra: 'normal',
                alto_contraste: false,
                notificaciones: true,
            });
        }

        const fila = result[0];
        res.json({
            tema: normalizarTema(fila.tema),
            tamano_letra: normalizarTamano(fila.tamano_letra),
            alto_contraste: Boolean(fila.alto_contraste),
            notificaciones: Boolean(fila.notificaciones),
        });
    });
});

router.put('/', verificarToken, (req, res) => {
    const usuarioId = req.usuario.id;

    let { tema, tamano_letra, alto_contraste, notificaciones } = req.body;

    if (tema !== undefined && !TEMAS_VALIDOS.includes(tema)) {
        return res.status(400).json({
            mensaje: `Tema no válido. Opciones: ${TEMAS_VALIDOS.join(', ')}`,
        });
    }

    if (tamano_letra !== undefined && !TAMANOS_VALIDOS.includes(tamano_letra)) {
        return res.status(400).json({
            mensaje: `Tamaño de letra no válido. Opciones: ${TAMANOS_VALIDOS.join(', ')}`,
        });
    }

    tema = normalizarTema(tema ?? 'sistema');
    tamano_letra = normalizarTamano(tamano_letra ?? 'normal');
    alto_contraste = Boolean(alto_contraste);
    notificaciones = notificaciones !== false;

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
        [usuarioId, tema, tamano_letra, alto_contraste, notificaciones],
        (err) => {
            if (err) {
                console.error('Error PUT config:', err);
                return res.status(500).json({
                    mensaje: 'Error al guardar la configuración',
                    detalle:
                        err.code === 'WARN_DATA_TRUNCATED' ||
                        err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD'
                            ? 'La base de datos no acepta el tema "extra". Ejecuta migrations/001_tema_extra.sql'
                            : undefined,
                });
            }

            res.json({
                mensaje: 'Configuración guardada con éxito',
                tema,
                tamano_letra,
                alto_contraste,
                notificaciones,
            });
        }
    );
});

router.put('/cambiar-password', verificarToken, async (req, res) => {
    const usuarioId = req.usuario.id;
    const { passwordActual, passwordNueva } = req.body;

    if (!passwordActual || !passwordNueva) {
        return res.status(400).json({
            mensaje: 'Faltan datos',
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
                mensaje: 'Error al buscar usuario',
            });
        }

        const coincide = await bcrypt.compare(passwordActual, result[0].password);

        if (!coincide) {
            return res.status(400).json({
                mensaje: 'La contraseña actual es incorrecta',
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
                    mensaje: 'Error al cambiar contraseña',
                });
            }

            res.json({
                mensaje: 'Contraseña actualizada correctamente',
            });
        });
    });
});

module.exports = router;
