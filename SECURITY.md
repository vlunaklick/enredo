# Seguridad

Si encuentras una vulnerabilidad, **no abras un issue público**. Repórtala en privado desde
la pestaña **Security → Report a vulnerability** de este repositorio (GitHub Private Vulnerability Reporting).

## Superficie de ataque

- La web es estática (HTML, CSS y JS en `public/`). No hay servidor, base de datos, cuentas ni cookies.
- El progreso del jugador vive solo en el `localStorage` de su navegador.
- Las respuestas van ofuscadas en los JSON, no cifradas: hacer trampas es posible y no afecta a nadie.
- El único secreto es `ANTHROPIC_API_KEY`, guardado como secret del entorno `generator` de GitHub Actions. Solo lo usa el job programado de la rama `main`; los PR y los forks no tienen acceso.
- Cabeceras de seguridad (CSP estricta sin scripts ni estilos inline, HSTS, `frame-ancestors 'none'`…) en `vercel.json`.
