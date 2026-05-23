const express = require('express');
const db = require('./db');
const router = express.Router();
const enviarNotificacion = require('./enviarNotificacion');
const {
    notificarAutorizacionUsuario,
    queryAsync,
} = require('./utilNotificaciones');
const {
    esSuperAdminUsuario,
    esSuperAdminUsername,
    SUPER_ADMIN_USERNAME,
} = require('./constantesAdmin');

const {
    verificarToken,
    verificarAdmin
} = require('./middleware/auth');

const notificarUsuarioPendiente = (username) => {
    const sql = `
        SELECT u.token_push
        FROM usuarios u
        LEFT JOIN configuraciones_usuarios c
            ON u.id = c.usuario_id
        WHERE u.rol = 'admin'
        AND u.autorizado = 1
        AND u.token_push IS NOT NULL
        AND COALESCE(c.notificaciones, 1) = 1
    `;

    db.query(sql, async (err, admins) => {
        if (err) {
            console.error('Error al botener administradores:', err);
            return;
        }

        for (const admin of admins) {
            await enviarNotificacion(
                admin.token_push,
                'Usuario pendiente de aprobacion',
                `${username} solicita aprobacion de cuenta`,
                { ruta: '/admin' }
            );
        }
    });
};

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
    async (req, res) => {
    const usuarioId = req.params.id;

    try {
        await queryAsync(
            `
            UPDATE usuarios
            SET autorizado = 1, aviso_autorizacion_pendiente = 1
            WHERE id = ?
            `,
            [usuarioId]
        );

        await notificarAutorizacionUsuario(usuarioId);

        res.json({
            mensaje: 'Usuario aprobado'
        });
    } catch (err) {
        console.error('Error al aprobar usuario:', err);
        res.status(500).json({
            mensaje: 'Error al aprobar usuario'
        });
    }
});

router.delete(
    '/rechazar/:id', 
    verificarToken,
    verificarAdmin,
    async (req, res) => {
    try {
        const filas = await queryAsync(
            'SELECT id, username FROM usuarios WHERE id = ?',
            [req.params.id]
        );
        if (!filas.length) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }
        if (esSuperAdminUsuario(filas[0])) {
            return res.status(403).json({
                mensaje: `La cuenta ${SUPER_ADMIN_USERNAME} no puede eliminarse`,
            });
        }

        await queryAsync('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
        res.json({ mensaje: 'Usuario rechazado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mensaje: 'Error al rechazar al usuario' });
    }
});

router.put(
    '/cambiar-rol/:id', 
    verificarToken,
    verificarAdmin,
    async (req, res) => {
    const { rol } = req.body;

    try {
        const filas = await queryAsync(
            'SELECT id, username, rol FROM usuarios WHERE id = ?',
            [req.params.id]
        );
        if (!filas.length) {
            return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        }
        if (esSuperAdminUsuario(filas[0])) {
            return res.status(403).json({
                mensaje: `El rol de ${SUPER_ADMIN_USERNAME} no puede modificarse`,
            });
        }

        await queryAsync('UPDATE usuarios SET rol = ? WHERE id = ?', [
            rol,
            req.params.id,
        ]);
        res.json({ mensaje: 'Rol actualizado' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ mensaje: 'Error al cambiar el rol' });
    }
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
    async (req, res) => {
        if (Number(req.params.id) === req.usuario.id) {
            return res.status(400).json({
                mensaje: 'No puedes darte de baja a ti mismo',
            });
        }

        try {
            const filas = await queryAsync(
                'SELECT id, username FROM usuarios WHERE id = ?',
                [req.params.id]
            );
            if (!filas.length) {
                return res.status(404).json({ mensaje: 'Usuario no encontrado' });
            }
            if (esSuperAdminUsuario(filas[0])) {
                return res.status(403).json({
                    mensaje: `La cuenta ${SUPER_ADMIN_USERNAME} no puede darse de baja`,
                });
            }

            await queryAsync(
                'UPDATE usuarios SET autorizado = 0 WHERE id = ?',
                [req.params.id]
            );
            res.json({ mensaje: 'Usuario dado de baja' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ mensaje: 'Error al dar de baja al usuario' });
        }
    }
);

// Actualizar perfil (admin: directo; alumnos solo vía solicitud)
router.put(
    '/usuarios/:id/perfil',
    verificarToken,
    verificarAdmin,
    async (req, res) => {
        const objetivoId = Number(req.params.id);
        const { username, grado, grupo } = req.body;

        try {
            const filas = await queryAsync(
                'SELECT id, username, rol, grado, grupo FROM usuarios WHERE id = ?',
                [objetivoId]
            );
            if (!filas.length) {
                return res.status(404).json({ mensaje: 'Usuario no encontrado' });
            }

            const objetivo = filas[0];

            if (esSuperAdminUsuario(objetivo)) {
                return res.status(403).json({
                    mensaje: `La cuenta ${SUPER_ADMIN_USERNAME} no puede modificarse`,
                });
            }

            const updates = [];
            const params = [];

            if (username != null && String(username).trim()) {
                const nuevo = String(username).trim();
                if (nuevo !== objetivo.username) {
                    if (esSuperAdminUsername(nuevo)) {
                        return res.status(403).json({
                            mensaje: 'Ese nombre de usuario está reservado para el sistema',
                        });
                    }
                    const existe = await queryAsync(
                        'SELECT id FROM usuarios WHERE username = ? AND id != ?',
                        [nuevo, objetivoId]
                    );
                    if (existe.length) {
                        return res.status(400).json({
                            mensaje: 'Ese nombre de usuario ya existe',
                        });
                    }
                    updates.push('username = ?');
                    params.push(nuevo);
                }
            }

            if (objetivo.rol === 'alumno') {
                if (grado != null && grado !== '') {
                    const g = Number(grado);
                    if (g < 1 || g > 8) {
                        return res.status(400).json({ mensaje: 'Grado no válido' });
                    }
                    if (g !== Number(objetivo.grado)) {
                        updates.push('grado = ?');
                        params.push(g);
                    }
                }
                if (grupo != null && grupo !== '') {
                    const grupos = ['A', 'B', 'C', 'D', 'E', 'S'];
                    if (!grupos.includes(grupo)) {
                        return res.status(400).json({ mensaje: 'Grupo no válido' });
                    }
                    if (grupo !== objetivo.grupo) {
                        updates.push('grupo = ?');
                        params.push(grupo);
                    }
                }
            }

            if (!updates.length) {
                return res.json({ mensaje: 'Sin cambios', perfil: objetivo });
            }

            params.push(objetivoId);
            await queryAsync(
                `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            const actualizado = await queryAsync(
                'SELECT id, username, rol, grado, grupo FROM usuarios WHERE id = ?',
                [objetivoId]
            );

            res.json({
                mensaje: 'Perfil actualizado',
                perfil: actualizado[0],
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ mensaje: 'Error al actualizar perfil' });
        }
    }
);

router.get(
    '/solicitudes-perfil',
    verificarToken,
    verificarAdmin,
    async (req, res) => {
        try {
            const rows = await queryAsync(
                `
                SELECT
                    s.id,
                    s.usuario_id,
                    s.username_nuevo,
                    s.grado_nuevo,
                    s.grupo_nuevo,
                    s.estado,
                    s.fecha_solicitud,
                    u.username AS username_actual,
                    u.grado AS grado_actual,
                    u.grupo AS grupo_actual
                FROM solicitudes_perfil s
                INNER JOIN usuarios u ON s.usuario_id = u.id
                WHERE s.estado = 'pendiente'
                ORDER BY s.fecha_solicitud ASC
                `
            );
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ mensaje: 'Error al obtener solicitudes' });
        }
    }
);

async function aplicarSolicitudPerfil(solicitudId, adminId, aprobar) {
    const solicitudes = await queryAsync(
        `
        SELECT s.*, u.username, u.grado, u.grupo, u.rol
        FROM solicitudes_perfil s
        INNER JOIN usuarios u ON s.usuario_id = u.id
        WHERE s.id = ? AND s.estado = 'pendiente'
        `,
        [solicitudId]
    );

    if (!solicitudes.length) {
        return { error: 'no_encontrada' };
    }

    const s = solicitudes[0];

    if (esSuperAdminUsuario(s)) {
        return { error: 'superadmin_protegido' };
    }

    if (!aprobar) {
        await queryAsync(
            `
            UPDATE solicitudes_perfil
            SET estado = 'rechazada', admin_id = ?, fecha_revision = NOW()
            WHERE id = ?
            `,
            [adminId, solicitudId]
        );
        return { ok: true };
    }

    const updates = [];
    const params = [];

    if (s.username_nuevo) {
        if (esSuperAdminUsername(s.username_nuevo)) {
            return { error: 'username_reservado' };
        }
        const existe = await queryAsync(
            'SELECT id FROM usuarios WHERE username = ? AND id != ?',
            [s.username_nuevo, s.usuario_id]
        );
        if (existe.length) {
            return { error: 'username_duplicado' };
        }
        updates.push('username = ?');
        params.push(s.username_nuevo);
    }

    if (s.grado_nuevo != null) {
        updates.push('grado = ?');
        params.push(s.grado_nuevo);
    }

    if (s.grupo_nuevo) {
        updates.push('grupo = ?');
        params.push(s.grupo_nuevo);
    }

    if (updates.length) {
        params.push(s.usuario_id);
        await queryAsync(
            `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
    }

    await queryAsync(
        `
        UPDATE solicitudes_perfil
        SET estado = 'aprobada', admin_id = ?, fecha_revision = NOW()
        WHERE id = ?
        `,
        [adminId, solicitudId]
    );

    const perfil = await queryAsync(
        'SELECT id, username, rol, grado, grupo FROM usuarios WHERE id = ?',
        [s.usuario_id]
    );

    return { ok: true, perfil: perfil[0], usuarioId: s.usuario_id };
}

router.put(
    '/solicitudes-perfil/:id/aprobar',
    verificarToken,
    verificarAdmin,
    async (req, res) => {
        try {
            const resultado = await aplicarSolicitudPerfil(
                req.params.id,
                req.usuario.id,
                true
            );

            if (resultado.error === 'no_encontrada') {
                return res.status(404).json({ mensaje: 'Solicitud no encontrada' });
            }
            if (resultado.error === 'username_duplicado') {
                return res.status(400).json({
                    mensaje: 'El nombre solicitado ya está en uso',
                });
            }
            if (resultado.error === 'superadmin_protegido') {
                return res.status(403).json({
                    mensaje: `No se puede modificar la cuenta ${SUPER_ADMIN_USERNAME}`,
                });
            }
            if (resultado.error === 'username_reservado') {
                return res.status(403).json({
                    mensaje: 'Ese nombre de usuario está reservado para el sistema',
                });
            }

            res.json({
                mensaje: 'Solicitud aprobada',
                perfil: resultado.perfil,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ mensaje: 'Error al aprobar solicitud' });
        }
    }
);

router.put(
    '/solicitudes-perfil/:id/rechazar',
    verificarToken,
    verificarAdmin,
    async (req, res) => {
        try {
            const resultado = await aplicarSolicitudPerfil(
                req.params.id,
                req.usuario.id,
                false
            );

            if (resultado.error === 'no_encontrada') {
                return res.status(404).json({ mensaje: 'Solicitud no encontrada' });
            }

            res.json({ mensaje: 'Solicitud rechazada' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ mensaje: 'Error al rechazar solicitud' });
        }
    }
);

router.notificarUsuarioPendiente = notificarUsuarioPendiente;
module.exports = router;