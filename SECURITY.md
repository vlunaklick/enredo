# Seguridad

Si encuentras una vulnerabilidad, **no abras un issue público**. Repórtala en privado desde
la pestaña **Security → Report a vulnerability** de este repositorio (GitHub Private Vulnerability Reporting).

## Superficie de ataque

- La web es estática (HTML, CSS y JS en `public/`), sin servidor propio ni cookies.
- Sin cuenta, el progreso vive solo en el `localStorage` del navegador. Las cuentas (opcionales, Google) y las pistas de la comunidad usan Supabase: la clave del navegador es pública y todo el acceso lo controlan las políticas RLS y los permisos por columna de `supabase/migrations/`.
- Las pistas de la comunidad son texto de terceros: la web las pinta siempre con `textContent`, nunca como HTML. Límite de 5 por persona y día y ocultación automática por denuncias.
- Las respuestas van ofuscadas en los JSON, no cifradas: hacer trampas es posible y no afecta a nadie.
- No hay secretos ni dependencias de npm. GitHub Actions solo valida las pistas (permisos de lectura) y abre issues de aviso (permiso `issues: write`, nunca en PRs ni forks).
- Las pistas diarias se escriben a mano y entran por pull request o commit revisado; la web las muestra siempre como texto, nunca como HTML.
- Cabeceras de seguridad (CSP estricta sin scripts ni estilos inline, HSTS, `frame-ancestors 'none'`…) en `vercel.json`.
