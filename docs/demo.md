# Demo de Fachada

Guion para mostrar el POC. Todo corre en Cloudflare (`fachada.dev`).

| Qué                           | Dirección                               |
| ----------------------------- | --------------------------------------- |
| Landing y admin               | https://app.fachada.dev                 |
| Sitio de la constructora demo | https://constructora-demo.fachada.dev   |
| Preview en vivo de la demo    | https://p-constructora-demo.fachada.dev |

Entrar al admin de la demo: `demo@fachada.dev` (contraseña en `scripts/seed-demo.ts`).

## Antes de la reunión

1. Entrar al admin de la demo y abrir **Sitio** unos minutos antes. Eso enciende el
   contenedor y deja el preview listo; mientras la pestaña esté abierta no se apaga.
2. Tener una segunda pestaña en https://app.fachada.dev (sin sesión, o en ventana
   privada) para registrar una constructora nueva en vivo.

## Recorrido

1. **Registro.** En la landing: nombre de la constructora, correo, contraseña y
   plantilla. Entra directo a «Sitio» con «Creando tu sitio…»; el sitio queda publicado
   en `<slug>.fachada.dev` en menos de un minuto.
2. **Proyectos.** Crear un proyecto con foto. El preview lo muestra al instante; el
   sitio público se actualiza solo en segundo plano.
3. **Plantilla.** «Plantilla» → cambiar entre Pro y Galias: mismos datos, otro diseño.
4. **Editar con IA.** En el chat de «Sitio», pedir un cambio («pon el fondo del
   encabezado oscuro», «agrega una sección de preguntas frecuentes»). El agente lee el
   código, lo cambia, revisa que compile y el preview se actualiza. «Publicar» lo sube.
5. **Versiones.** «Versiones» → volver a una versión anterior, sin recompilar.
6. **Leads.** Llenar el formulario del sitio publicado; el lead aparece en «Leads» y se
   exporta a CSV. Los enviados desde el preview quedan marcados como prueba.
7. **Ajustes.** Integraciones (HubSpot, Sinco, WhatsApp, Meta, GTM, Salesforce,
   Zapier) y dominio propio son de muestra: muestran el flujo sin conectar nada.

## Tiempos medidos (12 nov 2026)

- Encender el preview: ~6 s con el contenedor frío.
- Un turno del agente con un cambio pequeño: ~40 s.
- Publicar: el sitio público cambia ~10–15 s después.

## Volver a cargar la demo

```
bun scripts/seed-demo.ts
```

Es idempotente: si la constructora ya existe entra con su usuario y solo agrega los
proyectos que falten.
