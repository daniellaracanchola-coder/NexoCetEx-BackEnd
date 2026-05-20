const express = require('express');
const db = require('./db');
const enviarNotificacion = require('./enviarNotificacion');

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
            END AS nombreMostrar,
            um.id AS ultimoMensajeId,
            um.fecha AS ultimoMensajeFecha,
            um.contenido AS ultimoMensajeContenido,
            um.usuario_id AS ultimoMensajeUsuarioId,
            umu.username AS ultimoMensajeUsername,
            COALESCE(cl.ultimo_mensaje_visto_id, 0) AS ultimoMensajeVistoId,
            (
                SELECT COUNT(*)
                FROM mensajes m
                WHERE m.chat_id = c.id
                AND m.id > COALESCE(cl.ultimo_mensaje_visto_id, 0)
                AND m.usuario_id != ?
            ) AS mensajesNoLeidos
        FROM chats c
        INNER JOIN chat_integrantes ci
            ON c.id = ci.chat_id
        LEFT JOIN chat_lecturas cl
            ON cl.chat_id = c.id AND cl.usuario_id = ?
        LEFT JOIN mensajes um ON um.id = (
            SELECT m2.id
            FROM mensajes m2
            WHERE m2.chat_id = c.id
            ORDER BY m2.fecha DESC, m2.id DESC
            LIMIT 1
        )
        LEFT JOIN usuarios umu ON umu.id = um.usuario_id
        WHERE ci.usuario_id = ?
        ORDER BY COALESCE(um.fecha, c.fecha_creacion) DESC
    `;

    db.query(
        sql,
        [usuarioId, usuarioId, usuarioId, usuarioId],
        (err, result) => {
        if (err) {
            console.error('Error mis-chats:', err);
            return res.status(500).json({
                mensaje: 'Error al obtener chats'
            });
        }

        const chatsConPreview = result.map((chat) => {
            let preview = '';
            if (chat.ultimoMensajeContenido) {
                try {
                    preview = desencriptarMensaje(chat.ultimoMensajeContenido);
                } catch (e) {
                    preview = '[Mensaje no disponible]';
                }
                if (preview.length > 80) {
                    preview = `${preview.substring(0, 80)}…`;
                }
                if (Number(chat.ultimoMensajeUsuarioId) === usuarioId) {
                    preview = `Tú: ${preview}`;
                } else if (chat.ultimoMensajeUsername) {
                    preview = `${chat.ultimoMensajeUsername}: ${preview}`;
                }
            }

            return {
                id: chat.id,
                nombre: chat.nombre,
                tipo: chat.tipo,
                grado: chat.grado,
                grupo: chat.grupo,
                creado_por: chat.creado_por,
                fecha_creacion: chat.fecha_creacion,
                nombreMostrar: chat.nombreMostrar,
                ultimoMensajeId: chat.ultimoMensajeId,
                ultimoMensajeFecha: chat.ultimoMensajeFecha,
                ultimoMensajePreview: preview || null,
                mensajesNoLeidos: Number(chat.mensajesNoLeidos) || 0,
            };
        });

        res.json(chatsConPreview);
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
                    m.usuario_id,
                    m.contenido,
                    m.fecha,
                    u.username
                FROM mensajes m
                INNER JOIN usuarios u
                    ON m.usuario_id = u.id
                WHERE m.chat_id = ?
                ORDER BY m.fecha ASC, m.id ASC
            `;

            db.query(mensajesSql, [chatId], (err, mensajes) => {
                if (err) {
                    return res.status(500).json({
                        mensaje: 'Error al obtener mensajes'
                    });
                }

                const mensajesDesencriptados = mensajes.map(m => {
                    try {
                        return{
                            ...m,
                            contenido: desencriptarMensaje(m.contenido)
                        };
                    } catch (error) {
                        console.error('Error al desencriptar el mensaje:', error.message);

                        return{
                            ...m,
                            contenido: '[Mensaje no disponible]'
                        };
                    }
                });

                const marcarLeidoSql = `
                    INSERT INTO chat_lecturas (usuario_id, chat_id, ultimo_mensaje_visto_id)
                    VALUES (
                        ?,
                        ?,
                        COALESCE(
                            (SELECT MAX(m.id) FROM mensajes m WHERE m.chat_id = ?),
                            0
                        )
                    )
                    ON DUPLICATE KEY UPDATE
                        ultimo_mensaje_visto_id = VALUES(ultimo_mensaje_visto_id),
                        fecha_lectura = CURRENT_TIMESTAMP
                `;

                db.query(marcarLeidoSql, [usuarioId, chatId, chatId], (errLeido) => {
                    if (errLeido) {
                        console.error('Error marcar leido (tabla chat_lecturas?):', errLeido);
                    }
                    res.json(mensajesDesencriptados);
                });
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

                const obtenerTokenSql = `
                    SELECT u.token_push, u.username
                    FROM chat_integrantes ci
                    INNER JOIN usuarios u
                        ON ci.usuario_id = u.id
                    LEFT JOIN configuraciones_usuarios c
                        ON u.id = c.usuario_id
                    WHERE ci.chat_id = ?
                    AND ci.usuario_id != ?
                    AND u.token_push IS NOT NULL
                    AND COALESCE(c.notificaciones, 1) = 1
                `;

                const obtenerEmisorSql = `
                    SELECT username
                    FROM usuarios
                    WHERE id = ?
                `;

                db.query(obtenerEmisorSql, [usuarioId], (err, usuarioResult) => {

                if (err || usuarioResult.length === 0) {
                    console.error('Error al obtener usuario:', err);

                    return res.status(500).json({
                        mensaje: 'Error al obtener usuario'
                    });
                }

                const usernameEmisor = usuarioResult[0].username;

                db.query(obtenerTokenSql, [chatId, usuarioId], async (err, usuarios) => {

                    if (err) {
                        console.error('Error al obtener tokens:', err);
                    } else {

                        for (const usuario of usuarios) {

                            await enviarNotificacion(
                                usuario.token_push,
                                usernameEmisor,
                                desencriptarMensaje(contenidoEncriptado)
                            );

                        }

                    }

                    res.json({
                        mensaje: 'Mensaje enviado con exito',
                        id: result.insertId
                    });

                });

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