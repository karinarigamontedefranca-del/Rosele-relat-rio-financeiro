// Lê e grava o que a Rosele muda no site (plano e respostas) no Supabase.
// Fica atrás da mesma senha do site (middleware.js protege /api também).
// Configure no Vercel: Settings → Environment Variables
//   SUPABASE_URL         (ex.: https://abcd1234.supabase.co)
//   SUPABASE_SECRET_KEY  (Project Settings → API Keys → secret key, ou a antiga service_role)

const CHAVES = ["plano", "respostas"];
const LIMITE = 60000;                  // bytes por gravação; o plano inteiro tem ~2 KB

function cabecalhos() {
  const key = process.env.SUPABASE_SECRET_KEY || "";
  const h = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) h.Authorization = "Bearer " + key;   // chave antiga (JWT service_role)
  return h;
}

function base() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  if (!url || !process.env.SUPABASE_SECRET_KEY) return null;
  return url + "/rest/v1";
}

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

export async function GET() {
  const b = base();
  if (!b) return json({ erro: "Supabase não configurado" }, 503);
  const r = await fetch(`${b}/site_estado?select=chave,valor,atualizado_em`, { headers: cabecalhos() });
  if (!r.ok) return json({ erro: "Falha ao ler", status: r.status }, 502);
  const linhas = await r.json();
  const out = {};
  for (const l of linhas) out[l.chave] = { valor: l.valor, atualizado_em: l.atualizado_em };
  return json(out);
}

export async function POST(request) {
  const b = base();
  if (!b) return json({ erro: "Supabase não configurado" }, 503);
  const texto = await request.text();
  if (texto.length > LIMITE) return json({ erro: "Grande demais" }, 413);
  let corpo;
  try { corpo = JSON.parse(texto); } catch (e) { return json({ erro: "JSON inválido" }, 400); }
  const { chave, valor } = corpo || {};
  if (!CHAVES.includes(chave) || valor === undefined || typeof valor !== "object") return json({ erro: "Dados inválidos" }, 400);

  const agora = new Date().toISOString();
  const r = await fetch(`${b}/site_estado?on_conflict=chave`, {
    method: "POST",
    headers: { ...cabecalhos(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ chave, valor, atualizado_em: agora }),
  });
  if (!r.ok) return json({ erro: "Falha ao gravar", status: r.status }, 502);
  // histórico: se falhar, não atrapalha a gravação principal
  await fetch(`${b}/site_historico`, {
    method: "POST", headers: { ...cabecalhos(), Prefer: "return=minimal" },
    body: JSON.stringify({ chave, valor }),
  }).catch(() => {});
  return json({ ok: true, atualizado_em: agora });
}
