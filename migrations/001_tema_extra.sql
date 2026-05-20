-- Migración: tema "extra" (Mensajería) — alineado con DataBase_Nexo
-- La definición oficial en DataBase_Nexo.sql usa VARCHAR(20) + CHECK.

USE nexo;

ALTER TABLE `configuraciones_usuarios`
  MODIFY COLUMN `tema` varchar(20) NOT NULL DEFAULT 'sistema'
    COMMENT 'sistema, claro, oscuro, extra';

UPDATE `configuraciones_usuarios`
SET `tema` = 'sistema'
WHERE `tema` IS NULL OR `tema` NOT IN ('sistema', 'claro', 'oscuro', 'extra');

-- Si tu BD antigua usaba ENUM sin 'extra', el MODIFY anterior ya lo convierte a VARCHAR.
-- Para restricción en servidor existente, ver también:
--   ../DataBase_Nexo/actualizar_configuracion.sql
