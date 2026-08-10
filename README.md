# Faltones Curaçao — Porra de La Liga

## Variables de entorno necesarias en Netlify

Configúralas en: Site settings → Environment variables

| Nombre | De dónde sacarla |
|---|---|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | Supabase → Settings → API → clave `service_role` (secreta) |
| `FOOTBALL_API_KEY` | Tu API Token de football-data.org |
| `JWT_SECRET` | Cualquier cadena larga y aleatoria (te la doy yo) |

## Antes de usar la web por primera vez

1. Regístrate en la web como un usuario más, con el código de invitación por defecto: `FALTONES2026`
2. En Supabase → SQL Editor, ejecuta esto cambiando `tu_usuario` por el que hayas elegido:

```sql
update users set is_admin = true, is_approved = true where username = 'tu_usuario';
```

3. En Supabase → Storage, crea un bucket público llamado `avatars`
4. Entra en la web, ve a la pestaña Admin → "Sincronizar datos" y pulsa, en este orden:
   - Sincronizar equipos
   - Sincronizar calendario (38 jornadas)
5. Desde Admin → Usuarios, aprueba a tus amigos según se vayan registrando
