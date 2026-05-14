const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

let dudas = [];

app.get('/', (req, res) => {
    res.status(200).send('Envio Correcto');
});

app.get('/dudas', (req,res) => {
    res.json(dudas);
});

app.post('/dudas', (req, res) => {
    if (!req.body.conte || !req.body.autor) {
        return res.status(400).json({
            mensaje: 'Faltan datos'
        });
    }

    const nuevaDuda = {
        id: Date.now(),
        ...req.body,
        respuestas: [],
        importancia: false,
        revision: false
    };

    dudas.unshift(nuevaDuda);
    res.json(nuevaDuda);
});

app.post('/dudas/:id/respuestas', (req, res) => {
    const duda = dudas.find(d => d.id == req.params.id);
    if (!req.body.conte || !req.body.autor) {
        return res.status(400).json({
            mensaje: 'Datos de la respuesta incompletos'
        });
    }

    if(!duda) {
        return res.status(404).json({
            mensaje: 'Duda no encontrada'
        });
    }
    const respuesta = {
    autor: req.body.autor,
    conte: req.body.conte,
    fecha: new Date().toISOString()
    };
    duda.respuestas.push(respuesta);

    res.json(duda);
});

app.delete('/dudas/:id', (req, res) => {
    dudas = dudas.filter(d => d.id != req.params.id);

    res.json({
        mensaje: 'Duda eliminada'
    });
});

app.put('/dudas/:id/revision', (req, res) => {
    const duda = dudas.find(d => d.id == req.params.id);

    if(!duda) {
        return res.status(404).json({
            mensaje: 'Duda no encontrada'
        });
    }

    duda.revision = !duda.revision;
    res.json(duda);
});

app.put('/dudas/:id/importancia', (req, res) => {
    const duda = dudas.find(d => d.id == req.params.id);

    if (!duda) {
        return res.status(404).json({
            mensaje: 'Duda no encontrada'
        });
    }
    duda.importancia = !duda.importancia;
    res.json(duda);
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});