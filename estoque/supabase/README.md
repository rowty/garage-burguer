# Estoque no Supabase — o que fazer

O painel de estoque agora guarda tudo no **Supabase** (mesmo projeto do site),
então PC e celular veem e editam o mesmo estoque. Só falta um passo manual seu.

## Passo único: rodar o schema

1. Abre o **Supabase Dashboard** do projeto do site Garage Burger
   (`ztbttzytysafdalpcdxu`) → menu **SQL Editor** → **New query**.
2. Cola o conteúdo inteiro de [`schema.sql`](schema.sql) e clica **Run**.

Pronto. Isso cria 3 tabelas (`insumos`, `produtos`, `movimentacoes`), liga a
segurança (só dono acessa) e já popula os insumos e as fichas técnicas.

- **Não** precisa criar projeto novo nem colar chave — é a mesma do site, já
  configurada em `estoque/js/supabase-client.js`.
- **Não** precisa criar login novo — o estoque usa a conta que já é dona
  (pedrolinkdiniz@gmail.com). Qualquer conta sem `is_owner` é barrada.
- Rodar de novo é seguro: as tabelas usam `if not exists` e o seed usa
  `on conflict do nothing` (não sobrescreve o que você já editou no painel).

## Como funciona depois disso

- **Login:** abre o painel → entra com o e-mail e senha de dono do site.
- **Sincronização:** cada venda/entrada/perda/cadastro grava na hora no
  Supabase. Ao **reabrir a aba** (ou voltar pra ela), o painel relê do
  servidor — é assim que o que você fez no PC aparece no celular e vice-versa.
- **Resetar demo** (aba Histórico) agora apaga os dados no Supabase e regrava
  os valores iniciais — use com cuidado, afeta todos os aparelhos.

## Estrutura das tabelas

| Tabela | Guarda | Observação |
| --- | --- | --- |
| `insumos` | matéria-prima (pão, carne…) | `id` texto, custo/estoque/mínimo |
| `produtos` | fichas técnicas (receitas) | `ficha` em `jsonb`, `preco` null = item interno |
| `movimentacoes` | histórico de venda/entrada/perda | `criado_em` ordena, mais novo primeiro |

Todas com RLS exigindo `is_owner()` pra ler e escrever — nada é público.
