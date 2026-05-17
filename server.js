const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;

app.use('/', require('./index'));
app.use('/auth', require('./login'));
app.use('/auth', require('./registro'));
app.use('/admin', require('./admin'));
app.use('/avisos', require ('./avisos'));
app.use('/chats', require('./chats'));

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});