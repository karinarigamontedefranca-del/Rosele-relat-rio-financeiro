# Painel financeiro: Rosele Aesthetics

Site privado com usuário e senha, numa página só (versão de 24/10/2026), escrito pela Karina para a Rosele:

1. **Seu negócio:** receita de verdade (banco + dinheiro vivo do Vagaro), formas de pagamento, serviços que mais faturam e "de cada $100".
2. **Máquina ou casa:** animação em 5 passos (juntar → comprar → a máquina paga o cartão → a casa).
3. **Como juntar:** os 4 potes do mês (clínica, impostos, você, máquina) e as regras.
4. **As economias:** cada corte revisado, com veredito; a Rosele pode editar os valores (fica salvo no navegador).
5. **Monte o seu plano:** controles + botão "Gerar meu plano" (pote, mês a mês, cartão zerando, passo a passo, salvar em PDF).
6. **Como fiz as contas** e 7. **Perguntas** (dúvidas comuns + perguntas para a Rosele responder e mandar pelo WhatsApp).

As contas ficam em `public/modelo.js` (mesma lógica de `_scripts_classificacao/modelo_poupanca_maquina.py`, com o dinheiro vivo, retirada de $5 mil e o orçamento revisado). Para conferir no terminal: `node -e "const M=require('./public/modelo.js'); console.log(M.plano(M.PADRAO).p)"`.
A versão anterior do site está em `D:\Rosele\_backup_site_public_2026-10-24b`.

## Pastas

```
site-dashboard/
  public/            ← o site em si (index.html, styles.css, app.js, modelo.js, data.js, vagaro.js)
  middleware.js      ← pede usuário e senha antes de abrir qualquer página (inclusive /api)
  api/estado.js      ← lê e grava no Supabase o que a Rosele muda (plano e respostas)
  supabase/schema.sql ← cria as tabelas no Supabase (rodar uma vez)
  package.json       ← dependência do middleware (@vercel/functions)
  vercel.json        ← diz ao Vercel para publicar a pasta public/
  scripts/build_data.py ← gera public/data.js a partir das planilhas
  scripts/build_vagaro_data.py ← gera public/vagaro.js a partir do CSV do Vagaro (D:\Roseleagaro)
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

## Salvar as mudanças da Rosele no Supabase

O que a Rosele muda no site (economias, controles do plano, "Gerar meu plano") e as respostas das perguntas ficam salvos no Supabase. Assim aparecem iguais em qualquer aparelho, e a Karina vê na hora. A chave do Supabase fica só no Vercel e nunca vai para o navegador.

1. Crie um projeto em supabase.com (o plano grátis basta).
2. No projeto: **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**. Isso cria duas tabelas: `site_estado`, com o valor atual, e `site_historico`, com cada gravação, para dar para voltar atrás.
3. Em **Project Settings → API Keys**, copie a **Project URL** e a **secret key** (ou a antiga `service_role`).
4. No Vercel: **Settings → Environment Variables**, crie:
   - `SUPABASE_URL` = a Project URL (ex.: `https://abcd1234.supabase.co`)
   - `SUPABASE_SECRET_KEY` = a secret key
5. Publique de novo: `npx vercel --prod`.

Para ver as respostas: no Supabase, **Table Editor → site_estado → linha `respostas`**. Elas também aparecem no próprio site, na seção Perguntas.

Se o Supabase não estiver configurado, ou se o site for aberto pelo `python -m http.server`, tudo continua funcionando e fica salvo só naquele navegador. Um aviso no canto da tela mostra onde foi salvo.

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
