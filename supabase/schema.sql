-- Rode uma vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Guarda o que a Rosele muda no site: o plano (economias, controles) e as respostas das perguntas.

create table if not exists public.site_estado (
  chave        text primary key,              -- 'plano' ou 'respostas'
  valor        jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- Histórico: cada gravação fica guardada, para dar para ver o que mudou e voltar atrás.
create table if not exists public.site_historico (
  id           bigint generated always as identity primary key,
  chave        text not null,
  valor        jsonb not null,
  gravado_em   timestamptz not null default now()
);

-- RLS ligado e nenhuma policy: o navegador (chave pública) não lê nem grava nada.
-- Só a função do Vercel (api/estado.js), com a chave secreta, acessa as tabelas.
alter table public.site_estado enable row level security;
alter table public.site_historico enable row level security;
