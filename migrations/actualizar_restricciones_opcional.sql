-- OPCIONAL — solo MySQL 8.0.16 o superior
-- Añade CHECK para que la BD rechace temas inválidos.
-- Si aparece "Duplicate constraint name", las restricciones ya existen: no hagas nada.

USE nexo;

ALTER TABLE `configuraciones_usuarios`
  ADD CONSTRAINT `chk_config_tema`
  CHECK (`tema` IN ('sistema', 'claro', 'oscuro', 'extra'));

ALTER TABLE `configuraciones_usuarios`
  ADD CONSTRAINT `chk_config_tamano`
  CHECK (`tamano_letra` IN ('normal', 'grande', 'muy-grande'));
