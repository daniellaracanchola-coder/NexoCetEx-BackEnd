const crypto = require('crypto');
const algoritmo = 'aes-256-cbc';
const clave = crypto
    .createHash('sha256')
    .update(process.env.CHAT_SECRET)
    .digest();

function encriptarMensaje(texto) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
        algoritmo,
        clave,
        iv
    );

    let encriptado = cipher.update(
        texto,
        'utf8',
        'hex'
    );

    encriptado += cipher.final('hex');
    return iv.toString('hex') + ':' + encriptado;
}

function desencriptarMensaje(textoEncriptado) {
    const partes = textoEncriptado.split(':');

    const iv = Buffer.from(partes[0], 'hex');
    const contenidoEncriptado = partes[1];

    const decipher = crypto.createDecipheriv(
        algoritmo,
        clave,
        iv
    );

    let desencriptado = decipher.update(
        contenidoEncriptado,
        'hex',
        'utf8'
    );
    
    desencriptado += decipher.final('utf8');
    return desencriptado;
}

module.exports = {
    encriptarMensaje,
    desencriptarMensaje
};