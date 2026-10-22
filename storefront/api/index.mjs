/**
 * Vercel Serverless Function that serves the Angular SSR app.
 * Vercel has no native Angular SSR preset: static assets are served from
 * dist/storefront/browser (outputDirectory) and every other request is
 * rewritten here (vercel.json). The Express app in src/server.ts exports
 * `reqHandler`, which is reused as-is.
 */
export default async function handler(req, res) {
  const { reqHandler } = await import('../dist/storefront/server/server.mjs');
  return reqHandler(req, res);
}
