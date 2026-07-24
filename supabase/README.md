# Setup do Supabase — Garage Burger

Passo a passo pra ligar o login, o cardápio editável e o painel do dono no
site. Leva uns 15 minutos, feito uma vez só.

## 1. Criar o projeto

1. Crie uma conta em [supabase.com](https://supabase.com) (dá pra entrar
   com GitHub).
2. "New project" → escolha um nome (ex: `garage-burger`) → região
   **South America (São Paulo)** → defina uma senha de banco (guarde essa
   senha em local seguro, não precisa dela no dia a dia).
3. Espere o projeto terminar de provisionar (1-2 minutos).

## 2. Rodar os SQLs (nessa ordem)

No menu lateral, abra **SQL Editor** → **New query**. Para cada arquivo
abaixo: abra, copie tudo, cole no editor e clique **Run**.

1. `schema.sql` — cria as tabelas, funções, segurança (RLS) e já popula o
   cardápio atual do Garage.
2. `login-telefone.sql` — permite login pelo número de celular.
3. `storage.sql` — cria o cofre de imagens pro painel do dono enviar fotos.

Confira em **Table Editor** se as tabelas apareceram e se `menu_items` já
tem os itens do cardápio.

## 3. Pegar as chaves e me mandar

1. **Project Settings** (ícone de engrenagem) → **API**.
2. Copie **Project URL** e a chave **anon / public** (NÃO é a `service_role`
   — essa nunca vai pro site).
3. Me manda as duas aqui no chat que eu colo no site (`js/supabase-client.js`)
   e publico.

> A chave anon é pública por design (vai pro navegador de todo mundo); quem
> protege os dados são as regras de RLS no banco. Pode mandar sem medo.

## 4. Virar dono da própria conta

1. Com o site publicado, cadastre-se normalmente finalizando um pedido (crie
   uma senha). Uma conta pra você, outra pro seu sócio se for o caso.
2. No Supabase, **SQL Editor** → **New query**, rode (trocando o e-mail, ou
   o celular se você cadastrou só com número):

```sql
-- por e-mail:
update profiles set is_owner = true
where id = (select id from auth.users where email = 'seu-email@exemplo.com');

-- ou por celular (troque pelos seus dígitos, com DDD):
update profiles set is_owner = true
where id = (select id from auth.users where email = 'cel5571999999999@garage-cliente.com');
```

3. Faça login de novo no site — o link **Painel** (acesso ao `/admin`) deve
   aparecer no menu de conta.

## 5. Opcional — cadastro sem confirmação de e-mail

Por padrão o Supabase exige confirmar o e-mail antes do primeiro login. Pra
clientes locais isso pode ser fricção demais. Se quiser simplificar:
**Authentication** → **Providers** → **Email** → desative "Confirm email".

## Se algo der errado

- Testar leitura pública do cardápio: no console do navegador (F12) em
  qualquer página do site, rode
  `window.BH.supabase.from('menu_items').select('*').then(console.log)` — deve
  devolver a lista de itens.
- Se `admin.html` não deixar entrar mesmo depois do passo 4: confira se o
  e-mail no UPDATE bate exatamente com o usado no cadastro, e se você
  deslogou/logou de novo depois do UPDATE (a sessão não atualiza sozinha).
