const express = require('express');
const db = require('./db');
const router = express.Router();

router.get('/', (req, res) => {
    res.status(200).send('Envio Correcto');
});

router.get('/dudas', (req,res) => {
    db.query('SELECT * FROM dudas', (err, results) => {
        if(err) {
            return res.status(500).json({
                mensaje: 'Error al obtener dudas'
            });
        }
        db.query('SELECT * FROM respuestas', (err, respuestas) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al obtener las respuestas'
                });
            }

            const dudasCompletas = results.map(duda => ({
                ...duda,
                respuestas: respuestas.filter(
                    r => r.duda_id == duda.id
                )
            }));
            res.json(dudasCompletas);
        });
    });
});

router.post('/dudas', (req, res) => {
    if (!req.body.conte || !req.body.autor) {
        return res.status(400).json({
            mensaje: 'Faltan datos'
        });
    }

    const sql = `
        INSERT INTO dudas (autor, conte, importancia, revision)
        VALUES (?, ?, false, false)
    `;
    
    db.query(
        sql,
        [req.body.autor, req.body.conte],
        (err, result) => {
            if(err) {
                return res.status(500).json({
                    mensaje: 'Error al guardar duda'
                });
            }
            res.json({
                id: result.insertId,
                autor: req.body.autor,
                conte: req.body.conte,
                respuestas: [],
                importancia: false,
                revision: false
            });
        }
    );
});

router.post('/dudas/:id/respuestas', (req, res) => {

    if (!req.body.conte || !req.body.autor) {
        return res.status(400).json({
            mensaje: 'Datos de la respuesta incompletos'
        });
    }

    const sql = `
        INSERT INTO respuestas (duda_id, autor, conte, fecha)
        VALUES (?, ?, ?, NOW())
    `;

    db.query(
        sql,
        [
            req.params.id,
            req.body.autor,
            req.body.conte
        ],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al guardar la respuesta'
                });
            }

            res.json({
                mensaje: 'Respuesta Guardada'
            });
        }
    );
});

router.delete('/dudas/:id', (req, res) => {
    db.query(
        `DELETE FROM respuestas WHERE duda_id = ?`,
        [req.params.id],
        (err) => {
            if(err) {
                return res.status(500).json({
                    mensaje: 'Error al eliminar las respuestas'
                });
            }
            db.query(
                'DELETE FROM dudas WHERE id = ? ',
                [req.params.id],
                (err, result) => {
                    if(err) {
                        return res.status(500).json({
                            mensaje: 'Error al eliminar la duda'
                        });
                    }
                    res.json({
                        mensaje: 'Duda eliminada correctamente'
                    });
                }
            );
        }
    );
});

router.put('/dudas/:id/revision', (req, res) => {
    const sql = `
        UPDATE dudas
        SET revision = NOT revision
        WHERE id = ?
    `;

    db.query(
        sql,
        [req.params.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al cambiar a revision'
                });
            }

            db.query(
                `SELECT revision FROM dudas WHERE id = ?`,
                [req.params.id],
                (err, result) => {
                    res.json(result[0]);
                }
            );
        }
    );
});

router.put('/dudas/:id/importancia', (req, res) => {
    const sql = `
        UPDATE dudas
        SET importancia = NOT importancia
        WHERE id = ?
    `;

    db.query(
        sql,
        [req.params.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al cambiar la importancia de la duda'
                });
            }

            db.query(
                `SELECT importancia FROM dudas WHERE id = ?`,
                [req.params.id],
                (err, result) => {
                    res.json(result[0]);
                }
            );
        }
    );
});

module.exports = router;