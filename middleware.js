// Protege o site inteiro com usuário e senha (Basic Auth).
// Configure no Vercel: Settings → Environment Variables
//   SITE_USER     (ex.: rosele)
//   SITE_PASSWORD (uma senha forte)
// Sem essas variáveis o site fica bloqueado para todos.
import { next } from "@vercel/functions";

export const config = { matcher: "/:path*" };

function iguais(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function middleware(request) {
  const user = process.env.SITE_USER;
  const pass = process.env.SITE_PASSWORD;
  if (!user || !pass) {
    return new Response("Site bloqueado: configure SITE_USER e SITE_PASSWORD no Vercel.", { status: 503 });
  }
  const header = request.headers.get("authorization") || "";
  if (header.startsWith("Basic ")) {
    let decoded = "";
    try { decoded = atob(header.slice(6)); } catch (e) { decoded = ""; }
    const i = decoded.indexOf(":");
    if (i > -1 && iguais(decoded.slice(0, i), user) && iguais(decoded.slice(i + 1), pass)) {
      return next({ headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
    }
  }
  return new Response("Acesso restrito.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Painel Rosele Aesthetics", charset="UTF-8"' },
  });
}
