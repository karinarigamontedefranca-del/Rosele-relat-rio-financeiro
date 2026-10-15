"""Gera public/data.js a partir dos relatórios finais (xlsx) da Rosele Aesthetics.

Para atualizar o site com dados novos:
  1. Ajuste FONTES (arquivo mais recente de cada conta) e ULTIMO_MES_COMPLETO.
  2. Rode:  python -I -X utf8 scripts/build_data.py
  3. Suba de novo no Vercel.
"""
import json, datetime, collections, pathlib, openpyxl

ROOT = pathlib.Path(r"D:/Rosele")
OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "data.js"

# conta -> (arquivo, aba, colunas: data, descrição, saída, entrada, fornecedor, categoria)
FONTES = {
    "6216": ("Cartão BUS COMPLETE CHK (6216)/BUS_COMPLETE_CHK_6216_relatorio_final_v6.xlsx", "Transações", (0, 1, 2, 3, 4, 5)),
    "Gold": ("Cartão Business Gold Card/Business_Gold_Card_1004_relatorio_final_v5.xlsx", "Transações", (0, 1, 2, 3, 4, 5)),
    "6346": ("Cartão R RIGAMONTE/R_RIGAMONTE_6346_relatorio_final_v3.xlsx", "Transações", (0, 1, 2, 3, 4, 5)),
    "2378": ("Cartão R RIGAMONTE/R_RIGAMONTE_2378_categorizado.xlsx", "Transações", (0, 1, 2, 3, 4, 6)),
}
NOME_CONTA = {
    "6216": "Conta corrente BUS COMPLETE CHK (6216)",
    "Gold": "Cartão Amex Business Gold (1004)",
    "6346": "Cartão Chase R. RIGAMONTE (6346)",
    "2378": "Cartão Chase R. RIGAMONTE (2378)",
}
ANO = 2026
ULTIMO_MES_COMPLETO = 9          # set/2026
PLANO = ROOT / "Planejamento_compra_maquina.xlsx"

# ---------- Subgrupos (o que aparece no site) ----------
# tipo: receita | fixa | variavel | eventual | fora (dinheiro que saiu para a dona) | ignorar (transferências)
SUBGRUPOS = {
    "Receita de clientes":           ("receita",  "Atendimentos (Vagaro, Square, Cherry, Zelle)"),
    "Aluguel":                       ("fixa",     "Aluguel da clínica (Luana)"),
    "Seguro":                        ("fixa",     "Seguro de responsabilidade (GoTo PremFin / Marine)"),
    "Internet e utilidades":         ("fixa",     "Optimum, coleta de lixo"),
    "Médica supervisora":            ("fixa",     "Dr. Ami — supervisão mensal"),
    "Software e assinaturas":        ("fixa",     "Vagaro, QuickBooks, Anthropic, HP"),
    "Parcelas de compras":           ("fixa",     "Citizens Pay e Apple Card (computadores)"),
    "Assistentes e prestadores":     ("variavel", "Alex, Alya, Yasmin, Flavia, Graziela…"),
    "Produtos aplicados (CMV)":      ("variavel", "Toxina, preenchedores, bioestimuladores, skincare profissional"),
    "Material de consumo":           ("variavel", "Amazon, descartáveis, limpeza e café da clínica"),
    "Anúncios":                      ("variavel", "Facebook/Instagram, gráfica"),
    "Cursos, clubes e mentorias":    ("variavel", "Aesthetic Social Club, Injector's Club, cursos"),
    "Escritório (compras avulsas)":  ("variavel", "Staples, Best Buy, Etsy, FedEx"),
    "Refeições":                     ("variavel", "Refeições de trabalho"),
    "Carro":                         ("variavel", "Combustível, Supercharger, pedágio, lava-rápido"),
    "Tarifas, doações e outros":     ("variavel", "Tarifas bancárias, multas, doações"),
    "Devoluções a clientes":         ("variavel", "Reembolsos a clientes"),
    "Reforma":                       ("eventual", "Obra e móveis da clínica"),
    "Viagens":                       ("eventual", "Brasil, St. Thomas, Charlotte"),
    "Faculdade (FNP)":               ("eventual", "Wilkes University"),
    "Equipamentos":                  ("eventual", "Caneta de microagulhamento DP Derm"),
    "Retiradas da Rosele":           ("fora",     "Zelle para você, conta pessoal, Amex pessoal"),
    "Gastos pessoais nos cartões":   ("fora",     "Compras pessoais pagas com cartão da empresa"),
}
CAT = {
    "Services": "Receita de clientes",
    "Building & land rent": "Aluguel",
    "Insurance": "Seguro",
    "Utilities": "Internet e utilidades",
    "Professional Services": "Cursos, clubes e mentorias",
    "Office expenses": "Escritório (compras avulsas)",
    "Contract labor": "Assistentes e prestadores",
    "Cost of goods sold:Direct supplies & materials": "Produtos aplicados (CMV)",
    "Supplies": "Material de consumo",
    "Advertising & marketing": "Anúncios",
    "Meals": "Refeições",
    "Uncategorized Expense": "Refeições",
    "Vehicle expenses": "Carro",
    "Vehicle expenses:Vehicle gas & fuel": "Carro",
    "Vehicle expenses:Parking & tolls": "Carro",
    "Vehicle expenses:Vehicle wash & road services": "Carro",
    "Other business expenses:Bank and credit card fees": "Tarifas, doações e outros",
    "Contributions to charities": "Tarifas, doações e outros",
    "Refunds & discounts to customers": "Devoluções a clientes",
    "Repairs & maintenance": "Reforma",
    "Travel": "Viagens",
    "Meals:Travel meals": "Viagens",
    "Tools, machinery, & equipment": "Equipamentos",
    "Owner draws": "Retiradas da Rosele",
    "Personal expenses": "Gastos pessoais nos cartões",
    "Personal healthcare": "Gastos pessoais nos cartões",
    "Personal healthcare:Health insurance premiums": "Gastos pessoais nos cartões",
}
FORNECEDOR = {  # exceções por fornecedor (vale mais que a categoria)
    "Dr Ami": "Médica supervisora",
    "Wilkes University": "Faculdade (FNP)",
    "Vagaro": "Software e assinaturas",
    "Anthropic": "Software e assinaturas",
    "QuickBooks Payments": "Software e assinaturas",
    "HP Instant Ink": "Software e assinaturas",
    "Citizens Pay": "Parcelas de compras",
    "Apple Card": "Parcelas de compras",
}


def num(v):
    return float(v) if isinstance(v, (int, float)) else 0.0


def subgrupo(cat, forn):
    cat = (cat or "").strip()
    if cat.startswith(("Match", "Transferência", "BUS COMPLETE CHK")):
        return None
    if forn in FORNECEDOR and cat not in ("Owner draws", "Personal expenses"):
        return FORNECEDOR[forn]
    if cat not in CAT:
        raise SystemExit(f"Categoria sem grupo: {cat!r} ({forn}) — inclua no dicionário CAT")
    return CAT[cat]


def ler_transacoes():
    rows = []
    for conta, (arq, aba, cols) in FONTES.items():
        ws = openpyxl.load_workbook(ROOT / arq, data_only=True, read_only=True)[aba]
        cd, cdesc, cs, ce, cf, cc = cols
        for r in list(ws.iter_rows(values_only=True))[1:]:
            if not isinstance(r[cd], datetime.datetime):
                continue
            forn = (r[cf] or "").strip() if isinstance(r[cf], str) else ""
            sg = subgrupo(r[cc], forn)
            if sg is None:
                continue
            saida, entrada = num(r[cs]), num(r[ce])
            # valor > 0 = dinheiro saindo; receita guardada como positivo
            valor = (entrada - saida) if sg == "Receita de clientes" else (saida - entrada)
            rows.append({
                "d": r[cd].strftime("%Y-%m-%d"), "c": conta, "desc": str(r[cdesc] or "").strip(),
                "f": forn or "(sem fornecedor)", "cat": str(r[cc]).strip(), "g": sg, "v": round(valor, 2),
            })
    rows.sort(key=lambda x: x["d"])
    return rows


def ler_plano():
    wb = openpyxl.load_workbook(PLANO, data_only=True, read_only=True)
    prem = {}
    for r in wb["Premissas"].iter_rows(min_row=4, values_only=True):
        if r[0] and isinstance(r[1], (int, float)):
            prem[r[0]] = r[1]
    def p(prefixo):
        for k, v in prem.items():
            if k.startswith(prefixo):
                return v
        raise SystemExit(f"Premissa não encontrada: {prefixo}")
    fixos_itens = {k: v for k, v in prem.items() if v and k.split(" (")[0] in (
        "Assistentes e prestadores", "Médica supervisora + cursos/clubes", "Anúncios", "Aluguel",
        "Escritório, software, computador", "Material de consumo", "Seguro", "Internet e utilidades",
        "Refeições", "Carro", "Tarifas, doações e outros")}
    return {
        "precoBRL": p("Preço da máquina (cenário 1)"), "cambio": p("Câmbio"),
        "salesTax": p("Sales tax"), "frete": p("Frete"),
        "receita": p("Receita média mensal"), "cmvPct": p("Custo dos produtos"),
        "custosFixos": p("TOTAL de custos fixos"), "viagens": p("Viagens (média"),
        "retirada": p("Retirada fixa"), "impostoPct": p("Reserva para impostos"),
        "reservaMeses": p("Reserva de emergência desejada"), "saldo": p("Saldo da conta BUS"),
        "divida6346": p("Dívida no cartão Ink"), "parcela6346": p("Pagamento mensal do cartão 6346"),
        "jurosFin": p("Juros — financiamento"), "jurosLeasing": p("Juros embutidos"),
        "jurosCartao": p("Juros do cartão"), "entradaPct": p("Entrada (opção C)"),
        "precoSessao": p("Preço cobrado por sessão"), "custoSessao": p("Custo direto por sessão"),
        "taxaCartao": p("Taxa de cartão"), "sessoesMeta": p("Sessões por mês"),
        "rampa1": p("Rampa: meses 1–3"), "rampa2": p("Rampa: meses 4–6"),
        "manutencao": p("Manutenção + seguro"), "canibalizacao": p("Canibalização"),
        "beneficio179": p("Economia de imposto"),
        "fixosItens": fixos_itens,
    }


def main():
    rows = ler_transacoes()
    meses = [f"{ANO}-{m:02d}" for m in range(1, ULTIMO_MES_COMPLETO + 1)]
    mensal = collections.defaultdict(lambda: collections.Counter())
    for r in rows:
        mensal[r["g"]][r["d"][:7]] += r["v"]
    por_mes = {g: [round(mensal[g][m], 2) for m in meses] for g in SUBGRUPOS}

    data = {
        "geradoEm": datetime.date.today().isoformat(),
        "periodo": {"inicio": rows[0]["d"], "fim": rows[-1]["d"], "meses": meses},
        "contas": NOME_CONTA,
        "subgrupos": [{"nome": k, "tipo": t, "exemplo": e} for k, (t, e) in SUBGRUPOS.items()],
        "porMes": por_mes,
        "transacoes": rows,
        "plano": ler_plano(),
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("window.DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")

    # conferência
    print(f"{len(rows)} transações ({data['periodo']['inicio']} a {data['periodo']['fim']}) -> {OUT}")
    for g in SUBGRUPOS:
        print(f"  {g:32s} {sum(por_mes[g]):>12,.2f}  {por_mes[g]}")


if __name__ == "__main__":
    main()
