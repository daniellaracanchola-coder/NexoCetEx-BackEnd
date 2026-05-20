-- Actualización para bases de datos NEXO ya creadas (localhost o Render)
-- Ejecutar sobre la base de datos `nexo`.
-- Compatible con nexo-ceti-express (tema "extra" = Mensajería).

USE nexo;

-- 1) Columnas VARCHAR: guardan sistema, claro, oscuro y extra
ALTER TABLE `configuraciones_usuarios`
  MODIFY COLUMN `tema` varchar(20) NOT NULL DEFAULT 'sistema'
    COMMENT 'sistema, claro, oscuro, extra',
  MODIFY COLUMN `tamano_letra` varchar(20) NOT NULL DEFAULT 'normal'
    COMMENT 'normal, grande, muy-grande',
  MODIFY COLUMN `alto_contraste` tinyint(1) NOT NULL DEFAULT '0',
  MODIFY COLUMN `notificaciones` tinyint(1) NOT NULL DEFAULT '1';

-- 2) Corregir filas con valores no válidos (por si hubiera datos viejos)
UPDATE `configuraciones_usuarios`
SET `tema` = 'sistema'
WHERE `tema` IS NULL OR `tema` NOT IN ('sistema', 'claro', 'oscuro', 'extra');

UPDATE `configuraciones_usuarios`
SET `tamano_letra` = 'normal'
WHERE `tamano_letra` IS NULL OR `tamano_letra` NOT IN ('normal', 'grande', 'muy-grande');
