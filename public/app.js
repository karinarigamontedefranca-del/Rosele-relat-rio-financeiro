(() => {
  "use strict";
  const D = window.DATA;
  const P = D.plano;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------------------------------------------------------------- formatação
  const usd = (v, dec = 0) => {
    const s = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (v < -0.005 ? "−$" : "$") + s;
  };
  const usdK = v => Math.abs(v) >= 1000 ? (v < 0 ? "−$" : "$") + (Math.abs(v) / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil" : usd(v);
  const pct = v => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const mesLabel = ym => { const [y, m] = ym.split("-").map(Number); return MES[m - 1] + "/" + String(y).slice(2); };
  const dataBR = iso => iso.split("-").reverse().join("/");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const COR = { fixa: "#A07A1E", variavel: "#1F6FA8", eventual: "#C0614F", fora: "#8E8A85", receita: "#AE9253" };
  const NOME_TIPO = { fixa: "Fixas", variavel: "Variáveis", eventual: "Eventuais", fora: "Fora da empresa", receita: "Receita" };
  const GOLD = "#AE9253", INK = "#111111", MUTED = "#6F6A64", GRID = "#EFEAE3", BAD = "#B23B2E", GOOD = "#3B7D4F";

  if (window.Chart) {
    Chart.defaults.font.family = '"Helvetica Neue", Helvetica, Arial, sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = MUTED;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = "#fff";
    Chart.defaults.plugins.tooltip.titleColor = INK;
    Chart.defaults.plugins.tooltip.bodyColor = "#383838";
    Chart.defaults.plugins.tooltip.borderColor = "#E4DED6";
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.boxPadding = 4;
    Chart.defaults.animation.duration = 500;
  }
  const yMoney = { grid: { color: GRID }, border: { display: false }, ticks: { callback: v => usdK(v) } };
  const xPlain = { grid: { display: false }, border: { color: "#D8D1C7" } };
  const charts = {};
  function chart(id, cfg) {
    if (!window.Chart) return null;
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), cfg);
    return charts[id];
  }

  // ---------------------------------------------------------------- dados base
  const MESES = D.periodo.meses;                       // ["2026-01", …]
  const LBL = MESES.map(mesLabel);
  const IDX_ABR = MESES.indexOf("2026-04");
  const GRUPOS = D.subgrupos;
  const TIPO_PADRAO = Object.fromEntries(GRUPOS.map(g => [g.nome, g.tipo]));
  const sum = a => a.reduce((s, v) => s + v, 0);
  const avg = (a, from = 0) => { const s = a.slice(from); return s.length ? sum(s) / s.length : 0; };
  const serie = nome => D.porMes[nome] || MESES.map(() => 0);
  const receita = serie("Receita de clientes");
  const ATIVO = "Equipamentos";                         // compra de equipamento = ativo, fora do lucro

  // tipos editáveis (fixa/variável/eventual), lembrados neste navegador
  const LS_KEY = "rosele-tipos-v1";
  let tipos = { ...TIPO_PADRAO };
  try { Object.assign(tipos, JSON.parse(localStorage.getItem(LS_KEY) || "{}")); } catch (e) { /* sem storage */ }
  const salvarTipos = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(tipos)); } catch (e) { /* ok */ } };

  const despesaGrupos = () => GRUPOS.filter(g => ["fixa", "variavel", "eventual"].includes(TIPO_PADRAO[g.nome]));
  const somaTipo = (tipo, serieFn = serie) =>
    MESES.map((_, i) => sum(despesaGrupos().filter(g => tipos[g.nome] === tipo).map(g => serieFn(g.nome)[i])));

  // ================================================================ NAVEGAÇÃO
  const rendered = {};
  function show(page) {
    $$("nav.tabs button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.page === page)));
    $$("section.page").forEach(s => { s.hidden = s.id !== "page-" + page; });
    if (!rendered[page]) { RENDER[page](); rendered[page] = true; }
    try { history.replaceState(null, "", "#" + page); } catch (e) { /* ok */ }
    window.scrollTo({ top: 0 });
  }
  $$("nav.tabs button").forEach(b => b.addEventListener("click", () => show(b.dataset.page)));

  // ================================================================ VISÃO GERAL
  function renderGeral() {
    const fim = D.periodo.fim;
    $("#topbar").textContent = `Painel financeiro privado · dados de ${dataBR(D.periodo.inicio)} a ${dataBR(fim)} · gerado em ${dataBR(D.geradoEm)}`;
    $("#periodo-eyebrow").textContent = `${LBL[0]} – ${LBL[LBL.length - 1]} · ${D.transacoes.length} lançamentos`;
    $("#footer").innerHTML = `Rosele Aesthetics llc · painel interno, uso privado · fonte: lançamentos no QuickBooks (4 contas) · valores em US$`;

    const despEmpresa = MESES.map((_, i) => sum(despesaGrupos().filter(g => g.nome !== ATIVO).map(g => serie(g.nome)[i])));
    const lucro = MESES.map((_, i) => receita[i] - despEmpresa[i]);
    const fora = MESES.map((_, i) => serie("Retiradas da Rosele")[i] + serie("Gastos pessoais nos cartões")[i]);
    const recAbr = avg(receita, IDX_ABR), recQ1 = avg(receita.slice(0, 3));

    $("#hero-receita").textContent = usd(recAbr);
    $("#hero-sub").innerHTML = `No 1º trimestre a média era <b>${usd(recQ1)}</b>: a receita quase <b>dobrou</b>.`;
    $("#hero-note").textContent = "O aluguel pago em dinheiro (ago–set) e os impostos ainda não aparecem nos bancos.";

    const kpis = [
      ["Receita jan–set", usd(sum(receita)), `Melhor mês: ${LBL[receita.indexOf(Math.max(...receita))]} (${usd(Math.max(...receita))})`],
      ["Lucro da empresa jan–set", usd(sum(lucro)), "Receita − despesas da clínica (sem equipamento)"],
      ["Retiradas + gastos pessoais", usd(sum(fora)), `Média de ${usd(avg(fora, IDX_ABR))}/mês (abr–set)`],
      ["Gastos que não se repetem", usd(sum(["Reforma", "Viagens", "Faculdade (FNP)", "Equipamentos"].map(n => sum(serie(n))))), "Reforma, viagens, faculdade e a caneta DP Derm"],
    ];
    $("#kpis").innerHTML = kpis.map(([l, v, d]) => `<div class="card kpi"><div class="l">${l}</div><div class="v num">${v}</div><div class="d">${d}</div></div>`).join("");

    // cada US$ 100
    const tot = sum(receita);
    const per = n => sum(n) / tot * 100;
    const fixa = per(somaTipo("fixa")), vari = per(somaTipo("variavel"));
    const even = per(MESES.map((_, i) => somaTipo("eventual")[i] - (tipos[ATIVO] === "eventual" ? serie(ATIVO)[i] : 0)));
    const equip = per(serie(ATIVO)), foraP = per(fora);
    const saiu = fixa + vari + even + equip + foraP;
    const segs = [
      ["Despesas fixas", fixa, COR.fixa], ["Despesas variáveis", vari, COR.variavel], ["Gastos eventuais", even, COR.eventual],
      ["Equipamento", equip, "#7A5A2E"], ["Retiradas e pessoal", foraP, COR.fora],
    ];
    if (saiu < 100) segs.push(["Sobrou", 100 - saiu, GOOD]);
    const base = Math.max(100, saiu);
    $("#hundred").innerHTML = segs.map(([n, v, c]) => `<div title="${n}: $${v.toFixed(0)}" style="flex-basis:${v / base * 100}%;background:${c}">${v / base > .07 ? "$" + v.toFixed(0) : ""}</div>`).join("")
      + `<span class="cem" style="left:${100 / base * 100}%" ${saiu > 100 ? "" : "hidden"}><em>US$ 100 que entraram</em></span>`;
    $("#hundred-legend").innerHTML = segs.map(([n, v, c]) => `<div><span class="tag"><i style="background:${c}"></i>${n}</span><b class="num">$${v.toFixed(0)}</b></div>`).join("")
      + (saiu > 100 ? `<div><span class="tag"><i style="background:${BAD}"></i>Veio de fora</span><b class="num" style="color:${BAD}">$${(saiu - 100).toFixed(0)}</b></div>` : "");
    $("#hundred-hint").innerHTML = saiu > 100
      ? `Soma de janeiro a setembro. Para cada <b>US$ 100</b> que as clientes pagaram, saíram <b>US$ ${saiu.toFixed(0)}</b>. A diferença veio de fora do caixa da clínica: principalmente faturas do Amex pagas com o seu dinheiro pessoal.`
      : `Soma de janeiro a setembro. Para cada US$ 100 que as clientes pagaram, sobraram US$ ${(100 - saiu).toFixed(0)}.`;

    chart("ch-receita", {
      type: "bar",
      data: { labels: LBL, datasets: [{ label: "Receita", data: receita, backgroundColor: LBL.map((_, i) => i >= IDX_ABR ? GOLD : "#D9C9A3"), borderRadius: 4, maxBarThickness: 34 }] },
      options: { maintainAspectRatio: false, scales: { y: yMoney, x: xPlain }, plugins: { tooltip: { callbacks: { label: c => " Receita: " + usd(c.raw) } } } },
    });
    chart("ch-lucro", {
      type: "bar",
      data: { labels: LBL, datasets: [{ label: "Lucro", data: lucro, backgroundColor: lucro.map(v => v >= 0 ? GOLD : COR.eventual), borderRadius: 4, maxBarThickness: 34 }] },
      options: {
        maintainAspectRatio: false, scales: { y: yMoney, x: xPlain },
        plugins: { tooltip: { callbacks: { label: c => " Lucro: " + usd(c.raw), afterLabel: c => motivoMes(c.dataIndex) } } },
      },
    });

    // maiores fornecedores
    const porF = {};
    D.transacoes.forEach(t => { if (["fixa", "variavel", "eventual"].includes(TIPO_PADRAO[t.g])) porF[t.f] = (porF[t.f] || 0) + t.v; });
    const top = Object.entries(porF).sort((a, b) => b[1] - a[1]).slice(0, 12);
    const tipoF = f => { const t = D.transacoes.find(x => x.f === f && TIPO_PADRAO[x.g] !== "receita"); return t ? tipos[t.g] : "variavel"; };
    chart("ch-fornec", {
      type: "bar",
      data: { labels: top.map(x => x[0]), datasets: [{ data: top.map(x => x[1]), backgroundColor: top.map(x => COR[tipoF(x[0])]), borderRadius: 4, maxBarThickness: 18 }] },
      options: {
        indexAxis: "y", maintainAspectRatio: false,
        scales: { x: { ...yMoney, ticks: { ...yMoney.ticks, maxRotation: 0, maxTicksLimit: 6 } }, y: { grid: { display: false }, border: { display: false }, ticks: { color: INK } } },
        plugins: { tooltip: { callbacks: { label: c => " " + usd(c.raw) + " · " + NOME_TIPO[tipoF(c.label)] } } },
      },
    });

    // por conta
    const porC = {};
    D.transacoes.forEach(t => {
      const c = (porC[t.c] = porC[t.c] || { emp: 0, fora: 0, rec: 0, n: 0 });
      c.n++;
      if (t.g === "Receita de clientes") c.rec += t.v; else if (TIPO_PADRAO[t.g] === "fora") c.fora += t.v; else c.emp += t.v;
    });
    $("#tb-contas").innerHTML = `<thead><tr><th>Conta</th><th class="r">Lanç.</th><th class="r">Receita</th><th class="r">Despesas</th><th class="r">Pessoal/retiradas</th></tr></thead><tbody>` +
      Object.entries(porC).map(([k, c]) => `<tr><td>${esc(D.contas[k] || k)}</td><td class="r num">${c.n}</td><td class="r num">${c.rec ? usd(c.rec) : "—"}</td><td class="r num">${usd(c.emp)}</td><td class="r num">${usd(c.fora)}</td></tr>`).join("") + "</tbody>";
  }
  function motivoMes(i) {
    const grandes = despesaGrupos().filter(g => g.nome !== ATIVO).map(g => [g.nome, serie(g.nome)[i]]).sort((a, b) => b[1] - a[1]).slice(0, 2);
    return grandes.map(([n, v]) => ` ${n}: ${usd(v)}`);
  }

  // ================================================================ FIXAS × VARIÁVEIS
  let avgFrom = IDX_ABR;
  function serieDesp(nome) {
    const s = serie(nome).slice();
    if (nome === "Aluguel" && $("#cash-rent").checked) {
      const est = P.fixosItens["Aluguel"] || 850;
      MESES.forEach((m, i) => { if (i >= 3 && s[i] === 0) s[i] = est; });
    }
    return s;
  }
  function renderDespesas() {
    const recAvg = avg(receita, avgFrom);
    const periodo = avgFrom ? "abr–set" : "jan–set";
    // colunas
    $("#buckets").innerHTML = ["fixa", "variavel", "eventual"].map(t => {
      const itens = despesaGrupos().filter(g => tipos[g.nome] === t).map(g => ({ g, m: avg(serieDesp(g.nome), avgFrom) })).sort((a, b) => b.m - a.m);
      const total = sum(itens.map(x => x.m));
      const sub = { fixa: "Vêm todo mês, com ou sem cliente", variavel: "Acompanham o movimento da agenda", eventual: "Grandes e pontuais (não se repetem)" }[t];
      return `<div class="bucket ${t}" data-tipo="${t}">
        <h3><span>${NOME_TIPO[t]}</span><span class="t num">${usd(total)}<small style="font-weight:400;color:var(--muted)">/mês</small></span></h3>
        <div class="sub">${sub} · média ${periodo}</div>
        ${itens.map(({ g, m }) => `<button class="chip" draggable="true" data-nome="${esc(g.nome)}" title="Clique para mudar de coluna">
          <span><span class="n">${esc(g.nome)}</span><span class="e">${esc(g.exemplo)}</span></span><span class="v num">${usd(m)}</span></button>`).join("") || '<div class="sub">Arraste itens para cá</div>'}
      </div>`;
    }).join("");
    ligarChips();

    const fixas = avg(somaTipo("fixa", serieDesp), avgFrom);
    const vari = avg(somaTipo("variavel", serieDesp), avgFrom);
    const even = avg(somaTipo("eventual", serieDesp), avgFrom);
    const varPct = recAvg ? vari / recAvg : 0;
    const be = varPct < 1 ? fixas / (1 - varPct) : Infinity;

    $("#desp-kpis").innerHTML = [
      ["Fixas por mês", usd(fixas), "O custo de abrir a porta, mesmo sem cliente", COR.fixa],
      ["Variáveis", pct(varPct) + " da receita", `≈ ${usd(vari)}/mês: de cada US$ 100 recebidos, US$ ${(varPct * 100).toFixed(0)} vão para elas`, COR.variavel],
      ["Eventuais", usd(even) + "/mês", `Média ${periodo}. Não entram no ponto de equilíbrio`, COR.eventual],
    ].map(([l, v, d, c]) => `<div class="card kpi" style="border-top:4px solid ${c}"><div class="l">${l}</div><div class="v num">${v}</div><div class="d">${d}</div></div>`).join("");

    // ponto de equilíbrio
    $("#be-hint").textContent = `Ponto de equilíbrio = fixas ÷ (1 − variáveis em % da receita). Abaixo dele a clínica perde dinheiro; acima, cada atendimento a mais vira sobra. Média ${periodo}.`;
    const max = Math.max(recAvg, be) * 1.2;
    $("#be-gauge .fill").style.width = Math.min(100, recAvg / max * 100) + "%";
    $("#be-gauge .mark").style.left = Math.min(100, be / max * 100) + "%";
    $("#be-gauge .mark span").textContent = "Equilíbrio " + usd(be);
    const folga = recAvg - be;
    const sobra = recAvg - fixas - vari;
    $("#be-text").innerHTML = folga >= 0
      ? `Você precisa faturar <b>${usd(be)}/mês</b> só para pagar as fixas e as variáveis. Hoje a média é <b>${usd(recAvg)}</b>, ${usd(folga)} acima do equilíbrio. Depois de pagar fixas e variáveis, sobram <b>~${usd(sobra)}/mês</b>: é esse dinheiro que paga retiradas, impostos, gastos eventuais e uma máquina nova.`
      : `Você precisa faturar <b>${usd(be)}/mês</b> só para pagar as fixas e as variáveis, mas a média é <b>${usd(recAvg)}</b>: faltam <b>${usd(-folga)}/mês</b>.`;

    // gráfico empilhado
    const ds = ["fixa", "variavel", "eventual"].map(t => ({
      type: "bar", label: NOME_TIPO[t], data: somaTipo(t, serieDesp), backgroundColor: COR[t], stack: "d",
      borderColor: "#fff", borderWidth: { top: 2 }, borderSkipped: "bottom", maxBarThickness: 40, order: 2,
    }));
    ds[2].borderRadius = { topLeft: 4, topRight: 4 };
    ds.push({ type: "line", label: "Receita", data: receita, borderColor: INK, borderWidth: 2, pointRadius: 4, pointBackgroundColor: INK, pointBorderColor: "#fff", pointBorderWidth: 2, tension: .25, order: 1 });
    chart("ch-desp", {
      data: { labels: LBL, datasets: ds },
      options: {
        maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { x: { ...xPlain, stacked: true }, y: { ...yMoney, stacked: true } },
        plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${usd(c.raw)}` } } },
      },
    });

    // tabela
    const linhas = despesaGrupos().map(g => ({ g, s: serieDesp(g.nome) })).sort((a, b) => ["fixa", "variavel", "eventual"].indexOf(tipos[a.g.nome]) - ["fixa", "variavel", "eventual"].indexOf(tipos[b.g.nome]) || avg(b.s, avgFrom) - avg(a.s, avgFrom));
    $("#tb-desp").innerHTML = `<thead><tr><th>Item</th><th>Tipo</th>${LBL.map(l => `<th class="r">${l}</th>`).join("")}<th class="r">Média</th><th class="r">% receita</th></tr></thead><tbody>` +
      linhas.map(({ g, s }) => `<tr><td><b>${esc(g.nome)}</b></td><td><span class="tag"><i style="background:${COR[tipos[g.nome]]}"></i>${NOME_TIPO[tipos[g.nome]]}</span></td>${s.map(v => `<td class="r num">${Math.abs(v) < .5 ? "—" : usd(v)}</td>`).join("")}<td class="r num"><b>${usd(avg(s, avgFrom))}</b></td><td class="r num">${pct(avg(s, avgFrom) / recAvg)}</td></tr>`).join("") +
      `</tbody>`;
  }
  function moverPara(nome, tipo) { tipos[nome] = tipo; salvarTipos(); renderDespesas(); rendered.geral = false; }
  function ligarChips() {
    const ordem = ["fixa", "variavel", "eventual"];
    $$(".chip").forEach(ch => {
      ch.addEventListener("click", () => { const n = ch.dataset.nome; moverPara(n, ordem[(ordem.indexOf(tipos[n]) + 1) % 3]); });
      ch.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", ch.dataset.nome); ch.classList.add("dragging"); });
      ch.addEventListener("dragend", () => ch.classList.remove("dragging"));
    });
    $$(".bucket").forEach(b => {
      b.addEventListener("dragover", e => { e.preventDefault(); b.classList.add("over"); });
      b.addEventListener("dragleave", () => b.classList.remove("over"));
      b.addEventListener("drop", e => { e.preventDefault(); const n = e.dataTransfer.getData("text/plain"); if (n) moverPara(n, b.dataset.tipo); });
    });
  }
  $$("[data-avg]").forEach(b => b.addEventListener("click", () => {
    avgFrom = b.dataset.avg === "abr" ? IDX_ABR : 0;
    $$("[data-avg]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    renderDespesas();
  }));
  $("#cash-rent").addEventListener("change", renderDespesas);
  $("#reset-tipos").addEventListener("click", () => { tipos = { ...TIPO_PADRAO }; salvarTipos(); renderDespesas(); rendered.geral = false; });

  // ================================================================ SIMULADOR DA MÁQUINA
  const START = new Date(2026, 10, 1);            // mês 1 = nov/2026
  const simMes = n => { const d = new Date(START.getFullYear(), START.getMonth() + n - 1, 1); return MES[d.getMonth()] + "/" + String(d.getFullYear()).slice(2); };
  const pmt = (taxaAno, n, pv) => { const r = taxaAno / 12; return r ? pv * r / (1 - Math.pow(1 + r, -n)) : pv / n; };
  const HAB = {
    hoje: { retirada: avg(serie("Retiradas da Rosele"), IDX_ABR), pessoal: avg(serie("Gastos pessoais nos cartões"), IDX_ABR), viagens: avg(serie("Viagens")) },
    disciplina: { retirada: P.retirada, pessoal: 0, viagens: P.viagens },
  };
  const PADRAO = { preco: P.precoBRL / P.cambio, mes: 8, opcao: "C", sessoes: P.sessoesMeta, precoSessao: P.precoSessao, ...HAB.disciplina };
  let S = { ...PADRAO };

  const OPCOES = {
    A: { nome: "À vista", desc: "Paga tudo com o caixa", plano: c => ({ entrada: c, parcela: 0, n: 0 }) },
    B: { nome: "0% em 12x", desc: "Cartão/fabricante sem juros", plano: c => ({ entrada: 0, parcela: c / 12, n: 12 }) },
    C: { nome: "30% + 36x", desc: "Entrada + financiamento", rec: true, plano: c => ({ entrada: c * P.entradaPct, parcela: pmt(P.jurosFin, 36, c * (1 - P.entradaPct)), n: 36 }) },
    D: { nome: "100% em 60x", desc: "Financiamento sem entrada", plano: c => ({ entrada: 0, parcela: pmt(P.jurosFin, 60, c), n: 60 }) },
    E: { nome: "Leasing 48x", desc: "Arrendamento, compra por $1", plano: c => ({ entrada: 0, parcela: pmt(P.jurosLeasing, 48, c), n: 48 }) },
  };

  function simular(s) {
    const custo = s.preco * (1 + P.salesTax) + P.frete;
    const pl = OPCOES[s.opcao].plano(custo);
    const margem = s.precoSessao * (1 - P.taxaCartao) - P.custoSessao;          // por sessão
    const margemReal = margem * (1 - P.canibalizacao) * (1 - P.impostoPct);     // descontando canibalização e imposto
    const manut = custo * P.manutencao / 12;
    const reserva = P.reservaMeses * (P.custosFixos + P.receita * P.cmvPct);
    let saldo = P.saldo, divida = P.divida6346, acumMaq = 0;
    const meses = [];
    let quitado6346 = null, pagou = null, reservaOk = null;
    for (let i = 1; i <= 24; i++) {
      const rec = P.receita, cmv = rec * P.cmvPct, fixos = P.custosFixos + s.viagens;
      let maqLiq = 0, man = 0, pagMaq = 0;
      if (i >= s.mes) {
        const k = i - s.mes + 1;
        const rampa = k <= 3 ? P.rampa1 : k <= 6 ? P.rampa2 : 1;
        maqLiq = s.sessoes * rampa * margem * (1 - P.canibalizacao);
        man = manut;
        if (k === 1) pagMaq += pl.entrada;
        if (k <= pl.n) pagMaq += pl.parcela;
        acumMaq += maqLiq * (1 - P.impostoPct) - man;
        if (pagou === null && acumMaq >= custo) pagou = i;
      }
      const lucro = rec - cmv - fixos + maqLiq - man;
      const imposto = Math.max(0, lucro) * P.impostoPct;
      const p6346 = Math.min(P.parcela6346, divida); divida -= p6346;
      if (quitado6346 === null && divida <= 0.005) quitado6346 = i;
      const livre = lucro - imposto - s.retirada - s.pessoal - p6346 - pagMaq;
      saldo += livre;
      if (reservaOk === null && saldo >= reserva) reservaOk = i;
      meses.push({ i, saldo, livre, pagMaq });
    }
    const saldos = meses.map(m => m.saldo);
    const pior = Math.min(...saldos);
    const lucroMaqMes = s.sessoes * margemReal - manut;
    return {
      custo, pl, margem, margemReal, manut, reserva, meses, pior, piorMes: saldos.indexOf(pior) + 1, final: saldos[23],
      quitado6346, pagou, reservaOk,
      juros: pl.entrada + pl.parcela * pl.n - custo,
      payback: lucroMaqMes > 0 ? custo / lucroMaqMes : Infinity,
      sessParcela: margemReal > 0 ? Math.ceil((pl.parcela + manut) / margemReal) : Infinity,
    };
  }

  const CTL = {
    preco: { el: "#in-preco", out: v => usd(v) },
    mes: { el: "#in-mes", out: v => simMes(v) },
    retirada: { el: "#in-retirada", out: v => usd(v) },
    pessoal: { el: "#in-pessoal", out: v => usd(v) },
    viagens: { el: "#in-viagens", out: v => usd(v) },
    sessoes: { el: "#in-sessoes", out: v => v + "/mês" },
    precoSessao: { el: "#in-precoSessao", out: v => usd(v) },
  };
  function syncControles() {
    for (const [k, c] of Object.entries(CTL)) {
      const el = $(c.el); el.value = S[k];
      el.style.setProperty("--p", ((el.value - el.min) / (el.max - el.min) * 100) + "%");
      $("#out-" + el.id.slice(3)).textContent = c.out(S[k]);
    }
    $$("[data-preco]").forEach(b => b.setAttribute("aria-pressed", String((b.dataset.preco === "brl" ? PADRAO.preco : +b.dataset.preco) === S.preco)));
    $$("[data-habito]").forEach(b => {
      const h = HAB[b.dataset.habito];
      b.setAttribute("aria-pressed", String(Math.abs(h.retirada - S.retirada) < 26 && Math.abs(h.pessoal - S.pessoal) < 13 && Math.abs(h.viagens - S.viagens) < 13));
    });
  }

  function renderMaquina() {
    if (!rendered.maquinaInit) initMaquina();
    syncControles();
    const r = simular(S);
    const custoFmt = usd(r.custo);
    $("#help-preco").textContent = `≈ R$ ${(S.preco * P.cambio).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} (câmbio ${String(P.cambio).replace(".", ",")}). Custo total com sales tax de NJ e frete: ${custoFmt}.`;

    // cartões de opção
    $("#options").innerHTML = Object.entries(OPCOES).map(([k, o]) => {
      const pl = o.plano(r.custo);
      const txt = k === "A" ? usd(pl.entrada) + " de uma vez" : (pl.entrada ? usd(pl.entrada) + " + " : "") + usd(pl.parcela) + "/mês";
      return `<button class="opt" data-op="${k}" aria-pressed="${S.opcao === k}">${o.rec ? '<span class="rec">Recomendada</span>' : ""}<span class="letter">${k}</span><span class="name">${o.nome}</span><span class="pmt num">${txt}</span><span class="pmt">${o.desc}</span></button>`;
    }).join("");
    $$(".opt").forEach(b => b.addEventListener("click", () => { S.opcao = b.dataset.op; renderMaquina(); }));

    // veredito
    const v = r.pior < 0 ? "bad" : r.pior < 5000 ? "warn" : "ok";
    $("#verdict").className = "verdict " + v;
    $("#verdict-icon").textContent = { ok: "✓", warn: "!", bad: "✕" }[v];
    $("#verdict-title").textContent = { ok: "Viável", warn: "Arriscado: caixa muito apertado", bad: "Não dá: a conta fica negativa" }[v];
    $("#verdict-text").innerHTML = `O menor saldo da conta seria <b>${usd(r.pior)}</b> em ${simMes(r.piorMes)}; em out/2028 a conta teria <b>${usd(r.final)}</b>.` +
      (v === "warn" ? " Abaixo de ~US$ 5 mil, qualquer mês fraco ou conta de imposto vira problema." : "") +
      (v === "bad" && S.pessoal > 0 ? " Tente zerar os gastos pessoais nos cartões ou adiar a compra." : "");

    // linha do tempo
    const marcos = [
      { m: 0, t: "Hoje", s: "out/26", c: INK },
      { m: r.quitado6346, t: "Cartão 6346 quitado", s: r.quitado6346 && simMes(r.quitado6346), c: GOOD },
      { m: S.mes, t: "Compra da máquina", s: simMes(S.mes), c: COR.eventual },
      { m: r.pagou, t: "Máquina se pagou", s: r.pagou ? simMes(r.pagou) : null, c: GOLD },
      { m: r.reservaOk, t: "Reserva completa", s: r.reservaOk ? simMes(r.reservaOk) : null, c: COR.variavel },
    ];
    const FALTA = { "Máquina se pagou": "a máquina se pagar", "Reserva completa": "a reserva de emergência ficar completa" };
    const naoChega = marcos.filter(x => x.m === null && FALTA[x.t]).map(x => FALTA[x.t]);
    // junta marcos do mesmo mês num ponto só
    const vis = [];
    marcos.filter(x => x.m !== null).sort((a, b) => a.m - b.m).forEach(x => {
      const igual = vis.find(y => y.m === x.m);
      if (igual) { igual.t += " + " + x.t.charAt(0).toLowerCase() + x.t.slice(1); igual.c2 = x.c; } else vis.push({ ...x });
    });
    $("#track").innerHTML = vis.map((x, j) => {
      const pos = x.m / 24 * 100, lado = pos < 8 ? "ini" : pos > 92 ? "fim" : "";
      const bg = x.c2 ? `linear-gradient(90deg, ${x.c} 50%, ${x.c2} 50%)` : x.c;
      return `<div class="ms ${j % 2 ? "down" : "up"} ${lado}" style="left:${pos}%"><div class="dot" style="background:${bg}"></div><div class="lab">${x.t}<small>${x.s}</small></div></div>`;
    }).join("");
    $("#ticks").innerHTML = [0, 3, 6, 9, 12, 15, 18, 21, 24].map(m => `<span>${m ? simMes(m) : "out/26"}</span>`).join("");
    let nota = $("#timeline-nota");
    if (!nota) { nota = document.createElement("p"); nota.id = "timeline-nota"; nota.className = "hint"; $("#timeline").after(nota); }
    nota.textContent = naoChega.length ? "Até out/2028 não dá tempo de " + naoChega.join(" nem de ") + "." : "";

    // gráfico do saldo
    const lbl = r.meses.map(m => simMes(m.i));
    const compraIdx = S.mes - 1;
    chart("ch-saldo", {
      type: "line",
      data: {
        labels: lbl, datasets: [
          { label: "Saldo", data: r.meses.map(m => m.saldo), borderColor: GOLD, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: { target: { value: 0 }, above: "rgba(174,146,83,.12)", below: "rgba(178,59,46,.14)" }, tension: .2 },
          { label: "Reserva ideal", data: r.meses.map(() => r.reserva), borderColor: MUTED, borderWidth: 1.5, borderDash: [6, 5], pointRadius: 0, pointHoverRadius: 0 },
        ],
      },
      options: {
        maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        scales: { x: { ...xPlain, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } }, y: yMoney },
        plugins: { tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${usd(c.raw)}`, afterBody: it => { const m = r.meses[it[0].dataIndex]; return m.pagMaq ? [` Pago pela máquina: ${usd(m.pagMaq)}`] : []; } } } },
      },
      plugins: [{
        id: "marca", afterDatasetsDraw(ch) {
          const x = ch.scales.x.getPixelForValue(compraIdx), { top, bottom } = ch.chartArea, ctx = ch.ctx;
          ctx.save(); ctx.strokeStyle = COR.eventual; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
          ctx.fillStyle = COR.eventual; ctx.font = "700 11px Helvetica, Arial"; ctx.textAlign = x > ch.chartArea.right - 80 ? "right" : "left";
          ctx.fillText(" compra ", x, top + 12); ctx.restore();
          const y0 = ch.scales.y.getPixelForValue(0);
          if (y0 > top && y0 < bottom) { ctx.save(); ctx.strokeStyle = "#B9B2A8"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ch.chartArea.left, y0); ctx.lineTo(ch.chartArea.right, y0); ctx.stroke(); ctx.restore(); }
        },
      }],
    });

    // cofrinho
    const f = Math.max(0, Math.min(1, r.final / r.reserva));
    const h = 110 * f;
    $("#jar-fill").setAttribute("y", 144 - h); $("#jar-fill").setAttribute("height", h);
    $("#jar-fill").setAttribute("fill", r.final < 0 ? BAD : GOLD);
    $("#jar-pct").textContent = Math.round(Math.max(0, r.final / r.reserva) * 100) + "%";
    $("#jar-v").textContent = usd(r.final);
    $("#jar-l").innerHTML = `de ${usd(r.reserva)} ideais.<br>` + (r.final >= r.reserva ? "Reserva completa. 🎉" : `Faltariam ${usd(r.reserva - Math.max(0, r.final))}.`);

    // sessões
    const need = r.sessParcela;
    const total = Math.max(S.sessoes, Math.min(need, 30));
    $("#sessions").innerHTML = Array.from({ length: total }, (_, i) => `<span class="${i < need ? "need" : i < S.sessoes ? "" : "extra"}">${i + 1}</span>`).join("");
    $("#sess-hint").innerHTML = S.opcao === "A"
      ? `Sem parcela: só a manutenção (${usd(r.manut)}/mês). Cada sessão deixa ~${usd(r.margemReal)} livres de imposto.`
      : `A parcela + manutenção (${usd(r.pl.parcela + r.manut)}/mês) se paga com <b>${need} sessões</b> por mês. Cada sessão deixa ~${usd(r.margemReal)} livres (já sem taxa, consumível, canibalização e imposto). Os círculos vazios são a sua meta de ${S.sessoes}.`;
    $("#mini").innerHTML = [
      [usd(r.custo), "custo total (com sales tax e frete)"],
      [r.juros > 1 ? usd(r.juros) : "$0", "de juros no total"],
      [isFinite(r.payback) ? r.payback.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " meses" : "nunca", "para se pagar com a agenda cheia"],
      [usd(r.custo * P.beneficio179), "a menos de imposto (Section 179, confirmar com o contador)"],
    ].map(([b, s]) => `<div><b class="num">${b}</b><span>${s}</span></div>`).join("");
  }

  function initMaquina() {
    rendered.maquinaInit = true;
    for (const [k, c] of Object.entries(CTL)) {
      $(c.el).addEventListener("input", e => { S[k] = +e.target.value; renderMaquina(); });
    }
    $$("[data-preco]").forEach(b => b.addEventListener("click", () => { S.preco = b.dataset.preco === "brl" ? PADRAO.preco : +b.dataset.preco; renderMaquina(); }));
    $$("[data-habito]").forEach(b => b.addEventListener("click", () => { Object.assign(S, HAB[b.dataset.habito]); S.retirada = Math.round(S.retirada); S.pessoal = Math.round(S.pessoal); S.viagens = Math.round(S.viagens); renderMaquina(); }));
    $("#reset-sim").addEventListener("click", () => { S = { ...PADRAO }; renderMaquina(); });
  }

  // ================================================================ LANÇAMENTOS
  const PG = 50; let pg = 0;
  function renderLancamentos() {
    const opt = (v, t) => `<option value="${esc(v)}">${esc(t)}</option>`;
    $("#f-conta").innerHTML = opt("", "Todas as contas") + Object.entries(D.contas).map(([k, n]) => opt(k, n)).join("");
    $("#f-grupo").innerHTML = opt("", "Todos os grupos") + GRUPOS.map(g => opt(g.nome, g.nome)).join("");
    const ms = [...new Set(D.transacoes.map(t => t.d.slice(0, 7)))];
    $("#f-mes").innerHTML = opt("", "Todos os meses") + ms.map(m => opt(m, mesLabel(m))).join("");
    ["#f-busca", "#f-conta", "#f-grupo", "#f-mes"].forEach(s => $(s).addEventListener("input", () => { pg = 0; tabelaTx(); }));
    $("#pg-prev").addEventListener("click", () => { pg--; tabelaTx(); });
    $("#pg-next").addEventListener("click", () => { pg++; tabelaTx(); });
    tabelaTx();
  }
  function tabelaTx() {
    const q = $("#f-busca").value.trim().toLowerCase(), c = $("#f-conta").value, g = $("#f-grupo").value, m = $("#f-mes").value;
    const rows = D.transacoes.filter(t => (!c || t.c === c) && (!g || t.g === g) && (!m || t.d.startsWith(m)) && (!q || (t.f + " " + t.desc + " " + t.g).toLowerCase().includes(q))).slice().reverse();
    const ent = sum(rows.filter(t => t.g === "Receita de clientes").map(t => t.v));
    const sai = sum(rows.filter(t => t.g !== "Receita de clientes").map(t => t.v));
    $("#f-resumo").innerHTML = `${rows.length} lançamentos · entradas de clientes <b>${usd(ent, 2)}</b> · saídas <b>${usd(sai, 2)}</b>`;
    const pages = Math.max(1, Math.ceil(rows.length / PG)); pg = Math.max(0, Math.min(pg, pages - 1));
    $("#tb-tx").innerHTML = `<thead><tr><th>Data</th><th>Conta</th><th>Fornecedor</th><th>Descrição no banco</th><th>Grupo</th><th class="r">Valor</th></tr></thead><tbody>` +
      rows.slice(pg * PG, pg * PG + PG).map(t => {
        const tp = TIPO_PADRAO[t.g] === "receita" ? "receita" : tipos[t.g] || TIPO_PADRAO[t.g];
        const val = t.g === "Receita de clientes" ? `<span style="color:${GOOD}">+${usd(t.v, 2)}</span>` : usd(-t.v, 2);
        return `<tr><td class="num">${dataBR(t.d)}</td><td>${esc(t.c)}</td><td>${esc(t.f)}</td><td>${esc(t.desc)}</td><td><span class="tag"><i style="background:${COR[tp]}"></i>${esc(t.g)}</span></td><td class="r num">${val}</td></tr>`;
      }).join("") + "</tbody>";
    $("#pg-info").textContent = `Página ${pg + 1} de ${pages}`;
    $("#pg-prev").disabled = pg === 0; $("#pg-next").disabled = pg >= pages - 1;
  }

  const RENDER = { geral: renderGeral, despesas: renderDespesas, maquina: renderMaquina, lancamentos: renderLancamentos };
  const inicial = (location.hash || "").slice(1);
  renderGeral(); rendered.geral = true;
  show(RENDER[inicial] ? inicial : "geral");
  window.addEventListener("hashchange", () => { const p = location.hash.slice(1); if (RENDER[p]) show(p); });
  // sempre redesenha a visão geral ao voltar (os tipos podem ter mudado)
  $$("nav.tabs button").forEach(b => b.addEventListener("click", () => { if (b.dataset.page === "geral") { renderGeral(); } }));

  // exposto para conferência no console
  window.__simular = simular;
  window.__PADRAO = PADRAO;
})();
