export type IntegrationId =
  "hubspot" | "sinco" | "whatsapp-bot" | "meta-lead-ads" | "gtm" | "salesforce" | "zapier";

export interface IntegrationDef {
  id: IntegrationId;
  name: string;
  description: string;
  fields: { key: string; label: string; secret?: boolean }[];
}

/** Sample catalogue: connecting only stores the state, nothing is sent anywhere. */
export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "hubspot",
    name: "HubSpot",
    description: "Envía cada lead como contacto y negocio en tu CRM de HubSpot.",
    fields: [{ key: "accessToken", label: "Token de app privada", secret: true }],
  },
  {
    id: "sinco",
    name: "Sinco",
    description: "Registra los leads como visitas en Sinco CBR y sincroniza precios.",
    fields: [
      { key: "baseUrl", label: "URL de Sinco" },
      { key: "user", label: "Usuario" },
      { key: "password", label: "Contraseña", secret: true },
    ],
  },
  {
    id: "whatsapp-bot",
    name: "Bot de WhatsApp",
    description: "Responde a los interesados por WhatsApp con los proyectos y agenda visitas.",
    fields: [
      { key: "phoneNumberId", label: "ID del número" },
      { key: "token", label: "Token de WhatsApp Cloud API", secret: true },
    ],
  },
  {
    id: "meta-lead-ads",
    name: "Meta Lead Ads",
    description: "Trae los leads de los formularios de Facebook e Instagram.",
    fields: [{ key: "pageId", label: "ID de la página" }],
  },
  {
    id: "gtm",
    name: "Google Tag Manager",
    description: "Instala tu contenedor de GTM en todas las páginas del sitio.",
    fields: [{ key: "containerId", label: "ID del contenedor (GTM-XXXX)" }],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Crea leads en Salesforce Sales Cloud.",
    fields: [
      { key: "instanceUrl", label: "URL de la instancia" },
      { key: "clientSecret", label: "Client secret", secret: true },
    ],
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Dispara un webhook por cada lead para conectarlo con lo que quieras.",
    fields: [{ key: "webhookUrl", label: "URL del webhook" }],
  },
];
