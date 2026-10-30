(() => {
  "use strict";
  const D = window.DATA, V = window.VAGARO, M = window.Modelo;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const sum = a => a.reduce((s, v) => s + v, 0);
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ------------------------------------------------------------ formatação
  const usd = v => (v < -0.5 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
  const usdK = v => Math.abs(v) >= 1000 ? (v < 0 ? "−$" : "$") + (Math.abs(v) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : usd(v);
  const MES = M.MES;
  const ma = (m, y) => `${MES[m]}/${String(y).slice(2)}`;
  const maLongo = (m, y) => `${["", "janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"][m]} de ${y}`;
  const ymLbl = ym => { const [y, m] = ym.split("-").map(Number); return ma(m, y); };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const COR = { dinheiro: "#5C4A22", cartao: "#AE9253", outros: "#D9C9A6", banco: "#111111", gold: "#AE9253", muted: "#6F6A64", grid: "#EFEAE3", bad: "#A23B2E", good: "#3B7D4F" };
  if (window.Chart) {
    Chart.defaults.font.family = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = COR.muted;
    Chart.defaults.plugins.legend.display = false;
    Object.assign(Chart.defaults.plugins.tooltip, { backgroundColor: "#fff", titleColor: "#111", bodyColor: "#383838", borderColor: "#E4DED6", borderWidth: 1, padding: 10, boxPadding: 4 });
    Chart.defaults.animation.duration = reduz ? 0 : 1100;
  }
  const yMoney = { grid: { color: COR.grid }, border: { display: false }, ticks: { callback: v => usdK(v) } };
  const xPlain = { grid: { display: false }, border: { color: "#D8D1C7" } };
  const charts = {};
  function chart(id, cfg) {
    if (!window.Chart) return null;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
    return charts[id];
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem storage */ } },
  };

  // ------------------------------------------------------------ salvar no site (Supabase via /api/estado)
  // Sempre salva também neste navegador; se o site não responder (ex.: testando no computador), fica só aqui.
  const nuvem = (() => {
    let ativo = true;
    const pend = {}, timers = {};
    const pill = document.createElement("div");
    pill.className = "save-pill"; pill.setAttribute("role", "status"); pill.hidden = true;
    document.body.appendChild(pill);
    const hora = iso => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    function mostrar(txt, cls) { pill.textContent = txt; pill.className = "save-pill " + cls; pill.hidden = false; clearTimeout(pill._t); if (cls === "ok") pill._t = setTimeout(() => pill.hidden = true, 2600); }
    async function carregar() {
      try {
        const r = await fetch("api/estado", { cache: "no-store" });
        if (!r.ok) throw new Error(r.status);
        return await r.json();
      } catch (e) { ativo = false; return null; }
    }
    async function enviar(chave) {
      const valor = pend[chave](); delete pend[chave];
      try {
        const r = await fetch("api/estado", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chave, valor }) });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        mostrar("Salvo no site ✓ " + hora(j.atualizado_em), "ok");
      } catch (e) { mostrar("Sem conexão: salvo só neste aparelho", "off"); }
    }
    function agendar(chave, fn) {
      if (!ativo) return;
      pend[chave] = fn; mostrar("Salvando…", "wait");
      clearTimeout(timers[chave]); timers[chave] = setTimeout(() => enviar(chave), 1500);
    }
    return { carregar, agendar, hora, get ativo() { return ativo; } };
  })();

  // ------------------------------------------------------------ estado do plano
  const KEY = "rosele_plano_v2";
  let S = Object.assign({}, M.PADRAO, store.get(KEY, {}));
  S.orc = Object.assign({}, S.orc || {});
  const salvar = () => { store.set(KEY, S); nuvem.agendar("plano", () => ({ S, gerado })); };
  const calc = () => M.plano(S);

  // ------------------------------------------------------------ dados do negócio
  const mesesB = D.periodo.meses;                                  // banco: 2026-01 … 2026-09
  const banco = D.porMes["Receita de clientes"];
  const iV = ym => V.meses.indexOf(ym);
  const foraMes = mesesB.map(ym => V.dinheiro[iV(ym)] - V.depositadoATM[iV(ym)]);   // dinheiro que não foi ao banco
  const realMes = mesesB.map((ym, i) => banco[i] + foraMes[i]);
  const abr = mesesB.indexOf("2026-04");
  const tot = k => sum(mesesB.map(ym => V[k][iV(ym)]));
  const totAbr = k => sum(mesesB.slice(abr).map(ym => V[k][iV(ym)]));
  const pctDinheiro = totAbr("dinheiro") / (totAbr("dinheiro") + totAbr("cartao") + totAbr("outros"));

  // ------------------------------------------------------------ revelar, contar, progresso
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add("in");
    $$(".count", e.target).forEach(contar);
    if (e.target.classList.contains("count")) contar(e.target);
    e.target.dispatchEvent(new CustomEvent("visivel"));
    io.unobserve(e.target);
  }), { threshold: .15 });
  const observar = root => $$(".reveal, .kpi", root).forEach(el => io.observe(el));

  function contar(el) {
    if (el.dataset.done) return; el.dataset.done = 1;
    const to = +el.dataset.to, fmt = el.dataset.fmt;
    const f = v => fmt === "pct" ? Math.round(v) + "%" : usd(v);
    if (reduz) { el.textContent = f(to); return; }
    const t0 = performance.now(), dur = 1400;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = f(to * e); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function animarNumero(el, de, para, fmt = usd, dur = 900) {
    const id = (el._anim = (el._anim || 0) + 1);            // uma animação nova cancela a anterior
    if (reduz || !dur) { el.textContent = fmt(para); return; }
    const t0 = performance.now();
    const step = t => {
      if (el._anim !== id) return;
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(de + (para - de) * e);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  addEventListener("scroll", () => {
    const h = document.documentElement, p = h.scrollTop / (h.scrollHeight - h.clientHeight);
    $("#scroll-progress").style.width = (p * 100) + "%";
  }, { passive: true });
  const secs = $$("main section[id]");
  const navIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) $$(".nav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
  }), { rootMargin: "-45% 0px -50% 0px" });
  secs.forEach(s => navIO.observe(s));

  // ------------------------------------------------------------ 1. início
  function renderHero() {
    const { q } = calc();
    const c = $(".arch-stats .count[data-fmt=usd]");
    c.dataset.to = Math.round(M.recReal(S));
    $(".arch-stats .count[data-fmt=pct]").dataset.to = Math.round(pctDinheiro * 100);
    $("#hero-quita").textContent = !q ? "à vista" : q.nunca ? "não zera" : ma(q.m, q.y);
  }

  // ------------------------------------------------------------ 2. negócio
  function renderNegocio() {
    const recReal = sum(realMes), foraTot = sum(foraMes);
    const serv = V.servicos[0];
    $("#kpis").innerHTML = [
      ["Você recebeu (jan–set)", usd(recReal), `Banco ${usd(sum(banco))} + dinheiro vivo ${usd(foraTot)}`],
      ["Por mês (abr–set)", usd(sum(realMes.slice(abr)) / (realMes.length - abr)), `No banco, só ${usd(sum(banco.slice(abr)) / (banco.length - abr))}`],
      ["Em dinheiro vivo (abr–set)", Math.round(pctDinheiro * 100) + "%", `${usd(sum(foraMes.slice(abr)) / (foraMes.length - abr))} por mês fora do banco`],
      ["Seu carro-chefe", serv.nome.split("/")[0], `${usd(serv.valor)} em ${serv.qtd} aplicações`],
    ].map(([l, v, d]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${esc(v)}</div><div class="d">${d}</div></div>`).join("");

    const lbl = V.meses.map(ymLbl);
    const bancoV = V.meses.map(ym => { const i = mesesB.indexOf(ym); return i > -1 ? banco[i] : null; });
    $("#lg-receb").innerHTML = `<span><i style="background:${COR.dinheiro}"></i>Dinheiro vivo</span><span><i style="background:${COR.cartao}"></i>Cartão</span><span><i style="background:${COR.outros}"></i>Cherry, Zelle e outros</span><span><i class="line" style="background:${COR.banco}"></i>Caiu no banco</span>`;
    const mk = () => chart("ch-receb", {
      data: {
        labels: lbl,
        datasets: [
          { type: "line", label: "Caiu no banco", data: bancoV, borderColor: COR.banco, borderWidth: 2, pointRadius: 3, pointBackgroundColor: "#fff", tension: .25, order: 0 },
          { type: "bar", label: "Dinheiro vivo", data: V.dinheiro, backgroundColor: COR.dinheiro, stack: "s", order: 1 },
          { type: "bar", label: "Cartão", data: V.cartao, backgroundColor: COR.cartao, stack: "s", order: 1 },
          { type: "bar", label: "Cherry, Zelle e outros", data: V.outros, backgroundColor: COR.outros, stack: "s", borderRadius: { topLeft: 6, topRight: 6 }, order: 1 },
        ],
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { x: { ...xPlain, stacked: true }, y: { ...yMoney, stacked: true } },
        plugins: { tooltip: { callbacks: { label: c => c.raw == null ? null : ` ${c.dataset.label}: ${usd(c.raw)}`, afterTitle: it => it[0].label === "out/26" ? "(até 24/10, sem banco ainda)" : "" } } },
      },
    });
    quandoVisivel("#ch-receb", mk);
    $("#callout-dinheiro").innerHTML = `De janeiro a setembro, entraram <b>${usd(tot("dinheiro"))} em dinheiro vivo</b> e foram depositados só <b>${usd(sum(V.depositadoATM.slice(0, mesesB.length)))}</b>. Até 24/10, foram <b>$35.334</b> em dinheiro e <b>$3.160</b> depositados. O Alex contou <b>$18 mil</b> em casa, e ainda não sabemos onde está o resto.`;

    const formas = [["Dinheiro vivo", tot("dinheiro"), COR.dinheiro], ["Cartão", tot("cartao"), COR.cartao], ["Cherry, Zelle e outros", tot("outros"), COR.outros]];
    const ft = sum(formas.map(f => f[1]));
    quandoVisivel("#ch-formas", () => chart("ch-formas", {
      type: "doughnut",
      data: { labels: formas.map(f => f[0]), datasets: [{ data: formas.map(f => f[1]), backgroundColor: formas.map(f => f[2]), borderColor: "#fff", borderWidth: 3, hoverOffset: 6 }] },
      options: { maintainAspectRatio: false, cutout: "72%", plugins: { tooltip: { callbacks: { label: c => ` ${usd(c.raw)} (${Math.round(c.raw / ft * 100)}%)` } } } },
    }));
    $("#donut-center").innerHTML = `<div><b>${usdK(ft)}</b><span>no Vagaro</span></div>`;
    $("#lg-formas").innerHTML = formas.map(([n, v, c]) => `<span><i style="background:${c}"></i>${n}<span class="lv">${Math.round(v / ft * 100)}%</span></span>`).join("");

    const sv = V.servicos.slice(0, 7), mx = sv[0].valor;
    $("#servicos").innerHTML = sv.map(s => `<div class="bar-row"><span class="nm" title="${esc(s.nome)}">${esc(s.nome.replace("Pckg - ", "Pacote "))}</span><div class="bar-track"><div class="bar-fill" data-w="${s.valor / mx * 100}"></div></div><span class="vl">${usdK(s.valor)}<small>${usd(s.valor / s.qtd)}</small></span></div>`).join("");
    quandoVisivel("#servicos", () => $$("#servicos .bar-fill").forEach((b, i) => setTimeout(() => b.style.width = b.dataset.w + "%", i * 90)));
  }

  function quandoVisivel(sel, fn) {
    const el = $(sel);
    if (!el) return;
    const o = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { fn(); o.disconnect(); } }, { threshold: .2 });
    o.observe(el);
  }

  // de cada $100
  const GRUPO = { prod: "Produtos", equipe: "Equipe e médica", medica: "Equipe e médica", anuncios: "Anúncios e cursos", cursos: "Anúncios e cursos",
    viagens: "Viagens, obra e equipamento", reforma: "Viagens, obra e equipamento", equip: "Viagens, obra e equipamento" };
  const CORG = { "Produtos": "#5C4A22", "Equipe e médica": "#8A7038", "Clínica (aluguel, contas, material)": "#AE9253", "Anúncios e cursos": "#C9AF78",
    "Viagens, obra e equipamento": "#D9C9A6", "Imposto (guardado)": "#8E8A85", "Você": "#383838", "Sobra para a máquina": "#3B7D4F", "Falta": "#A23B2E" };
  let cemModo = "hoje";
  function renderCem() {
    const hoje = cemModo === "hoje";
    const g = {};
    M.ORC.forEach(l => { const k = GRUPO[l.id] || "Clínica (aluguel, contas, material)"; g[k] = (g[k] || 0) + (hoje ? l.hoje : (S.orc[l.id] ?? l.prop)); });
    const r = calc(), rec = M.recReal(S);
    if (hoje) { g["Imposto (guardado)"] = 0; g["Você"] = r.hoje.voce; }
    else { g["Imposto (guardado)"] = r.mes.imposto; g["Você"] = S.retirada; }
    const usado = sum(Object.values(g)), sobra = rec - usado;
    if (sobra >= 0) g["Sobra para a máquina"] = sobra;
    const base = Math.max(rec, usado);
    const ordem = Object.keys(CORG).filter(k => g[k] > 0.5);
    $("#cem").innerHTML = ordem.map(k => `<div style="background:${CORG[k]}${k === "Falta" ? ";background-image:repeating-linear-gradient(45deg,transparent 0 6px,rgba(255,255,255,.18) 6px 12px)" : ""}" data-b="${g[k] / base * 100}" title="${k}: ${usd(g[k])}">${g[k] / rec * 100 >= 7 ? "$" + Math.round(g[k] / rec * 100) : ""}</div>`).join("");
    if (sobra < 0) $("#cem").insertAdjacentHTML("beforeend", `<span class="falta" style="left:${rec / base * 100}%" title="Falta: ${usd(-sobra)}">falta ${usd(-sobra)}</span>`);
    requestAnimationFrame(() => requestAnimationFrame(() => $$("#cem div").forEach(d => d.style.flexBasis = d.dataset.b + "%")));
    $("#cem-legend").innerHTML = ordem.map(k => `<span><i style="background:${CORG[k]}"></i>${k}<b>$${Math.round(g[k] / rec * 100)}</b></span>`).join("")
      + (sobra < 0 ? `<span><i style="background:${CORG.Falta}"></i>Passa do que entra<b style="color:var(--bad)">$${Math.round(-sobra / rec * 100)}</b></span>` : "");
    $("#cem-nota").innerHTML = hoje
      ? `Hoje, de cada $100 que entram, <b>$${Math.round(r.hoje.voce / rec * 100)}</b> vão para você (retiradas, gastos pessoais nos cartões e o dinheiro vivo), nada é guardado para imposto e <b>falta dinheiro</b>: ${usd(-r.hoje.sobra)} por mês, em média.`
      : `No plano, você fica com $5 mil fixos, o imposto fica guardado e sobram <b>${usd(r.mes.sobra)}</b> por mês para a máquina. Em 2027, com a Section 179, viram <b>${usd(r.mes179.sobra)}</b>.`;
  }
  $$("[data-cem]").forEach(b => b.addEventListener("click", () => {
    cemModo = b.dataset.cem;
    $$("[data-cem]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    renderCem();
  }));

  // ------------------------------------------------------------ 3. história
  let passo = 0, timer = null;
  function storyDados() {
    const r = calc(), p = r.p, q = r.q;
    const casaM = q && !q.nunca ? new Date(q.y, q.m - 1 + 9) : new Date(2029, 0);
    const casa = new Date(Math.max(casaM, new Date(2028, 5)));
    return { r, p, q, compra: ma(S.compraMes, S.compraAno), zera: !q ? ma(S.compraMes, S.compraAno) : q.nunca ? "não zera" : ma(q.m, q.y), casa: ma(casa.getMonth() + 1, casa.getFullYear()) };
  }
  function storyPassos(d) {
    return [
      { t: "Hoje", w: "out/2026", p: `Entram uns ${usdK(d.r.hoje.rec)} por mês, mas sai tudo e mais um pouco: falta ${usd(-d.r.hoje.sobra)} por mês. Nada fica guardado.` },
      { t: "Juntar", w: `nov/2026 → ${d.compra}`, p: `Com os ${usd(S.dinheiroGuardado)} que você já tem, o orçamento novo, a Section 179 e a pré-venda, o pote da máquina chega a ${usd(d.p.guardado)}.` },
      { t: "Comprar", w: d.compra, p: `${usd(d.p.entrada)} de entrada e ${usd(d.p.cartao)} no cartão. O verão é mais fraco, e você aproveita para treinar.` },
      { t: "A máquina paga o cartão", w: `${d.compra} → ${d.zera}`, p: d.q && !d.q.nunca ? `Cada sessão vai direto para o cartão. No cenário que você escolheu, ele zera em ${d.zera}, com ${usd(d.q.juros)} de juros.` : d.q ? "Nesse cenário o cartão não zera. Vale mudar o plano lá embaixo." : "Não sobra nada no cartão." },
      { t: "A casa", w: `a partir de ${d.casa}`, p: "Com a máquina paga e a renda maior aparecendo na declaração de 2027, você chega ao banco com o que ele quer ver para a hipoteca." },
    ];
  }
  function renderStory() {
    const d = storyDados(), ps = storyPassos(d);
    $("#story-steps").innerHTML = ps.map((s, i) => `<li data-i="${i}" class="${i === passo ? "on" : i < passo ? "done" : ""}"><span class="when">${s.w}</span><h4>${s.t}</h4><p>${s.p}</p></li>`).join("");
    $$("#story-steps li").forEach(li => li.addEventListener("click", () => { pararStory(); irPasso(+li.dataset.i); }));
    desenharPalco(d);
    aplicarPasso(d, passo, false);
  }
  function desenharPalco(d) {
    const pct = Math.min(1, d.p.entrada / S.valor);
    $("#stage").innerHTML = `
<svg viewBox="0 0 600 400" role="img" aria-label="Animação: juntar, comprar a máquina, quitar o cartão e depois a casa">
  <defs>
    <clipPath id="jarClip"><path d="M70 300 V170 Q70 110 130 110 Q190 110 190 170 V300 Q190 312 178 312 H82 Q70 312 70 300 Z"/></clipPath>
    <linearGradient id="gOuro" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#D8BE84"/><stop offset="1" stop-color="#8A7038"/></linearGradient>
  </defs>
  <text id="st-cap" class="t-serif" x="300" y="40" text-anchor="middle" fill="#fff" font-size="20" letter-spacing="2"></text>
  <text id="st-sub" x="300" y="64" text-anchor="middle" fill="#BDB2A0" font-size="13"></text>

  <!-- pote -->
  <g id="g-jar">
    <g clip-path="url(#jarClip)">
      <rect x="60" y="100" width="140" height="215" fill="rgba(255,255,255,.04)"/>
      <rect id="jar-fill" x="60" y="100" width="140" height="215" fill="url(#gOuro)" style="transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);transition:transform 2.4s cubic-bezier(.22,.8,.24,1)"/>
    </g>
    <path d="M70 300 V170 Q70 110 130 110 Q190 110 190 170 V300 Q190 312 178 312 H82 Q70 312 70 300 Z" fill="none" stroke="#AE9253" stroke-width="2"/>
    <text id="jar-v" class="t-serif" x="130" y="235" text-anchor="middle" fill="#fff" font-size="18">$0</text>
    <text x="130" y="332" text-anchor="middle" fill="#BDB2A0" font-size="11" letter-spacing="1.5">POTE DA MÁQUINA</text>
    <g id="coins"></g>
    <g id="g-out" class="fade" opacity="0">
      <path d="M195 200 C240 200 240 150 280 150" stroke="#A23B2E" stroke-width="2" fill="none" stroke-dasharray="5 5"/>
      <text x="290" y="146" fill="#E7A79D" font-size="13">sai tudo</text>
      <text x="290" y="164" fill="#BDB2A0" font-size="12">falta ${usd(-d.r.hoje.sobra)}/mês</text>
    </g>
  </g>

  <!-- máquina -->
  <g id="g-maq" class="fade" opacity="0" style="transform:translateY(20px)">
    <rect x="262" y="176" width="96" height="124" rx="12" fill="#2E271E" stroke="#AE9253" stroke-width="2"/>
    <rect x="276" y="190" width="68" height="44" rx="6" fill="#1C1813" stroke="#8A7038"/>
    <path d="M284 220 L296 206 L306 216 L318 200 L336 214" stroke="#D8BE84" stroke-width="2" fill="none"/>
    <circle cx="310" cy="262" r="12" fill="none" stroke="#AE9253" stroke-width="2"/>
    <path d="M358 214 C392 214 396 250 410 250" stroke="#AE9253" stroke-width="2" fill="none"/>
    <rect x="404" y="244" width="30" height="12" rx="6" fill="#AE9253"/>
    <text x="310" y="320" text-anchor="middle" fill="#BDB2A0" font-size="11" letter-spacing="1.5">A MÁQUINA</text>
  </g>

  <!-- cartão -->
  <g id="g-card" class="fade" opacity="0">
    <text x="262" y="112" fill="#E9E1D2" font-size="12" letter-spacing="1">CARTÃO</text>
    <text id="card-v" x="560" y="112" text-anchor="end" fill="#fff" font-size="13" class="t-serif">${usd(d.p.cartao)}</text>
    <rect x="262" y="120" width="298" height="16" rx="8" fill="rgba(255,255,255,.08)"/>
    <rect id="card-bar" x="262" y="120" width="298" height="16" rx="8" fill="#C0614F"/>
    <g id="sessoes"></g>
  </g>

  <!-- casa -->
  <g id="g-casa" class="fade" opacity="0">
    <path id="casa-p" class="draw" d="M450 300 V226 L500 186 L550 226 V300 Z M450 226 L500 186 L550 226" stroke="#D8BE84" stroke-width="2.5" fill="rgba(174,146,83,.08)"/>
    <rect x="488" y="258" width="24" height="42" rx="3" fill="none" stroke="#D8BE84" stroke-width="2"/>
    <circle cx="500" cy="222" r="8" fill="none" stroke="#D8BE84" stroke-width="2"/>
    <g class="pulse"><circle cx="560" cy="180" r="9" fill="none" stroke="#fff" stroke-width="2"/><path d="M569 180 H586 M580 180 V186 M585 180 V185" stroke="#fff" stroke-width="2"/></g>
    <text x="500" y="320" text-anchor="middle" fill="#BDB2A0" font-size="11" letter-spacing="1.5">A CASA</text>
  </g>

  <!-- linha do tempo -->
  <g>
    <line x1="60" y1="362" x2="540" y2="362" stroke="rgba(174,146,83,.35)" stroke-width="2"/>
    <line id="tl-fill" x1="60" y1="362" x2="60" y2="362" stroke="#AE9253" stroke-width="3" style="transition:all 1s"/>
    ${[["Hoje", 60], [d.compra, 220], [d.zera, 380], [d.casa, 540]].map(([t, x], i) => `<circle cx="${x}" cy="362" r="5" fill="#1C1813" stroke="#AE9253" stroke-width="2" class="tl-dot" data-i="${i}"/><text x="${x}" y="388" text-anchor="middle" fill="#BDB2A0" font-size="11">${t}</text>`).join("")}
    <circle id="tl-me" cx="60" cy="362" r="8" fill="#AE9253" style="transition:cx 1s cubic-bezier(.22,.8,.24,1)"/>
  </g>
</svg>`;
  }
  let coinTimer = null;
  function aplicarPasso(d, i, anim = true) {
    const svg = $("#stage svg"); if (!svg) return;
    const ps = storyPassos(d);
    $("#st-cap", svg).textContent = ps[i].t.toUpperCase();
    $("#st-sub", svg).textContent = ps[i].w;
    const show = (id, on, y = 0) => { const g = $(id, svg); g.setAttribute("opacity", on ? 1 : 0); g.style.transform = on ? "none" : `translateY(${y}px)`; };
    const pct = Math.min(1, d.p.entrada / S.valor);
    const fill = $("#jar-fill", svg), jv = $("#jar-v", svg);
    const alvo = i === 0 ? 0 : i === 1 ? pct : i === 2 ? .04 : .04;
    fill.style.transform = `scaleY(${alvo})`;
    animarNumero(jv, 0, i === 1 ? d.p.guardado : 0, usd, i === 1 && anim ? 2400 : 0);
    show("#g-out", i === 0);
    show("#g-maq", i >= 2, 20);
    show("#g-card", i >= 2 && !!d.q);
    show("#g-casa", i >= 4);
    $("#casa-p", svg).classList.toggle("on", i >= 4);
    const bar = $("#card-bar", svg), cv = $("#card-v", svg);
    const quita = d.q && !d.q.nunca, cheio = d.p.cartao || 1;
    const pagoFmt = v => { bar.setAttribute("width", Math.max(0, 298 * v / cheio)); return v < 1 ? "pago ✓" : usd(v); };
    if (i === 3 && d.q) animarNumero(cv, d.p.cartao, quita ? 0 : d.p.cartao, pagoFmt, anim ? 3200 : 0);
    else animarNumero(cv, 0, i >= 4 && quita ? 0 : d.p.cartao, pagoFmt, 0);
    const xs = [60, 140, 220, 380, 540];
    $("#tl-me", svg).setAttribute("cx", xs[i]);
    $("#tl-fill", svg).setAttribute("x2", xs[i]);
    $$(".tl-dot", svg).forEach(c => c.setAttribute("fill", xs[i] >= +c.getAttribute("cx") ? "#AE9253" : "#1C1813"));
    clearInterval(coinTimer);
    $("#coins", svg).innerHTML = ""; $("#sessoes", svg).innerHTML = "";
    if (!reduz && i === 1) {
      let n = 0;
      coinTimer = setInterval(() => {
        if (++n > 10) return clearInterval(coinTimer);
        const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        Object.entries({ cx: 110 + Math.random() * 40, cy: 150, r: 7, fill: "#D8BE84", stroke: "#8A7038", class: "coin" }).forEach(([k, v]) => c.setAttribute(k, v));
        $("#coins", svg).appendChild(c);
        setTimeout(() => c.remove(), 1200);
      }, 220);
    }
    if (!reduz && i === 3 && d.q) {
      let n = 0;
      coinTimer = setInterval(() => {
        if (++n > 8) return clearInterval(coinTimer);
        const t = document.createElementNS("http://www.w3.org/2000/svg", "text");
        Object.entries({ x: 330 + Math.random() * 30, y: 175, fill: "#D8BE84", "font-size": 12, class: "coin" }).forEach(([k, v]) => t.setAttribute(k, v));
        t.style.animationName = "subir"; t.textContent = "+$" + M.CEN[S.cen][0];
        $("#sessoes", svg).appendChild(t);
        setTimeout(() => t.remove(), 1200);
      }, 380);
    }
  }
  function irPasso(i) {
    passo = i;
    $$("#story-steps li").forEach((li, k) => li.className = k === i ? "on" : k < i ? "done" : "");
    aplicarPasso(storyDados(), i);
  }
  function pararStory() { clearInterval(timer); timer = null; $("#story-play").textContent = "▶ Ver a história"; }
  $("#story-play").addEventListener("click", () => {
    if (timer) return pararStory();
    $("#story-play").textContent = "❚❚ Pausar";
    irPasso(0);
    timer = setInterval(() => { if (passo >= 4) return pararStory(); irPasso(passo + 1); }, reduz ? 2500 : 4600);
  });
  const style = document.createElement("style");
  style.textContent = "@keyframes subir{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(-60px);opacity:0}}";
  document.head.appendChild(style);
  quandoVisivel("#stage", () => { if (!timer && passo === 0) $("#story-play").click(); });

  // ------------------------------------------------------------ 4. potes
  let poteAno = "2026";
  function renderPotes() {
    const r = calc(), m = poteAno === "2026" ? r.mes : r.mes179;
    const min6 = S.min6346 ? M.BASE.min6346 : 1000;
    const maq = m.sobra - min6;
    $("#potes-titulo").textContent = poteAno === "2026" ? "Um mês de novembro ou dezembro" : "Um mês de janeiro a julho de 2027";
    $("#potes-sub").textContent = poteAno === "2026" ? "Ainda guardando para o imposto de 2026." : "A Section 179 da máquina deve zerar o imposto de 2027: o que iria para o imposto vai para a máquina.";
    $("#entra").innerHTML = `<span class="lbl">Entram no mês</span><span class="big">${usd(m.rec)}</span>
      <div class="flow"><svg viewBox="0 0 800 56" preserveAspectRatio="none">${[100, 300, 500, 700].map((x, i) => `<path id="fl${i}" d="M400 0 C400 30 ${x} 26 ${x} 56"/>${reduz ? "" : `<circle r="4" class="dot"><animateMotion dur="${1.6 + i * .2}s" repeatCount="indefinite" begin="${i * .3}s"><mpath href="#fl${i}"/></animateMotion></circle>`}`).join("")}</svg></div>`;
    const potes = [
      { nm: "Clínica", v: m.desp, c: "#AE9253", ds: "Produtos, equipe, aluguel, anúncios. Fica na conta 6216." },
      { nm: "Impostos", v: m.imposto, c: "#8E8A85", ds: m.imposto ? "28% do lucro, numa conta só para isso." : "Em 2027 a máquina cobre. Confirmar com o contador." },
      { nm: "Você", v: m.retirada, c: "#383838", ds: "Seus $5 mil. Inclui o dinheiro vivo que você fica." },
      { nm: "Máquina", v: maq, c: maq < 0 ? "#A23B2E" : "#3B7D4F", ds: maq < 0 ? `Falta ${usd(-maq)} num mês médio.` : `Num mês médio, já descontado o mínimo do 6346 (${usd(min6)}).`, destaque: true },
    ];
    const mx = Math.max(...potes.map(p => Math.abs(p.v)));
    $("#potes").innerHTML = potes.map(p => `<div class="pote${p.destaque ? " destaque" : ""}"><div class="jarro"><div class="liq" style="background:${p.c}" data-h="${Math.max(3, Math.abs(p.v) / mx * 92)}"></div></div><div class="val">${usd(p.v)}</div><div class="nm">${p.nm}</div><div class="ds">${p.ds}</div></div>`).join("");
    const encher = () => $$("#potes .liq").forEach((l, i) => setTimeout(() => l.style.height = l.dataset.h + "%", i * 160));
    requestAnimationFrame(() => requestAnimationFrame(encher));
  }
  $$("[data-pote]").forEach(b => b.addEventListener("click", () => {
    poteAno = b.dataset.pote;
    $$("[data-pote]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    renderPotes();
  }));

  // ------------------------------------------------------------ 5. economias
  const TAG = { ok: ["ok", "Faz sentido"], ajuste: ["ajuste", "Ajustei"], mantem: ["mantem", "Mantém"], real: ["real", "Valor real"] };
  function renderEco() {
    const mx = Math.max(...M.ORC.map(l => Math.max(l.hoje, l.prop)));
    $("#eco-list").innerHTML = M.ORC.map(l => {
      const v = S.orc[l.id] ?? l.prop, [cls, txt] = TAG[l.ver];
      return `<div class="eco reveal${v !== l.prop ? " changed" : ""}" data-id="${l.id}">
        <div><div class="nm">${esc(l.nome)}</div><div class="mini"><span style="width:${v / mx * 100}%"></span><em style="left:${l.hoje / mx * 100}%" title="hoje"></em></div></div>
        <div class="vals"><span class="h${l.hoje === l.prop ? " same" : ""}">${usd(l.hoje)}</span><span class="arrow">→</span><span class="p">${usd(l.prop)}</span> <span class="tag ${cls}">${txt}</span></div>
        <div class="why">${l.ver === "mantem" ? "" : esc(l.why)}</div>
        <div class="edit"><button type="button" data-d="-50" aria-label="Menos $50">−</button><input type="number" min="0" step="50" value="${v}" aria-label="Quanto você topa gastar com ${esc(l.nome)}"><button type="button" data-d="50" aria-label="Mais $50">+</button></div>
      </div>`;
    }).join("");
    $$("#eco-list .eco").forEach(row => {
      const id = row.dataset.id, inp = $("input", row);
      const set = v => { v = Math.max(0, Math.round(+v || 0)); inp.value = v; S.orc[id] = v; salvar(); atualizarTudo("eco"); row.classList.toggle("changed", v !== M.ORC.find(l => l.id === id).prop); $(".mini span", row).style.width = (v / mx * 100) + "%"; };
      inp.addEventListener("change", () => set(inp.value));
      $$("button", row).forEach(b => b.addEventListener("click", () => set(+inp.value + +b.dataset.d)));
    });
    observar($("#eco-list"));
    renderEcoSum();
  }
  function renderEcoSum() {
    const h = M.despHoje(), p = M.despPlano(S), r = calc();
    $("#eco-sum").innerHTML = [
      ["Gastos da clínica hoje", usd(h), "média abr–set/2026, por mês"],
      ["Com as suas escolhas", usd(p), `economia de ${usd(h - p)} por mês`],
      ["Sobra para a máquina", usd(r.mes.sobra), `por mês · ${usd(r.mes179.sobra)} em 2027`],
    ].map(([l, v, d], i) => `<div class="kpi in"><div class="l">${l}</div><div class="v" ${i === 2 && r.mes.sobra < 0 ? 'style="color:var(--bad)"' : ""}>${v}</div><div class="d">${d}</div></div>`).join("");
  }
  $("#eco-reset").addEventListener("click", () => { S.orc = {}; salvar(); renderEco(); atualizarTudo("eco"); });

  // ------------------------------------------------------------ 6. plano
  const CTL = {
    retirada: { out: usd }, guardarFixo: { out: usd }, extraPessoal: { out: usd }, prevenda: { out: usd },
    receitaExtra: { out: v => "+" + usd(v) }, dinheiroGuardado: { out: usd }, apr: { out: v => Math.round(v * 100) + "%", get: v => v / 100, set: v => Math.round(v * 100) },
    valor: { out: usd },
  };
  let gerado = store.get("rosele_plano_gerado", false);
  function syncControles() {
    for (const [k, c] of Object.entries(CTL)) {
      const el = $("#in-" + k); el.value = c.set ? c.set(S[k]) : S[k];
      el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min) * 100) + "%");
      $("#out-" + k).textContent = c.out(S[k]);
    }
    $$("[data-tg]").forEach(b => { b.setAttribute("aria-pressed", String(!!S[b.dataset.tg])); b.textContent = S[b.dataset.tg] ? "Sim" : "Não"; });
    $$("[data-cen]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.cen === S.cen)));
    $$("[data-guardar]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.guardar === "auto") === S.guardarAuto)));
    $("#guardar-fixo-box").hidden = S.guardarAuto;
    $("#in-compra").value = `${S.compraAno}-${S.compraMes}`;
    const cli = Math.round(S.prevenda / (3 * 550 * (1 - M.BASE.descPre) * M.BASE.sinalPre));
    $("#help-prevenda").textContent = S.prevenda ? `≈ ${cli} clientes compram um pacote de 3 sessões com 10% off e pagam metade antes da compra.` : "Sem pré-venda.";
    const [pc, bc] = M.CEN[S.cen];
    $("#help-cen").textContent = `${bc} sessões de ${usd(pc)} num mês normal; o verão é mais fraco.`;
  }
  for (const [k, c] of Object.entries(CTL)) {
    $("#in-" + k).addEventListener("input", e => { S[k] = c.get ? c.get(+e.target.value) : +e.target.value; mudou(); });
  }
  $$("[data-tg]").forEach(b => b.addEventListener("click", () => { S[b.dataset.tg] = !S[b.dataset.tg]; mudou(); }));
  $$("[data-cen]").forEach(b => b.addEventListener("click", () => { S.cen = b.dataset.cen; mudou(); }));
  $$("[data-guardar]").forEach(b => b.addEventListener("click", () => { S.guardarAuto = b.dataset.guardar === "auto"; mudou(); }));
  $("#in-compra").addEventListener("change", e => { const [y, m] = e.target.value.split("-").map(Number); S.compraAno = y; S.compraMes = m; mudou(); });
  $("#plano-reset").addEventListener("click", () => { const orc = S.orc; S = Object.assign({}, M.PADRAO, { orc }); mudou(); });
  $("#gerar").addEventListener("click", () => {
    gerado = true; store.set("rosele_plano_gerado", true); salvar();
    renderResultado(true);
    $("#result-full").scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
  });
  $("#imprimir").addEventListener("click", () => window.print());

  let deb = null;
  function mudou() { salvar(); syncControles(); clearTimeout(deb); deb = setTimeout(() => atualizarTudo("plano"), 120); }

  function jarSVG(p) {
    const pct = Math.min(1, Math.max(0, p.entrada / S.valor));
    return `<svg viewBox="0 0 220 260" role="img" aria-label="Pote da máquina: ${Math.round(pct * 100)}% guardado">
      <defs><clipPath id="jc2"><path d="M40 230 V100 Q40 40 110 40 Q180 40 180 100 V230 Q180 244 166 244 H54 Q40 244 40 230 Z"/></clipPath>
      <linearGradient id="go2" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#D8BE84"/><stop offset="1" stop-color="#8A7038"/></linearGradient></defs>
      <g clip-path="url(#jc2)"><rect x="30" y="30" width="160" height="220" fill="#F6F0E4"/>
      <rect id="jf2" x="30" y="30" width="160" height="220" fill="url(#go2)" style="transform-box:fill-box;transform-origin:bottom;transform:scaleY(0);transition:transform 1.8s cubic-bezier(.22,.8,.24,1)" data-s="${pct}"/></g>
      <path d="M40 230 V100 Q40 40 110 40 Q180 40 180 100 V230 Q180 244 166 244 H54 Q40 244 40 230 Z" fill="none" stroke="#AE9253" stroke-width="2.5"/>
      <text x="110" y="150" text-anchor="middle" font-family="Cinzel, serif" font-size="30" fill="${pct > .45 ? "#fff" : "#111"}" id="jt2">0%</text>
      <text x="110" y="174" text-anchor="middle" font-size="12" fill="${pct > .38 ? "#fff" : "#6F6A64"}">da máquina guardada</text>
    </svg>`;
  }

  function renderResultado(anim) {
    if (!gerado) return;
    $("#result-empty").hidden = true;
    const box = $("#result-full"); box.hidden = false;
    if (anim) { box.classList.remove("show"); void box.offsetWidth; box.classList.add("show"); }
    const r = calc(), p = r.p, q = r.q;
    const pct = Math.min(1, p.entrada / S.valor);

    $("#jar").innerHTML = jarSVG(p);
    requestAnimationFrame(() => requestAnimationFrame(() => { const f = $("#jf2"); f.style.transform = `scaleY(${f.dataset.s})`; }));
    animarNumero($("#jt2"), 0, pct * 100, v => Math.round(v) + "%", anim ? 1800 : 0);

    const falta = p.linhas.filter(l => l.dep < 0 || l.folga < -0.5);
    const v = !q ? "ok" : q.nunca || q.meses > 18 ? "bad" : q.meses > 9 || falta.length ? "warn" : "ok";
    const tit = { ok: !q ? "Dá para comprar à vista" : "O plano fecha", warn: "Dá, mas com atenção", bad: "Arriscado do jeito que está" }[v];
    let txt = !q ? "O pote cobre a máquina inteira." : q.nunca ? "Nesse ritmo de sessões, o cartão não zera em 10 anos. Tente comprar mais tarde, guardar mais ou aumentar a pré-venda."
      : `Com ${usd(p.entrada)} de entrada, ${usd(p.cartao)} vão para o cartão, que zera em <b>${maLongo(q.m, q.y)}</b> com ${usd(q.juros)} de juros.`;
    if (falta.length) txt += ` Em ${falta.length} ${falta.length > 1 ? "meses" : "mês"} o orçamento não fecha com o valor que você escolheu guardar.`;
    $("#verdict").className = "verdict " + v;
    $("#verdict").innerHTML = `<span class="vi">${{ ok: "✓", warn: "!", bad: "✕" }[v]}</span><div><h4>${tit}</h4><p>${txt}</p></div>`;

    const kp = [
      ["Guardado na compra", p.guardado], ["No cartão", p.cartao],
      ["Cartão zera em", !q ? "—" : q.nunca ? "não zera" : `${q.meses} ${q.meses > 1 ? "meses" : "mês"}`], ["Juros no total", q ? q.juros : 0],
    ];
    $("#res-kpis").innerHTML = kp.map(([l, val]) => `<div class="kpi in"><div class="l">${l}</div><div class="v" data-n="${typeof val === "number" ? val : ""}">${typeof val === "number" ? usd(val) : val}</div></div>`).join("");
    if (anim) $$("#res-kpis .v[data-n]").forEach(el => el.dataset.n !== "" && animarNumero(el, 0, +el.dataset.n, usd, 1400));

    const ini = `<div class="mcard" style="animation-delay:0s"><div class="mm">Começo</div><div class="mv">${usd(p.inicio)}</div><div class="mt">${usd(S.dinheiroGuardado)} em dinheiro${p.caixa < 0 ? `, menos ${usd(-p.caixa)} para completar a reserva de ${usd(M.BASE.reservaMin)} na 6216` : ` + ${usd(p.caixa)} do caixa da 6216`}.</div></div>`;
    $("#months").innerHTML = ini + p.linhas.map((l, i) => {
      const cls = l.dep < 0 ? "neg" : l.pre ? "pre" : "";
      const det = [l.guardar >= 0 ? `sobra ${usd(l.guardar)}` : `falta ${usd(-l.guardar)}`, l.pre ? `pré-venda ${usd(l.pre)}` : "", l.extra ? `seu ${usd(l.extra)}` : "", l.s179 ? "imposto → máquina" : "", l.folga < -0.5 ? `<b style="color:var(--bad)">faltam ${usd(-l.folga)}</b>` : l.folga > 0.5 ? `folga ${usd(l.folga)}` : ""].filter(Boolean).join(" · ");
      return `<div class="mcard ${cls}" style="animation-delay:${(i + 1) * (anim ? .07 : 0)}s"><div class="mm">${ma(l.m, l.y)}</div><div class="mv">${usd(l.dep)}</div><div class="mt">${det}<br>total: ${usd(l.guard)}</div></div>`;
    }).join("") + `<div class="mcard buy" style="animation-delay:${(p.linhas.length + 1) * (anim ? .07 : 0)}s"><div class="mm">${ma(S.compraMes, S.compraAno)} · compra</div><div class="mv">${usd(p.entrada)}</div><div class="mt">de entrada${p.cartao > 0.5 ? ` + ${usd(p.cartao)} no cartão` : ""}</div></div>`;
    $("#meses-hint").textContent = S.guardarAuto ? "Cada cartão mostra o que passar para a conta da máquina naquele mês." : `Você escolheu guardar ${usd(S.guardarFixo)} por mês. Onde aparece “faltam”, o orçamento não cobre.`;

    if (q) {
      const sc = q.serie.slice(0, 30);
      $("#cartao-hint").textContent = `Depois da compra, tudo o que sobra (da clínica e da máquina) vai para o cartão. O 6346 fica no mínimo até o cartão zerar. Cenário: ${S.cen === "Pessimista" ? "devagar" : S.cen === "Otimista" ? "bombando" : "realista"}.`;
      chart("ch-cartao", {
        type: "line",
        data: {
          labels: [ma(S.compraMes, S.compraAno), ...sc.map(x => ma(x.m, x.y))],
          datasets: [
            { label: "Cartão da máquina", data: [p.cartao, ...sc.map(x => x.saldo)], borderColor: "#AE9253", borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: { target: { value: 0 }, above: "rgba(174,146,83,.14)" }, tension: .25 },
            { label: "Cartão 6346", data: [p.divida6346, ...sc.map(x => x.d6)], borderColor: "#8E8A85", borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, pointHoverRadius: 4 },
          ],
        },
        options: { maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, scales: { x: { ...xPlain, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } }, y: { ...yMoney, min: 0 } },
          plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${usd(c.raw)}` } } } },
      });
    } else {
      $("#cartao-hint").textContent = "Nada vai para o cartão.";
      if (charts["ch-cartao"]) charts["ch-cartao"].destroy();
    }

    const l = p.linhas, l27 = l.find(x => x.y === 2027) || l[0];
    $("#steps").innerHTML = [
      `<b>Novembro de 2026</b>A poupança da máquina já está aberta. Falta abrir a conta de impostos. Pagar as faturas do Amex e do 2378 e completar a reserva da 6216.`,
      `<b>Dezembro de 2026</b>Com o contador: o dinheiro vivo de 2026, quando depositar os ${usd(S.dinheiroGuardado)}, o imposto de 2026 e a Section 179 na compra em ${S.compraAno}. Com o Chase: até quando vale o 0% do 6346.`,
      `<b>Janeiro de 2027 em diante</b>Todo dia 5, passar para a conta da máquina o valor do mês na previsão. Pedir 2 ou 3 cotações com preço final (imposto, frete, treinamento) e perguntar a taxa para pagar no cartão.`,
      S.prevenda ? `<b>Três meses antes da compra</b>Abrir a pré-venda: pacotes de 3 sessões com 10% de desconto, metade paga na reserva.` : "",
      `<b>${maLongo(S.compraMes, S.compraAno)}</b>Comprar: ${usd(p.entrada)} de entrada${p.cartao > 0.5 ? ` e ${usd(p.cartao)} no cartão. Confirmar antes o limite do cartão` : ""}.`,
      q ? `<b>Depois da compra</b>Tudo o que sobra vai para o cartão${q.nunca ? "" : `, até ${maLongo(q.m, q.y)}`}. Depois, o 6346. Se um banco aprovar um empréstimo mais barato, trocar a dívida do cartão por ele.` : "",
      `<b>Depois de tudo pago</b>Conversar com o banco sobre a hipoteca, já com a renda da máquina na declaração.`,
    ].filter(Boolean).map(t => `<li>${t}</li>`).join("");
  }

  // ------------------------------------------------------------ 7. contas e perguntas
  function renderContas() {
    const B = M.BASE, r = calc();
    const itens = [
      ["De onde vêm os números", `<p>Banco e cartões: as 4 contas da empresa no QuickBooks, de janeiro a setembro de 2026 (6216, Amex Gold, Chase 6346 e 2378). Vagaro: o relatório <i>Transaction List</i>, com cada pagamento e a forma de pagamento, de abril de 2025 a 24 de outubro de 2026.</p><p>Uso a média de <b>abril a setembro</b>, porque o começo do ano foi mais fraco e não representa a clínica hoje.</p>`],
      ["A receita de verdade", `<p>O que caiu no banco (${usd(B.recBanco)} por mês) mais o dinheiro vivo que ficou fora dele (${usd(B.dinheiroFora)} por mês): dinheiro registrado no Vagaro menos os depósitos em caixa eletrônico.</p><div class="formula">receita = ${usd(B.recBanco)} + ${usd(B.dinheiroFora)} = ${usd(B.recBanco + B.dinheiroFora)} por mês</div>`],
      ["O imposto (28%)", `<p>Guardo 28% do lucro: uma estimativa de imposto federal, de New Jersey e self-employment juntos. O valor certo é o contador quem diz. O dinheiro vivo também é receita e entra nessa conta.</p><div class="formula">lucro = receita − gastos da clínica = ${usd(r.mes.lucro)}<br>imposto = 28% × lucro = ${usd(r.mes.imposto)}</div>`],
      ["A sobra do mês", `<div class="formula">sobra = lucro − imposto − sua retirada<br>= ${usd(r.mes.lucro)} − ${usd(r.mes.imposto)} − ${usd(S.retirada)} = ${usd(r.mes.sobra)}</div><p>Do que sobra, sai o mínimo do cartão 6346 (${usd(B.min6346)}). O resto vai para a conta da máquina.</p>`],
      ["A Section 179", `<p>Comprando a máquina em ${S.compraAno}, a empresa pode deduzir o valor dela do lucro daquele ano. Com uma máquina de ${usd(S.valor)}, isso deve zerar o imposto da empresa em ${S.compraAno}. Por isso, de janeiro até a compra, o que iria para o imposto vai para a máquina. <b>Precisa do ok do contador antes.</b></p>`],
      ["A pré-venda", `<p>Clientes fiéis compram um pacote de 3 sessões de $550 com 10% de desconto e pagam metade nos três meses antes da compra. A outra metade entra quando elas fizerem as sessões. Na conta do cartão, desconto essas sessões já pagas.</p>`],
      ["O cartão e os cenários de sessões", `<p>Juros de ${Math.round(S.apr * 100)}% ao ano (${(S.apr / 12 * 100).toFixed(1)}% ao mês). Depois da compra, todo mês entram as sessões da máquina menos $250 de manutenção, mais a sobra da clínica.</p><div class="formula">devagar: 4 sessões × $550 · realista: 7 × $850 · bombando: 10 × $1.200<br>verão: 30–60% de um mês normal · inverno: até 130%</div><p>A partir do ano seguinte à compra, a renda da máquina também paga 28% de imposto.</p>`],
      ["Os saldos de partida", `<p>Em 30/10, a conta 6216 tinha ${usd(B.saldoBanco6216)}. Faltam pagar ${usd(B.faturaGold)} do Amex e ${usd(B.fatura2378)} do cartão 2378, então sobram ${usd(B.saldo6216)}. O pote começa com os ${usd(S.dinheiroGuardado)} em dinheiro${r.p.caixa < 0 ? `, menos ${usd(-r.p.caixa)} para a reserva voltar a ${usd(B.reservaMin)}` : ""}.</p>`],
      ["Meses fortes e fracos", `<p>Novembro vale 120% de um mês médio, dezembro 110%, janeiro 80% e fevereiro 90%. Os outros meses valem 100%. É uma estimativa baseada no que você me contou e no Vagaro.</p>`],
      ["O que não entrou na conta", `<p>Preço exato da máquina (usei ${usd(S.valor)} como preço final), a taxa do vendedor para receber no cartão (costuma ser ~3%), aumento de preço dos produtos, gastos com a casa, o ganho da promoção de fim de ano e um eventual imposto sobre o dinheiro vivo de 2026. Os $18 mil entraram inteiros: o contador precisa confirmar se parte deles fica para o imposto.</p>`],
    ];
    $("#contas-acc").innerHTML = itens.map(([t, b], i) => `<details${i === 0 ? " open" : ""}><summary>${t}</summary><div class="body">${b}</div></details>`).join("");
  }

  // ------------------------------------------------------------ previsão mês a mês, cofrinho e Natal
  function renderPrevisao() {
    const r = calc(), p = r.p, L = p.linhas;
    const fracos = L.filter(l => l.dep < -0.5);
    $("#prev-kpis").innerHTML = [
      ["Começa com", usd(p.inicio), "no pote da máquina"],
      ["Entram no período", usd(sum(L.map(l => l.rec))), `${L.length} meses`],
      ["Vão para a máquina", usd(p.guardado - p.inicio), "somando tudo, com a pré-venda"],
      ["Chega na compra com", usd(p.guardado), p.cartao > 0.5 ? `${usd(p.cartao)} no cartão` : "dá para comprar à vista"],
    ].map(([l, v, d]) => `<div class="kpi in"><div class="l">${l}</div><div class="v">${v}</div><div class="d">${d}</div></div>`).join("");
    const cab = ["Mês", "Entra", "Clínica", "Imposto", "Você", "6346", "Uma vez só", "Pré-venda", "Para a máquina", "Total guardado"];
    const lin = l => `<tr class="${l.dep < -0.5 ? "neg" : ""}"><th scope="row">${ma(l.m, l.y)}</th>${[l.rec, -l.desp, -l.imposto, -l.retirada, -l.p6, l.unico ? -l.unico.valor : 0, l.pre].map(v => `<td>${Math.abs(v) < 0.5 ? "—" : usd(v)}</td>`).join("")}<td class="forte">${usd(l.dep)}</td><td>${usd(l.guard)}</td></tr>`;
    $("#prev-tabela").innerHTML = `<thead><tr>${cab.map(c => `<th scope="col">${c}</th>`).join("")}</tr></thead><tbody>${L.map(lin).join("")}</tbody>`;
    const nomes = fracos.map(l => ma(l.m, l.y)).join(", ");
    $("#prev-nota").innerHTML = (fracos.length ? `Em <b>${nomes}</b>, o mês fecha negativo: cubra com o que sobrou em novembro e dezembro, sem mexer na reserva. ` : "") + "Essa previsão usa os $18 mil e a pré-venda dos três meses antes da compra. O valor do curso de novembro ainda é uma estimativa.";
    chart("ch-previsao", {
      type: "bar",
      data: { labels: L.map(l => ma(l.m, l.y)), datasets: [{ label: "Guardado", data: L.map(l => Math.round(l.guard)), backgroundColor: "#AE9253", borderRadius: 6 }] },
      options: { maintainAspectRatio: false, scales: { x: xPlain, y: { ...yMoney, min: 0 } }, plugins: { tooltip: { callbacks: { label: c => ` ${usd(c.raw)}` } } } },
    });
  }

  function renderCofrinho() {
    const C = M.COFRINHO, pct = Math.min(100, C.valor / C.meta * 100);
    $("#cofrinho").innerHTML = `<div class="card-head"><div><h3>O cofrinho da máquina</h3><p class="hint">Atualizado por mim em ${C.em}.</p></div><div class="cof-valor">${usd(C.valor)} <span>de ${usd(C.meta)}</span></div></div>
      <div class="cof-barra" role="img" aria-label="${Math.round(pct)}% da meta guardados"><span style="width:${pct}%"></span></div>
      <p class="hint">${Math.round(pct)}% da máquina, ${C.onde}. Faltam ${usd(C.meta - C.valor)}.</p>`;
  }

  function renderNatal() {
    const P = M.NATAL_PREMISSAS, N = M.natal();
    $("#natal-cards").innerHTML = N.map((n, i) => `<article class="card natal-card${i === 1 ? " destaque" : ""}">
      <h3>${n.nome}</h3><div class="natal-ganho">${usd(n.ganho)}</div><p class="hint">de ganho novo depois dos custos</p>
      <dl><dt>Gift cards vendidos</dt><dd>${n.gc}</dd><dt>Dinheiro adiantado</dt><dd>${usd(n.gcCaixa)}</dd><dt>Raspadinhas</dt><dd>${n.cartoes}</dd><dt>Clientes que sobem para $400</dt><dd>${n.sobe}</dd><dt>Voltam com o voucher</dt><dd>${n.voltam.toFixed(1).replace(".", ",")}</dd><dt>Custo dos prêmios</dt><dd>${usd(n.custo)}</dd></dl>
    </article>`).join("");
    $("#natal-premissas").innerHTML = [
      `Gift card médio de ${usd(P.gcValor)}, com ${P.gcDesconto * 100}% de desconto. Só ${P.gcNovo * 100}% conta como venda nova: o resto é a cliente pagando antes o que já faria.`,
      `Prêmios: ${P.brindeB12.pct * 100}% B12 (custo ${usd(P.brindeB12.custo)}), ${P.brindeCreme.pct * 100}% creme (${usd(P.brindeCreme.custo)}) e ${P.voucher.pct * 100}% voucher de ${P.voucher.desconto * 100}% para o próximo procedimento.`,
      `Atendimentos de $400 ou mais: 27 em setembro e 21 até 24/10. Ticket médio deles: ${usd(P.ticket)}.`,
      `Quem sobe de valor para ganhar a raspadinha gasta ${usd(P.upsell)} a mais. Produto custa ${P.prodPct * 100}% da venda.`,
    ].map(t => `<li>${t}</li>`).join("");
  }

  const FAQ = [
    ["Por que a máquina antes da casa?", "Porque a máquina traz renda nova, e é a renda declarada que o banco olha para aprovar a hipoteca. Com a máquina paga, você chega ao banco com mais renda e menos dívida. Se fosse a casa primeiro, o mesmo dinheiro viraria entrada da casa e a hipoteca seria mais uma conta todo mês, sem renda nova para pagar."],
    ["Por que depositar o dinheiro vivo?", "Por três motivos. Ele é receita e precisa entrar na declaração, mesmo que fique fora do banco. Ele aumenta a renda que conta para a hipoteca. E, fora do banco, ele some sem a gente conseguir ver para onde foi. A data certa você combina com o contador."],
    ["Os $18 mil já estão no plano?", "Sim. Entraram inteiros no pote da máquina, como você pediu. Se você decidir usar esse dinheiro para a casa, ou se o contador disser que parte fica para o imposto, é só mudar o valor em “Dinheiro já guardado”."],
    ["Os $5 mil por mês incluem o dinheiro vivo?", "No plano, sim. Se você já fica com o dinheiro vivo, completa os $5 mil com uma transferência da conta da empresa. Se a sua realidade for outra, me conta na pergunta ao lado que eu refaço."],
    ["Por que pagar só o mínimo do cartão 6346?", "Porque ele está a 0% de juros: é uma dívida de graça. O cartão onde a máquina vai entrar cobra uns 24% ao ano. Cada dólar que fica na conta da máquina, em vez de ir para o 6346, é um dólar a menos pagando 2% ao mês."],
    ["Quanto custa deixar dinheiro no cartão?", "A 24% ao ano, são 2% ao mês. Cada $10 mil no cartão custam uns $200 de juros por mês. Por isso vale guardar o máximo antes de comprar."],
    ["E se um mês for fraco?", "Corte outro gasto antes de tirar dinheiro da conta da máquina. Se mesmo assim faltar, tudo bem pular um mês: o plano mostra quanto isso adia."],
    ["A Section 179 é garantida?", "Ela existe para equipamentos de empresa, mas quem confirma se vale no seu caso, e quanto economiza, é o contador. Se não valer, desligue a opção em “Mais opções” para ver o plano sem ela."],
    ["Posso mudar os números?", "Pode e deve. Mude as economias que você topa, quanto precisa por mês, quando quer comprar e o ritmo das sessões. O plano recalcula na hora."],
  ];
  const ASK = [
    ["cinco", "Os $5 mil por mês já incluem esse dinheiro vivo?", ""],
    ["cotacao", "Já tem cotação da máquina?", "Valor final, com imposto, frete e treinamento."],
    ["cartao", "Em qual cartão você passaria a máquina?", "Limite e juros ao ano."],
    ["6346", "Até quando o Chase 6346 fica a 0%?", ""],
    ["prevenda", "Você topa pré-vender pacotes? Para quantas clientes?", ""],
    ["preco", "Quanto você pensa em cobrar por sessão na máquina?", ""],
    ["curso", "Quanto custa o curso de 26 a 28/11?", "Coloquei $2.000 na previsão até você confirmar."],
    ["cursos27", "Quanto você quer separar para cursos em 2027?", "Coloquei $600 por mês por enquanto."],
    ["sustenta", "O plano do site é sustentável para você?", "Se não for, me diz o que pesa mais."],
    ["outra", "Alguma coisa que eu não perguntei?", ""],
  ];
  function renderPerguntas() {
    $("#faq").innerHTML = FAQ.map(([q, a]) => `<details><summary>${q}</summary><div class="body"><p>${a}</p></div></details>`).join("");
    const resp = store.get("rosele_respostas", {});
    $("#ask-form").innerHTML = ASK.map(([id, q, h]) => `<div><label for="q-${id}">${q}${h ? `<small>${h}</small>` : ""}</label><textarea id="q-${id}" data-id="${id}" rows="2">${esc(resp[id] || "")}</textarea></div>`).join("");
    $$("#ask-form textarea").forEach(t => t.addEventListener("input", () => {
      const r = store.get("rosele_respostas", {}); r[t.dataset.id] = t.value; store.set("rosele_respostas", r);
      nuvem.agendar("respostas", () => store.get("rosele_respostas", {}));
    }));
    const texto = () => "Karina, minhas respostas:\n\n" + ASK.map(([id, q], i) => `${i + 1}. ${q}\n${($("#q-" + id).value || "—").trim()}`).join("\n\n");
    $("#ask-whats").addEventListener("click", () => window.open("https://wa.me/?text=" + encodeURIComponent(texto()), "_blank", "noopener"));
    $("#ask-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(texto()); $("#ask-status").textContent = "Copiado! Agora é só colar para mim."; }
      catch (e) { $("#ask-status").textContent = "Não consegui copiar. Selecione o texto e copie à mão."; }
    });
  }

  // ------------------------------------------------------------ atualizar tudo
  function atualizarTudo(origem) {
    renderHero();
    renderCem();
    renderPotes();
    renderEcoSum();
    renderContas();
    renderPrevisao();
    if (origem !== "story") renderStory();
    renderResultado(false);
  }

  syncControles();
  renderHero();
  renderNegocio();
  renderCem();
  renderStory();
  renderPotes();
  renderEco();
  renderContas();
  renderPrevisao();
  renderCofrinho();
  renderNatal();
  renderPerguntas();
  renderResultado(false);
  observar(document);
  quandoVisivel("#potes", renderPotes);
  quandoVisivel("#cem", renderCem);

  // o que está salvo no site vale mais do que o que está neste navegador
  nuvem.carregar().then(d => {
    const nota = $("#ask-nota");
    if (!d) { nota.textContent = "O que você escrever fica salvo aqui no seu navegador até você me mandar."; return; }
    nota.textContent = "O que você escrever fica salvo no site, e eu vejo na hora. Se preferir, mande também pelo WhatsApp.";
    if (d.plano && d.plano.valor && d.plano.valor.S) {
      S = Object.assign({}, M.PADRAO, d.plano.valor.S); S.orc = Object.assign({}, S.orc || {});
      gerado = !!d.plano.valor.gerado;
      store.set(KEY, S); store.set("rosele_plano_gerado", gerado);
      syncControles(); renderEco(); atualizarTudo("nuvem");
    }
    if (d.respostas && d.respostas.valor) {
      store.set("rosele_respostas", d.respostas.valor);
      $$("#ask-form textarea").forEach(t => { if (document.activeElement !== t) t.value = d.respostas.valor[t.dataset.id] || ""; });
      $("#ask-status").textContent = "Última resposta salva: " + new Date(d.respostas.atualizado_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    }
  });
})();
