/** Cuenta raíz del sistema: no se puede eliminar ni modificar su identidad. */
const SUPER_ADMIN_USERNAME = 'SuperAdmin';

function esSuperAdminUsuario(usuario) {
  if (!usuario) return false;
  return String(usuario.username) === SUPER_ADMIN_USERNAME;
}

function esSuperAdminUsername(username) {
  return String(username || '') === SUPER_ADMIN_USERNAME;
}

module.exports = {
  SUPER_ADMIN_USERNAME,
  esSuperAdminUsuario,
  esSuperAdminUsername,
};
