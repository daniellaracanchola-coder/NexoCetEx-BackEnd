const jwt = require('jsonwebtoken');
const verificarToken = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            mensaje: 'Token requerido'
        });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            mensaje: 'Token invalido'
        });
    }

    try{
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );
        req.usuario = decoded;
        next();
    } catch (error) {
        return res.status(403).json({
            mensaje: 'Token invalido o expirado'
        });
    }
};

const verificarAdmin = (req, res, next) => {
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({
            mensaje: 'Acceso solo para administradores'
        });
    }
    next();
};

module.exports = {
    verificarToken,
    verificarAdmin
};