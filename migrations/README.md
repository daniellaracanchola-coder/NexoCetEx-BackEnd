# Migraciones MySQL — backend-nexo

## 001_tema_extra.sql

Misma actualización que en **`DataBase_Nexo/actualizar_configuracion.sql`** (carpeta del esquema oficial).

La app guarda `configuraciones_usuarios.tema` como: `sistema`, `claro`, `oscuro`, **`extra`**.

En Render, ejecuta uno de estos scripts sobre la BD `nexo`:

```bash
mysql -u USUARIO -p nexo < ../../DataBase_Nexo/actualizar_configuracion.sql
```

o:

```bash
mysql -u USUARIO -p nexo < migrations/001_tema_extra.sql
```

Tras la migración, despliega el backend actualizado.
