/**
 * Gates de features opcionales. Regla de oro: la IA y los servicios externos
 * son ADITIVOS — sin la env var, la feature directamente no se renderiza.
 */
export const apifyEnabled = () => Boolean(process.env.APIFY_TOKEN);
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

export function appUrl() {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}
