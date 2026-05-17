const express = require('express');
const db = require('./db');

const {
    verificarToken
} = require('./middleware/auth');

const {
    encriptarMensaje,
    desencriptarMensaje
} = require('./Seguridad/cryptoSend');

const router = express.Router();

//Para buscar usuarios
router.get(
    '/usuarios', 
    verificarToken,
(req, res) => {
    const buscar = req.query.buscar || '';

    const sql = `
    SELECT id, username, rol, grado, grupo
    FROM usuarios
    WHERE autorizado = 1
    AND username LIKE ?
    AND id != ?
    `;

    db.query(
        sql,
        [`%${buscar}%`, req.usuario.id],
        (err, result) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al buscar usuarios'
                });
            }

            res.json(result);
        }
    );
});

//Para crear chat directo
router.post(
    '/directo', 
    verificarToken,
(req, res) => {
    const { usuarioDestinoId } = req.body;
    const usuarioActualId = req.usuario.id;

    if (!usuarioDestinoId) {
        return res.status(400).json({
            mensaje: 'Falta un usuario destino'
        });
    }

    //Verifica si ya existia un chat directo con el usuario
    const verificarSql = `
        SELECT c.id
        FROM chats c
        INNER JOIN chat_integrantes ci1
            ON c.id = ci1.chat_id
        INNER JOIN chat_integrantes ci2
            ON c.id = ci2.chat_id
        WHERE c.tipo = 'directo'
        AND ci1.usuario_id = ?
        AND ci2.usuario_id = ?
        LIMIT 1
    `;

    db.query(
        verificarSql,
        [usuarioActualId, usuarioDestinoId],
        (err, chatsExistentes) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al verificar chat'
                });
            }

            //Para cuando ya existia
            if (chatsExistentes.length > 0) {
                return res.json({
                    mensaje: 'Chat ya existente',
                    chatId: chatsExistentes[0].id
                });
            }

            //Para si no existia el chat
            const crearChatSql = `
                INSERT INTO chats (nombre, tipo , creado_por)
                VALUES (NULL, 'directo', ?)
            `;

            db.query(crearChatSql, [usuarioActualId], (err, result) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al crear chat'
                    });
                }
                const chatId = result.insertId;

                const integrantesSql = `
                    INSERT INTO chat_integrantes (chat_id, usuario_id)
                    VALUES (?, ?), (?, ?)
                `;

                db.query(
                    integrantesSql,
                    [
                        chatId, usuarioActualId,
                        chatId, usuarioDestinoId
                    ],
                    (err) => {
                        if (err) {
                            return res.status(500).json({
                                mensaje: 'Error al agregar integrantes'
                            });
                        }

                        res.json({
                            mensaje: 'Chat directo creado',
                            chatId
                        });
                    }
                );
            });
        }
    );
});

//Para crear un grupo
router.post(
    '/grupo',
    verificarToken,
    (req, res) => {
    const { nombre, integrantes } = req.body;
    const usuarioActualId = req.usuario.id;

    if (!nombre || !integrantes || integrantes.length === 0) {
        return res.status(400).json({
            mensaje: 'Faltan datos del grupo'
        });
    }

    const crearGrupoSql = `
    INSERT INTO chats (nombre, tipo, creado_por)
    VALUES (?, 'grupo', ?)
    `;

    db.query(crearGrupoSql, [nombre, usuarioActualId], (err, result) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al crear el grupo'
            });
        }

        const chatId = result.insertId;

        const todosIntegrantes = [
            usuarioActualId,
            ...integrantes
        ];

        const valores = todosIntegrantes.map(id => [
            chatId,
            id
        ]);

        const sqlIntegrantes = `
            INSERT INTO chat_integrantes (chat_id, usuario_id)
            VALUES ?
        `;

        db.query(sqlIntegrantes, [valores], (err) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al agregar integrantes'
                });
            }

            res.json({
                mensaje: 'Grupo creado',
                chatId
            });
        });
    });
});

//Para obtener los chats del usuario
router.get(
    '/mis-chats',
    verificarToken,
    (req, res) => {
    const usuarioId = req.usuario.id;

    const sql = `
        SELECT 
            c.id,
            c.nombre,
            c.tipo,
            c.grado,
            c.grupo,
            c.creado_por,
            c.fecha_creacion,
            CASE
                WHEN c.tipo = 'directo' THEN (
                SELECT u.username
                FROM chat_integrantes ci2
                INNER JOIN usuarios u
                    ON ci2.usuario_id = u.id
                WHERE ci2.chat_id = c.id
                AND ci2.usuario_id != ?
                LIMIT 1
                )
                ELSE c.nombre
            END AS nombreMostrar
        FROM chats c
        INNER JOIN chat_integrantes ci
            ON c.id = ci.chat_id
        WHERE ci.usuario_id = ?
        ORDER BY c.fecha_creacion DESC
    `;

    db.query(sql, [usuarioId, usuarioId], (err, result) => {
        if (err) {
            return res.status(500).json({
                mensaje: 'Error al obtener chats'
            });
        }

        res.json(result);
    });
});

//Crear chat por grado y grupo
router.post(
    '/aula',
    verificarToken,
    (req, res) => {
        const usuario = req.usuario;

        const obtenerUsuarioSql = `
            SELECT id, grado, grupo
            FROM usuarios
            WHERE id = ?
        `;

        db.query(
            obtenerUsuarioSql,
            [usuario.id],
            (err, result) => {
                if (err || result.length === 0) {
                    return res.status(500).json({
                        mensaje: 'Error al obtener el usuario'
                    });
                }

                const usuarioDB = result[0];

                if (!usuarioDB.grado || !usuarioDB.grupo) {
                    return res.status(400).json({
                        mensaje: 'El usuario no tiene grado o grupo'
                    });
                }

                const nombreGrupo = `${usuarioDB.grado}${usuarioDB.grupo}`;

                const buscarChatSql = `
                    SELECT *
                    FROM chats
                    WHERE tipo = 'aula'
                    AND grado = ?
                    AND grupo = ?
                `;

                db.query(
                    buscarChatSql,
                    [usuarioDB.grado, usuarioDB.grupo],
                    (err, chats) => {
                        if (err) {
                            return res.status(500).json({
                                mensaje: 'Error al buscar aula'
                            });
                        }

                        if (chats.length === 0) {
                            const crearChatSql = `
                                INSERT INTO chats
                                (nombre, tipo, grado, grupo, creado_por)
                                VALUES (?, 'aula', ?, ?, ?)
                            `;

                            db.query(
                                crearChatSql,
                                [
                                    nombreGrupo,
                                    usuarioDB.grado,
                                    usuarioDB.grupo,
                                    usuario.id
                                ],
                                (err, result) => {
                                    if (err) {
                                        return res.status(500).json({
                                            mensaje: 'Error al crear aula'
                                        });
                                    }

                                    agregarIntegrante(result.insertId);
                                }
                            );
                        } else {
                            agregarIntegrante(chats[0].id);
                        }
                    }
                );

                function agregarIntegrante(chatId) {
                    const sql = `
                        INSERT IGNORE INTO chat_integrantes
                        (chat_id, usuario_id)
                        VALUES (?, ?)
                    `;

                    db.query(
                        sql,
                        [chatId, usuario.id],
                        (err) => {
                            if (err) {
                                return res.status(500).json({
                                    mensaje: 'Error al agregar al integrante al grupo'
                                });
                            }

                            res.json({
                                mensaje: 'Grupo del aula listo',
                                chatId
                            });
                        }
                    );
                }
            }
        );
    }
);

// Para los mensajes del chat
router.get(
    '/:id/mensajes',
    verificarToken,
    (req, res) => {
        const chatId = req.params.id;
        const usuarioId = req.usuario.id;

        const verificarSql = `
            SELECT *
            FROM chat_integrantes
            WHERE chat_id = ? AND usuario_id = ?
        `;

        db.query(verificarSql, [chatId, usuarioId], (err, integrantes) => {
            if(err) {
                return res.status(500).json({
                    mensaje: 'Error al verificar integrantes'
                });
            }

            if (integrantes.length === 0) {
                return res.status(403).json({
                    mensaje: 'No perteneces a este chat'
                });
            }

            const mensajesSql = `
                SELECT
                    m.id,
                    m.contenido,
                    m.fecha,
                    u.username
                FROM mensajes m
                INNER JOIN usuarios u
                    ON m.usuario_id = u.id
                WHERE m.chat_id = ?
                ORDER BY m.fecha ASC
            `;

            db.query(mensajesSql, [chatId], (err, mensajes) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al obtener mensajes'
                    });
                }

                const mensajesDesencriptados = mensajes.map(m => ({
                    ...m,
                    contenido: desencriptarMensaje(m.contenido)
                }));

                res.json(mensajesDesencriptados);
            });
        });
    }
);

//Para enviar los mensajes
router.post(
    '/:id/mensajes',
    verificarToken,
    (req, res) => {
        const chatId = req.params.id;
        const usuarioId = req.usuario.id;
        const { contenido } = req.body;

        if (!contenido) {
            return res.status(400).json({
                mensaje: 'El mensaje no puede estar vacio'
            });
        }

        const verificarSql = `
            SELECT *
            FROM chat_integrantes
            WHERE chat_id = ? AND usuario_id = ?
        `;

        db.query(verificarSql, [chatId, usuarioId], (err, integrantes) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al verificar integrante'
                });
            }

            if (integrantes.length === 0) {
                return res.status(403).json({
                    mensaje: 'No perteneces a este chat'
                });
            }

            const insertarSQL = `
                INSERT INTO mensajes (chat_id, usuario_id, contenido)
                VALUES (?, ?, ?)
            `;

            const contenidoEncriptado = encriptarMensaje(contenido);

            db.query(insertarSQL, [chatId, usuarioId, contenidoEncriptado], (err, result) => {
                if(err) {
                    return res.status(500).json({
                        mensaje: 'Error al enviar el mensaje'
                    });
                }

                res.json({
                    mensaje: 'Mensaje enviado con exito',
                    id: result.insertId
                });
            });
        });
    }
);

//Agregar usuario a un chat
router.post(
    '/:id/integrantes',
    verificarToken,
    (req, res) => {
        const chatId = req.params.id;
        const usuarioActualId = req.usuario.id;
        const { usuarioId } = req.body;

        if (!usuarioId) {
            return res.status(400).json({
                mensaje: 'Falta usuario'
            });
        }

        const verificarCreadorSql = `
            SELECT *
            FROM chats
            WHERE id = ? AND creado_por = ?
        `;

        db.query(verificarCreadorSql, [chatId, usuarioActualId], (err, chats) => {
            if (err) {
                return res.status(500).json ({
                    mensaje: 'Error al verificar creador'
                });
            }

            if (chats.length === 0) {
                return res.status(403).json({
                    mensaje: 'Solo el creador puede agregar usuarios'
                });
            }

            const agregarSql = `
                INSERT IGNORE INTO chat_integrantes (chat_id, usuario_id)
                VALUES (?, ?)
            `;

            db.query(agregarSql, [chatId, usuarioId], (err) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al agregar usuario'
                    });
                }

                res.json({
                    mensaje: 'Usuario agregado al chat'
                });
            });
        });
    }
);

//Para eliminar un usuario del chat
router.delete(
    '/:id/integrantes/:usuarioId',
    verificarToken,
    (req, res) => {
        const chatId = req.params.id;
        const usuarioId = req.params.usuarioId;
        const usuarioActualId = req.usuario.id;

        const verificarCreadorSql = `
            SELECT *
            FROM chats
            WHERE id = ? AND creado_por = ?
        `;

        db.query(verificarCreadorSql, [chatId, usuarioActualId], (err, chats) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al verificar creador'
                });
            }

            if (chats.length === 0) {
                return res.status(403).json({
                    mensaje: 'Solo el creador puede eliminar usuarios'
                });
            }

            if (Number(usuarioId) === usuarioActualId) {
                return res.status(400).json({
                    mensaje: 'No puedes eliminarte a ti mismo del chat que creaste'
                });
            }

            const eliminarSQL = `
                DELETE FROM chat_integrantes
                WHERE chat_id = ? AND usuario_id = ?
            `;

            db.query(eliminarSQL, [chatId, usuarioId], (err) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al eliminar usuario'
                    });
                }

                res.json({
                    mensaje: 'Usuario eliminado del chat'
                });
            });
        });
    }
);

//Para cambiar el nombre del chat
router.put(
    '/:id/nombre',
    verificarToken,
    (req, res) => {
        const chatId = req.params.id;
        const usuarioActualId = req.usuario.id;
        const { nombre } = req.body;

        if (!nombre) {
            return res.status(400).json({
                mensaje: 'Falta nombre del chat'
            });
        }

        const sql = `
            UPDATE chats
            SET nombre = ?
            WHERE id = ? AND creado_por = ?
        `;

        db.query(sql, [nombre, chatId, usuarioActualId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al cambiar nombre'
                });
            }

            if (result.affectedRows === 0) {
                return res.status(403).json({
                    mensaje: 'Solo el creador puede cambiar el nombre'
                });
            }

            res.json({
                mensaje: 'Nombre actualizado con exito'
            });
        });
    }
);

// Obtener integrantes de un chat
router.get(
    '/:id/integrantes',
    verificarToken,
    (req, res) => {
        const chatId = req.params.id;
        const usuarioActualId = req.usuario.id;

        const verificarSql = `
            SELECT *
            FROM chat_integrantes
            WHERE chat_id = ? AND usuario_id = ?
        `;

        db.query(verificarSql, [chatId, usuarioActualId], (err, pertenece) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al verificar el integrante'
                });
            }

            if (pertenece.length === 0) {
                return res.status(403).json({
                    mensaje: 'No perteneces a este chat'
                });
            }

            const integrantesSql = `
                SELECT
                    u.id,
                    u.username,
                    u.rol,
                    u.grado,
                    u.grupo
                FROM chat_integrantes ci
                INNER JOIN usuarios u
                    ON ci.usuario_id = u.id
                WHERE ci.chat_id = ?
            `;

            db.query(integrantesSql, [chatId], (err, integrantes) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al obtener integrantes'
                    });
                }

                res.json(integrantes);
            });
        });
    }
);

//Para eliminar chat
router.delete(
    '/:id',
    verificarToken,
    (req, res) => {
        const chatId = req.params.id;
        const usuarioActualId = req.usuario.id;

        const sql = `
            DELETE FROM chats
            WHERE id = ? AND creado_por = ?
        `;

        db.query(sql, [chatId, usuarioActualId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    mensaje: 'Error al eliminar el chat'
                });
            }

            if (result.affectedRows === 0) {
                return res.status(403).json({
                    mensaje: 'Solo el creador puede eliminar este chat'
                });
            }

            res.json({
                mensaje: 'Chat eliminado correctamente'
            });
        });
    }
);



module.exports = router;