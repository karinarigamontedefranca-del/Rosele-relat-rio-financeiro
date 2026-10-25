"""Gera public/vagaro.js: pagamentos do Vagaro por mês e forma de pagamento + serviços de 2026.

Fonte: D:\\Rosele\\vagaro\\vagaro_transacoes_abr2025_out2026.csv (Transaction List lida em 24/10/2026)
e os depósitos em dinheiro (ATM) que já estão em public/data.js.
Rodar: python -I -X utf8 scripts/build_vagaro_data.py
"""
import csv, re, json, collections, datetime as dt
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(r"D:\Rosele\vagaro\vagaro_transacoes_abr2025_out2026.csv")
OUT = ROOT / "public" / "vagaro.js"


def n(s):
    s = (s or "").replace("$", "").replace("\xa0", "").replace(" ", "")
    if s in ("", "-", "--"): return 0.0
    neg = s.startswith("(") or s.startswith("-")
    v = float(s.strip("()-").replace(".", "").replace(",", "."))
    return -v if neg else v


s = (ROOT / "public" / "data.js").read_text(encoding="utf-8")
D = json.loads(s[s.index("{"):s.rindex("}") + 1])
atm = collections.Counter()
for t in D["transacoes"]:
    if t["g"] == "Receita de clientes" and "ATM" in t["desc"]:
        atm[t["d"][:7]] += t["v"]

mes = collections.defaultdict(collections.Counter)
serv = collections.defaultdict(lambda: [0, 0.0])
for r in csv.DictReader(SRC.open(encoding="utf-8-sig")):
    d = dt.datetime.strptime(re.match(r"(\w+ \d+, \d{4})", r["Checkout"]).group(1), "%b %d, %Y")
    k = f"{d.year}-{d.month:02d}"
    sg = -1 if n(r["AmtPaid"]) < 0 else 1           # reembolso: formas de pagamento vêm sem sinal
    mes[k]["dinheiro"] += sg * abs(n(r["Cash"]))
    mes[k]["cartao"] += sg * abs(n(r["CC"]))
    mes[k]["outros"] += sg * (abs(n(r["Others"])) + abs(n(r["BNPL"])) + abs(n(r["Check"])) + abs(n(r["BankAccount"])))
    if dt.datetime(2026, 1, 1) <= d < dt.datetime(2026, 10, 1):
        item = re.sub(r"\s*Rosele Rigamonte\s*$", "", r["ItemSoldBy"]).strip()
        v = n(r["AmtPaid"])
        if v and "Credit Card Fee" not in item and not item.startswith(("IOU", "Refund")):
            serv[item][0] += sg; serv[item][1] += v

meses = [m for m in sorted(mes) if m >= "2026-01"]
out = {
    "fonte": "Vagaro, Transaction List (lida em 24/10/2026)",
    "meses": meses,
    "dinheiro": [round(mes[m]["dinheiro"], 2) for m in meses],
    "cartao": [round(mes[m]["cartao"], 2) for m in meses],
    "outros": [round(mes[m]["outros"], 2) for m in meses],
    "depositadoATM": [round(atm.get(m, 0), 2) for m in meses],
    "servicos": [{"nome": k, "qtd": q, "valor": round(v, 2)}
                 for k, (q, v) in sorted(serv.items(), key=lambda x: -x[1][1]) if q > 0 and v > 0][:8],
}
OUT.write_text("window.VAGARO = " + json.dumps(out, ensure_ascii=False) + ";\n", encoding="utf-8")
print("ok", OUT)
for m, a, b, c, e in zip(meses, out["dinheiro"], out["cartao"], out["outros"], out["depositadoATM"]):
    print(m, round(a), round(b), round(c), "ATM", round(e))
print([(x["nome"], x["qtd"], round(x["valor"])) for x in out["servicos"]])
