-- Copia de DataBase_Nexo/migrations/004_perfil_y_avisos_grado.sql
USE nexo;

CREATE TABLE IF NOT EXISTS `solicitudes_perfil` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `username_nuevo` varchar(100) DEFAULT NULL,
  `grado_nuevo` int DEFAULT NULL,
  `grupo_nuevo` varchar(5) DEFAULT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'pendiente',
  `fecha_solicitud` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_revision` datetime DEFAULT NULL,
  `admin_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `estado` (`estado`),
  CONSTRAINT `solicitudes_perfil_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE `avisos`
  ADD COLUMN `grado_des` int DEFAULT NULL COMMENT 'Solo si rolDes=alumno; NULL=todos los grados' AFTER `rolDes`,
  ADD COLUMN `grupo_des` varchar(5) DEFAULT NULL COMMENT 'Solo si rolDes=alumno; NULL=todos los grupos' AFTER `grado_des`;
