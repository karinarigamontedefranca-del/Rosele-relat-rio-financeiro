/* Modelo do plano da máquina (versão de 30/10/2026).
   Mesma lógica de _scripts_classificacao/modelo_poupanca_maquina.py, com estas mudanças:
   1. a receita inclui o dinheiro vivo que não vai para o banco (Vagaro × banco, abr–set/2026);
   2. a retirada é de $5.000 por mês (o que a Rosele precisa para viver), já contando esse dinheiro;
   3. revisei o orçamento: alguns cortes estavam apertados demais e foram afrouxados;
   4. 30/10: saldos reais do QuickBooks, $18 mil já guardados, aluguel de $953, curso de novembro
      e meses fortes e fracos (novembro é o melhor mês, janeiro cai).
   Funciona no navegador (window.Modelo) e no Node (globalThis.Modelo), para conferir as contas. */
(function (root) {
  "use strict";

  const BASE = {
    recBanco: 14852,        // receita de clientes que entrou no banco, média abr–set/2026
    dinheiroFora: 3739,     // dinheiro vivo registrado no Vagaro e não depositado, média abr–set/2026
    prodPct: 0.1985,        // produtos jan–set ÷ receita real jan–set ($28.603 ÷ $144.125)
    imposto: 0.28,
    saldoBanco6216: 16345.40,   // QuickBooks, 30/10/2026
    faturaGold: 6267.88,        // Amex Gold, a pagar
    fatura2378: 5064.93,        // cartão 2378, a pagar
    get saldo6216() { return this.saldoBanco6216 - this.faturaGold - this.fatura2378; },
    reservaMin: 7500,
    divida6346: 6800.21,
    min6346: 150,
    valor: 60000,
    apr: 0.24,
    manut: 250,
    descPre: 0.10,
    sinalPre: 0.5,
    pessoalHoje: 974,
    retiradaHoje: 2149,
  };

  // linha, hoje (média abr–set/2026), proposta, veredito, motivo
  const ORC = [
    { id: "prod", nome: "Produtos aplicados", hoje: 4513, prop: 3700, ver: "ok",
      why: "Em maio entrou uma compra de estoque de $15 mil, que puxou a média para cima. No ano, o produto custa uns 20% do que você recebe. Comprando conforme a agenda, dá uns $3.700." },
    { id: "equipe", nome: "Assistentes e prestadores", hoje: 2169, prop: 2169, ver: "mantem", why: "Ninguém trabalha de graça. Fica igual." },
    { id: "medica", nome: "Médica supervisora", hoje: 900, prop: 900, ver: "mantem", why: "Obrigatória. Fica igual." },
    { id: "anuncios", nome: "Anúncios", hoje: 1000, prop: 1000, ver: "mantem", why: "É o que traz cliente nova. Cortar aqui é cortar receita." },
    { id: "aluguel", nome: "Aluguel", hoje: 510, prop: 953, ver: "real", why: "O valor que você me passou em 26/10. Nos últimos meses parte foi paga em dinheiro e não aparece no banco." },
    { id: "cursos", nome: "Cursos, clubes e mentorias", hoje: 940, prop: 600, ver: "ajuste", why: "Eu tinha proposto $450. Com o treinamento da máquina chegando, $600 é mais real." },
    { id: "fixos", nome: "Seguro, internet e software", hoje: 323, prop: 323, ver: "mantem", why: "Contas fixas pequenas. Fica igual." },
    { id: "material", nome: "Material de consumo", hoje: 366, prop: 366, ver: "mantem", why: "Luvas, seringas, Amazon, Target. Fica igual." },
    { id: "parcelas", nome: "Parcelas (Citizens Pay, Apple Card)", hoje: 376, prop: 260, ver: "ok", why: "Só as parcelas que já existem. Nenhuma compra parcelada nova até a máquina." },
    { id: "viagens", nome: "Viagens", hoje: 703, prop: 250, ver: "ajuste", why: "Eu tinha proposto $150. $250 por mês dá uma viagem de trabalho de uns $3 mil no ano." },
    { id: "refeicoes", nome: "Refeições", hoje: 268, prop: 150, ver: "ajuste", why: "Eu tinha proposto $100, apertado demais. $150 é possível." },
    { id: "carro", nome: "Carro", hoje: 93, prop: 93, ver: "mantem", why: "Já é pouco. Fica igual." },
    { id: "tarifas", nome: "Tarifas, doações e outros", hoje: 155, prop: 100, ver: "ajuste", why: "Eu tinha proposto $75. $100 dá folga para tarifa de banco e alguma doação." },
    { id: "escritorio", nome: "Escritório (compras avulsas)", hoje: 84, prop: 50, ver: "ok", why: "Compras pequenas, dá para segurar." },
    { id: "devolucoes", nome: "Devoluções a clientes", hoje: 82, prop: 82, ver: "mantem", why: "Acontece. Deixei o mesmo valor." },
    { id: "reforma", nome: "Reforma", hoje: 462, prop: 0, ver: "ok", why: "A obra de março e julho já acabou. Nenhuma obra nova até a compra." },
    { id: "equip", nome: "Equipamentos", hoje: 1042, prop: 0, ver: "ok", why: "Foi uma compra única em abril ($6.252). O próximo equipamento é a máquina." },
  ];

  const SAZ = { 6: .3, 7: .4, 8: .6, 9: .9, 10: 1, 11: 1.2, 12: 1.2, 1: 1.3, 2: 1.3, 3: 1.2, 4: 1, 5: .8 };
  const CEN = { Pessimista: [550, 4], Realista: [850, 7], Otimista: [1200, 10] };
  const MES = ["", "jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  // quanto cada mês vale perto de um mês médio da clínica: novembro é o melhor, janeiro cai (áudios de 22/10)
  const FATOR = { 1: .8, 2: .9, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1.2, 12: 1.1 };
  // gastos que acontecem uma vez só, por mês do plano
  const UNICOS = { "2026-11": { nome: "Curso de 26 a 28/11 (valor a confirmar)", valor: 2000 } };

  const PADRAO = {
    contarDinheiro: true, retirada: 5000, receitaExtra: 0, compraMes: 7, compraAno: 2027,
    s179: true, min6346: true, prevenda: 15000, extraPessoal: 0, guardarAuto: true, guardarFixo: 1500,
    cen: "Realista", apr: 0.24, valor: 60000, orc: null, dinheiroGuardado: 18000,
  };
  // atualizado por mim: o que já está guardado de verdade
  const COFRINHO = { valor: 18000, meta: 60000, em: "30/10/2026", onde: "em dinheiro, contado pelo Alex" };

  // Natal: premissas em três cenários (o Excel usa as mesmas)
  const NATAL_PREMISSAS = {
    gcValor: 300, gcDesconto: 0.15, gcNovo: 0.3, prodPct: 0.2,
    ticket: 767,   // ticket médio dos atendimentos de $400 ou mais, Vagaro abr–out/2026
    upsell: 150, precoPack: 15, cartoesPack: 50,
    brindeB12: { pct: 0.65, custo: 6 }, brindeCreme: { pct: 0.2, custo: 15 }, voucher: { pct: 0.15, desconto: 0.2, novo: 0.5 },
    cenarios: [
      { nome: "Cautelosa", gc: 5, cartoes: 20, sobe: 3, volta: 0.5 },
      { nome: "Provável", gc: 10, cartoes: 28, sobe: 6, volta: 0.6 },
      { nome: "Boa", gc: 20, cartoes: 36, sobe: 10, volta: 0.7 },
    ],
  };
  function natal() {
    const P = NATAL_PREMISSAS;
    return P.cenarios.map(c => {
      const gcCaixa = c.gc * P.gcValor * (1 - P.gcDesconto);
      const gcNovo = gcCaixa * P.gcNovo * (1 - P.prodPct);
      const sobeValor = c.sobe * P.upsell * (1 - P.prodPct);
      const brindes = c.cartoes * (P.brindeB12.pct * P.brindeB12.custo + P.brindeCreme.pct * P.brindeCreme.custo);
      const custoCartoes = Math.ceil(c.cartoes / P.cartoesPack) * P.precoPack;
      const voltam = c.cartoes * P.voucher.pct * c.volta;
      const vouchers = voltam * P.voucher.novo * P.ticket * (1 - P.voucher.desconto - P.prodPct);
      const custo = brindes + custoCartoes;
      return { ...c, gcCaixa, gcNovo, sobeValor, brindes, custoCartoes, custo, voltam, vouchers, ganho: gcNovo + sobeValor + vouchers - custo };
    });
  }

  const soma = a => a.reduce((s, v) => s + v, 0);
  const despPlano = s => soma(ORC.map(l => (s.orc && s.orc[l.id] != null ? s.orc[l.id] : l.prop)));
  const despHoje = () => soma(ORC.map(l => l.hoje));
  const recReal = s => BASE.recBanco + (s.contarDinheiro ? BASE.dinheiroFora : 0);

  const prodPlano = s => (s.orc && s.orc.prod != null ? s.orc.prod : ORC.find(l => l.id === "prod").prop);

  function mesDoPlano(s, imposto = true, fator = 1) {
    const rec = recReal(s) * fator + s.receitaExtra;
    const desp = despPlano(s) + prodPlano(s) * (fator - 1) + s.receitaExtra * BASE.prodPct;
    const lucro = rec - desp;
    const imp = imposto ? Math.max(0, lucro) * BASE.imposto : 0;
    return { rec, desp, lucro, imposto: imp, retirada: s.retirada, sobra: lucro - imp - s.retirada };
  }

  // hoje: média abr–set/2026, com o que você usa hoje (retiradas + pessoal nos cartões + dinheiro vivo)
  function mesHoje(s) {
    const rec = recReal(s), desp = despHoje(), lucro = rec - desp;
    const voce = BASE.retiradaHoje + BASE.pessoalHoje + (s.contarDinheiro ? BASE.dinheiroFora : 0);
    return { rec, desp, lucro, imposto: 0, voce, sobra: lucro - voce };
  }

  function mesesAteCompra(s) {
    const out = []; let m = 11, y = 2026;
    while (y < s.compraAno || (y === s.compraAno && m <= s.compraMes)) {
      out.push([m, y]); m++; if (m === 13) { m = 1; y++; }
    }
    return out;
  }

  function poupanca(s) {
    const caixa = BASE.saldo6216 - BASE.reservaMin;           // negativo: falta completar a reserva
    let divida = BASE.divida6346, guard = s.dinheiroGuardado + caixa;
    const inicio = guard, linhas = [], meses = mesesAteCompra(s);
    const nPre = Math.min(3, meses.length);
    meses.forEach(([m, y], i) => {
      const s179 = s.s179 && y === s.compraAno;              // a dedução da máquina zera o imposto do ano da compra
      const fator = FATOR[m];
      const mp = mesDoPlano(s, !s179, fator);
      let p6 = 0;
      if (divida > 0.005) { p6 = Math.min(s.min6346 ? BASE.min6346 : 1000, divida); divida -= p6; }
      const pre = i >= meses.length - nPre ? s.prevenda / nPre : 0;
      const unico = UNICOS[`${y}-${String(m).padStart(2, "0")}`] || null;
      const pode = mp.sobra - p6 - (unico ? unico.valor : 0);  // o que o mês permite guardar
      const guardar = s.guardarAuto ? pode : s.guardarFixo;
      const folga = pode - guardar;
      const dep = guardar + pre + s.extraPessoal;
      guard += dep;
      linhas.push({ m, y, fator, rec: mp.rec, desp: mp.desp, retirada: mp.retirada, unico, sobra: mp.sobra, imposto: mp.imposto, s179, p6, pre, pode, guardar, folga, extra: s.extraPessoal, dep, guard });
    });
    const valor = s.valor, entrada = Math.min(valor, Math.max(0, guard));
    return { inicio, caixa, linhas, guardado: guard, entrada, cartao: valor - entrada, divida6346: Math.max(0, divida) };
  }

  function quitaCartao(saldo, s, d6) {
    const [preco, base] = CEN[s.cen];
    const fator = (1 - BASE.descPre) * BASE.sinalPre;
    let preValor = s.prevenda / fator, m = s.compraMes + 1, y = s.compraAno, k = 0, juros = 0, quitou = null;
    if (m === 13) { m = 1; y++; }
    const r = s.apr / 12, serie = [];
    while ((saldo > 0.005 || d6 > 0.005) && k < 120) {
      k++;
      const ses = base * SAZ[m], bruto = ses * preco;
      const usa = Math.min(preValor, bruto); preValor -= usa;
      let maq = (bruto - usa) + usa * (1 - BASE.descPre) * (1 - BASE.sinalPre) - BASE.manut;
      const s179 = s.s179 && y === s.compraAno;
      if (!s179) maq -= Math.max(0, maq) * BASE.imposto;
      const neg = mesDoPlano(s, !s179).sobra;
      const livre = maq + neg, j = saldo * r;
      juros += j;
      if (saldo > 0.005) {
        const p6 = Math.min(s.min6346 ? BASE.min6346 : 1000, d6);
        saldo = saldo + j - (livre - p6);
        if (saldo <= 0.005) { d6 = Math.max(0, d6 - p6 + saldo); saldo = 0; quitou = k; } else d6 -= p6;
      } else d6 -= livre;
      serie.push({ k, m, y, ses, maq, neg, livre, juros: j, saldo: Math.max(0, saldo), d6: Math.max(0, d6) });
      m++; if (m === 13) { m = 1; y++; }
    }
    const nunca = quitou === null || saldo > 0.005;
    const c = quitou ? serie[quitou - 1] : serie[serie.length - 1];
    const fim = serie[serie.length - 1];
    return { meses: nunca ? null : quitou, m: c && c.m, y: c && c.y, juros, serie, nunca,
             fimM: fim && fim.m, fimY: fim && fim.y };
  }

  function plano(s) {
    const p = poupanca(s);
    const q = p.cartao > 0.5 ? quitaCartao(p.cartao, s, p.divida6346) : null;
    return { p, q, mes: mesDoPlano(s, true), mes179: mesDoPlano(s, false), hoje: mesHoje(s) };
  }

  const Modelo = { BASE, ORC, SAZ, CEN, MES, FATOR, UNICOS, PADRAO, COFRINHO, NATAL_PREMISSAS, natal, plano, poupanca, quitaCartao, mesDoPlano, mesHoje, recReal, despPlano, despHoje };
  if (typeof module !== "undefined" && module.exports) module.exports = Modelo; else root.Modelo = Modelo;
})(typeof window !== "undefined" ? window : globalThis);
