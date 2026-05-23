const express = require('express');
const db = require('./db');
const router = express.Router();
const enviarNotificacion = require('./enviarNotificacion');
const { queryAsync } = require('./utilNotificaciones');
const { verificarToken } = require('./middleware/auth');
const {
  esSuperAdminUsuario,
  esSuperAdminUsername,
} = require('./constantesAdmin');

const GRUPOS_VALIDOS = ['A', 'B', 'C', 'D', 'E', 'S'];

function notificarAdminsPerfil(titulo, mensaje) {
  const sql = `
    SELECT u.token_push
    FROM usuarios u
    LEFT JOIN configuraciones_usuarios c ON u.id = c.usuario_id
    WHERE u.rol = 'admin'
    AND u.autorizado = 1
    AND u.token_push IS NOT NULL
    AND COALESCE(c.notificaciones, 1) = 1
  `;
  db.query(sql, async (err, admins) => {
    if (err) return;
    for (const admin of admins) {
      await enviarNotificacion(admin.token_push, titulo, mensaje, {
        ruta: '/admin',
      });
    }
  });
}

router.get('/mi-perfil', verificarToken, async (req, res) => {
  try {
    const rows = await queryAsync(
      `SELECT id, username, rol, grado, grupo FROM usuarios WHERE id = ?`,
      [req.usuario.id]
    );
    if (!rows.length) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const pendientes = await queryAsync(
      `
      SELECT id, username_nuevo, grado_nuevo, grupo_nuevo, fecha_solicitud
      FROM solicitudes_perfil
      WHERE usuario_id = ? AND estado = 'pendiente'
      ORDER BY fecha_solicitud DESC
      LIMIT 1
      `,
      [req.usuario.id]
    );

    res.json({
      perfil: rows[0],
      solicitudPendiente: pendientes[0] || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al obtener perfil' });
  }
});

router.post('/solicitud-cambio', verificarToken, async (req, res) => {
  if (req.usuario.rol !== 'alumno') {
    return res.status(403).json({
      mensaje: 'Solo los alumnos pueden solicitar cambios con autorización',
    });
  }

  const { username, grado, grupo } = req.body;

  try {
    const actual = await queryAsync(
      'SELECT id, username, grado, grupo, rol FROM usuarios WHERE id = ?',
      [req.usuario.id]
    );
    if (!actual.length) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const u = actual[0];

    if (esSuperAdminUsuario(u)) {
      return res.status(403).json({
        mensaje: 'Esta cuenta no puede modificarse mediante solicitud',
      });
    }
    const usernameNuevo =
      username && String(username).trim() !== u.username
        ? String(username).trim()
        : null;
    const gradoNuevo =
      grado != null && grado !== '' && Number(grado) !== Number(u.grado)
        ? Number(grado)
        : null;
    const grupoNuevo =
      grupo && grupo !== u.grupo && GRUPOS_VALIDOS.includes(grupo)
        ? grupo
        : null;

    if (!usernameNuevo && gradoNuevo == null && !grupoNuevo) {
      return res.status(400).json({
        mensaje: 'Indica al menos un dato distinto al actual',
      });
    }

    if (gradoNuevo != null && (gradoNuevo < 1 || gradoNuevo > 8)) {
      return res.status(400).json({ mensaje: 'Grado no válido' });
    }

    if (usernameNuevo) {
      if (esSuperAdminUsername(usernameNuevo)) {
        return res.status(403).json({
          mensaje: 'Ese nombre de usuario está reservado para el sistema',
        });
      }
      const existe = await queryAsync(
        'SELECT id FROM usuarios WHERE username = ? AND id != ?',
        [usernameNuevo, req.usuario.id]
      );
      if (existe.length) {
        return res.status(400).json({ mensaje: 'Ese nombre de usuario ya existe' });
      }
    }

    const pendiente = await queryAsync(
      `SELECT id FROM solicitudes_perfil WHERE usuario_id = ? AND estado = 'pendiente'`,
      [req.usuario.id]
    );
    if (pendiente.length) {
      return res.status(400).json({
        mensaje: 'Ya tienes una solicitud pendiente de revisión',
      });
    }

    await queryAsync(
      `
      INSERT INTO solicitudes_perfil (usuario_id, username_nuevo, grado_nuevo, grupo_nuevo)
      VALUES (?, ?, ?, ?)
      `,
      [req.usuario.id, usernameNuevo, gradoNuevo, grupoNuevo]
    );

    notificarAdminsPerfil(
      'Solicitud de cambio de perfil',
      `${u.username} solicita actualizar sus datos`
    );

    res.json({ mensaje: 'Solicitud enviada. Un administrador debe aprobarla.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mensaje: 'Error al enviar la solicitud' });
  }
});

module.exports = router;
