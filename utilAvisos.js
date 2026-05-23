/**
 * Condición SQL: el usuario u debe recibir/ver el aviso a (tablas u, a).
 */
const SQL_USUARIO_RECIBE_AVISO = `
  (
    a.rolDes = 'todos'
    OR u.rol = a.rolDes
    OR u.username = a.autor
  )
  AND (
    a.rolDes != 'alumno'
    OR a.grado_des IS NULL
    OR u.grado = a.grado_des
  )
  AND (
    a.rolDes != 'alumno'
    OR a.grupo_des IS NULL
    OR u.grupo = a.grupo_des
  )
`;

/**
 * Filtro en memoria (app) para un aviso y el usuario en sesión.
 */
function usuarioVeAviso(usuario, aviso) {
  if (!usuario) return false;
  if (usuario.rol === 'admin') return true;
  if (aviso.rolDes === 'todos') return true;
  if (usuario.username === aviso.autor) return true;
  if (aviso.rolDes !== usuario.rol) return false;

  if (aviso.rolDes === 'alumno') {
    if (
      aviso.grado_des != null &&
      aviso.grado_des !== '' &&
      Number(usuario.grado) !== Number(aviso.grado_des)
    ) {
      return false;
    }
    if (
      aviso.grupo_des != null &&
      aviso.grupo_des !== '' &&
      usuario.grupo !== aviso.grupo_des
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Params para notificación push al crear aviso (sin JOIN a).
 */
function sqlPushDestinatariosAviso() {
  return `
    AND (
      ? = 'todos'
      OR u.rol = ?
    )
    AND u.username != ?
    AND (
      ? != 'alumno'
      OR ? IS NULL
      OR u.grado = ?
    )
    AND (
      ? != 'alumno'
      OR ? IS NULL
      OR u.grupo = ?
    )
  `;
}

function paramsPushAviso(autor, rolDes, gradoDes, grupoDes) {
  const rol = rolDes || 'todos';
  const g = gradoDes != null && gradoDes !== '' ? Number(gradoDes) : null;
  const gr = grupoDes || null;
  return [rol, rol, autor, rol, g, g, rol, gr, gr];
}

module.exports = {
  SQL_USUARIO_RECIBE_AVISO,
  usuarioVeAviso,
  sqlPushDestinatariosAviso,
  paramsPushAviso,
};
