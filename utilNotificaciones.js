const db = require('./db');
const enviarNotificacion = require('./enviarNotificacion');
const { SQL_USUARIO_RECIBE_AVISO } = require('./utilAvisos');

const SQL_USUARIOS_CON_PUSH = `
  FROM usuarios u
  LEFT JOIN configuraciones_usuarios c ON u.id = c.usuario_id
  WHERE u.autorizado = 1
  AND u.token_push IS NOT NULL
  AND COALESCE(c.notificaciones, 1) = 1
`;

function queryAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

function truncarTexto(texto, max = 120) {
  if (!texto) return '';
  const limpio = String(texto).replace(/\s+/g, ' ').trim();
  if (limpio.length <= max) return limpio;
  return `${limpio.slice(0, max - 3)}...`;
}

async function notificarTokens(usuarios, titulo, mensaje, ruta = '/home') {
  for (const usuario of usuarios) {
    if (usuario.token_push) {
      await enviarNotificacion(usuario.token_push, titulo, mensaje, { ruta });
    }
  }
}

async function notificarPorRoles(
  roles,
  titulo,
  mensaje,
  excluirUsername = null,
  ruta = '/home'
) {
  if (!roles.length) return;

  const placeholders = roles.map(() => '?').join(',');
  let sql = `SELECT u.token_push ${SQL_USUARIOS_CON_PUSH} AND u.rol IN (${placeholders})`;
  const params = [...roles];

  if (excluirUsername) {
    sql += ' AND u.username != ?';
    params.push(excluirUsername);
  }

  const usuarios = await queryAsync(sql, params);
  await notificarTokens(usuarios, titulo, mensaje, ruta);
}

async function notificarPorUsername(
  username,
  titulo,
  mensaje,
  ruta = '/home'
) {
  if (!username) return;

  const sql = `SELECT u.token_push ${SQL_USUARIOS_CON_PUSH} AND u.username = ?`;
  const usuarios = await queryAsync(sql, [username]);
  await notificarTokens(usuarios, titulo, mensaje, ruta);
}

async function notificarPorId(usuarioId, titulo, mensaje, ruta = '/home') {
  const sql = `SELECT u.token_push ${SQL_USUARIOS_CON_PUSH} AND u.id = ?`;
  const usuarios = await queryAsync(sql, [usuarioId]);
  await notificarTokens(usuarios, titulo, mensaje, ruta);
  return usuarios.length > 0;
}

async function notificarAutorizacionUsuario(usuarioId) {
  const enviado = await notificarPorId(
    usuarioId,
    'Cuenta autorizada',
    'Tu cuenta en NEXO fue aprobada. Ya puedes iniciar sesión.',
    '/login'
  );

  if (enviado) {
    await queryAsync(
      'UPDATE usuarios SET aviso_autorizacion_pendiente = 0 WHERE id = ?',
      [usuarioId]
    );
  }

  return enviado;
}

async function obtenerUsuariosSinLeerAviso(avisoId) {
  const sql = `
    SELECT u.token_push, u.username
    ${SQL_USUARIOS_CON_PUSH}
    AND NOT EXISTS (
      SELECT 1 FROM avisos_vistos v
      WHERE v.aviso_id = ? AND v.username = u.username
    )
    AND EXISTS (
      SELECT 1 FROM avisos a
      WHERE a.id = ?
      AND ${SQL_USUARIO_RECIBE_AVISO}
    )
  `;

  return queryAsync(sql, [avisoId, avisoId]);
}

async function notificarRecordatorioAviso(avisoId) {
  const avisos = await queryAsync(
    'SELECT titulo, conte FROM avisos WHERE id = ?',
    [avisoId]
  );

  if (!avisos.length) {
    return { enviados: 0, error: 'aviso_no_encontrado' };
  }

  const aviso = avisos[0];
  const usuarios = await obtenerUsuariosSinLeerAviso(avisoId);

  await notificarTokens(
    usuarios,
    `Recordatorio: ${aviso.titulo}`,
    truncarTexto(aviso.conte) || 'Tienes un aviso pendiente de leer en NEXO',
    '/home'
  );

  return { enviados: usuarios.length };
}

module.exports = {
  truncarTexto,
  notificarPorRoles,
  notificarPorUsername,
  notificarPorId,
  notificarAutorizacionUsuario,
  obtenerUsuariosSinLeerAviso,
  notificarRecordatorioAviso,
  queryAsync,
};
