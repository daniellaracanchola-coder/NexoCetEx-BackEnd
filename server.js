const express = require('express');
const cors = require('cors');
const app = express();
const notificacionesRoutes = require('./notificaciones');
const admin = require('./firebase');
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.use('/', require('./index'));
app.use('/auth', require('./login'));
app.use('/auth', require('./registro'));
app.use('/admin', require('./admin'));
app.use('/avisos', require ('./avisos'));
app.use('/chats', require('./chats'));
app.use('/config', require('./config'));
app.use('/perfil', require('./perfil'));
app.use('/api/usuarios', notificacionesRoutes);

app.listen(PORT, () => {
    console.log(`Servidor corriendo en ${PORT}`);
});