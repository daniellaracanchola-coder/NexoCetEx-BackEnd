-- Tabla para último mensaje visto (lista de chats + no leídos)
-- Ver también: ../DataBase_Nexo/migrations/002_chat_lecturas.sql

USE nexo;

CREATE TABLE IF NOT EXISTS `chat_lecturas` (
  `usuario_id` int NOT NULL,
  `chat_id` int NOT NULL,
  `ultimo_mensaje_visto_id` int NOT NULL DEFAULT '0',
  `fecha_lectura` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`usuario_id`, `chat_id`),
  KEY `chat_id` (`chat_id`),
  CONSTRAINT `chat_lecturas_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_lecturas_ibfk_2` FOREIGN KEY (`chat_id`) REFERENCES `chats` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
