# Painel financeiro: Rosele Aesthetics

Site privado com usuário e senha, com 4 abas:

- **Visão geral:** receita, lucro, para onde foi cada US$ 100, maiores fornecedores e totais por conta.
- **Fixas × variáveis:** arraste os itens entre as colunas para recalcular o ponto de equilíbrio.
- **A máquina:** simulador de compra com 5 formas de pagamento, linha do tempo, cofrinho e sessões por mês.
- **Lançamentos:** as 857 transações, com busca e filtros.

Os pontos de atenção para o contador ficaram fora do site, numa imagem: `D:\Rosele\Pontos_de_atencao.png`.

## Pastas

```
site-dashboard/
  public/            ← o site em si (index.html, styles.css, app.js, data.js)
  middleware.js      ← pede usuário e senha antes de abrir qualquer página
  package.json       ← dependência do middleware (@vercel/functions)
  vercel.json        ← diz ao Vercel para publicar a pasta public/
  scripts/build_data.py ← gera public/data.js a partir das planilhas
```

## Publicar no Vercel (primeira vez)

**Opção A: pelo terminal (mais rápido)**
1. Na pasta `D:\Rosele\site-dashboard`, rode `npx vercel` e responda às perguntas. Escolha "No" para "link to existing project" e mantenha as configurações padrão.
2. No painel do Vercel: **Settings → Environment Variables**. Crie:
   - `SITE_USER` = o usuário (ex.: `rosele`)
   - `SITE_PASSWORD` = uma senha forte
3. Rode `npx vercel --prod` para publicar já com a senha.

**Opção B: pelo GitHub**
1. Crie um repositório **privado** no GitHub e suba o conteúdo de `site-dashboard`.
2. No Vercel: **Add New → Project → Import** o repositório. Em Framework Preset escolha **Other**.
3. Antes de clicar em Deploy, abra **Environment Variables** e crie `SITE_USER` e `SITE_PASSWORD`.

Sem essas duas variáveis, o site responde "Site bloqueado" para todo mundo, de propósito.

Para trocar a senha: mude `SITE_PASSWORD` no Vercel e faça um novo deploy (Deployments → ⋯ → Redeploy).

## Atualizar com dados novos

1. Gere os relatórios novos (xlsx) das contas.
2. Em `scripts/build_data.py`, aponte `FONTES` para os arquivos mais recentes e ajuste `ULTIMO_MES_COMPLETO`.
3. Se a planilha `Planejamento_compra_maquina.xlsx` mudar, o script lê as premissas dela automaticamente.
4. Rode `python -I -X utf8 scripts/build_data.py` (ele mostra os totais por grupo para conferência).
5. Publique de novo (`npx vercel --prod` ou um push no GitHub).

Se aparecer uma categoria nova do QuickBooks, o script para e avisa. Basta incluir a categoria no dicionário `CAT`.

## Testar no computador

```
cd public
python -m http.server 5178
```
Depois abra http://127.0.0.1:5178. Localmente não há senha: ela só funciona no Vercel.
