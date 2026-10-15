# Seguridad

Si encuentras una vulnerabilidad, **no abras un issue público**. Repórtala en privado desde
la pestaña **Security → Report a vulnerability** de este repositorio (GitHub Private Vulnerability Reporting).

## Superficie de ataque

- La web es estática (HTML, CSS y JS en `public/`). No hay servidor, base de datos, cuentas ni cookies.
- El progreso del jugador vive solo en el `localStorage` de su navegador.
- Las respuestas van ofuscadas en los JSON, no cifradas: hacer trampas es posible y no afecta a nadie.
- No hay secretos ni dependencias de npm. GitHub Actions solo valida las pistas (permisos de lectura) y abre issues de aviso (permiso `issues: write`, nunca en PRs ni forks).
- Las pistas se escriben a mano y entran por pull request o commit revisado; la web las muestra siempre como texto, nunca como HTML.
- Cabeceras de seguridad (CSP estricta sin scripts ni estilos inline, HSTS, `frame-ancestors 'none'`…) en `vercel.json`.
