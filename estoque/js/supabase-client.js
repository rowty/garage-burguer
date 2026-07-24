/* Cliente Supabase do painel de estoque.
   Carregar SEMPRE depois do SDK (CDN) e antes de store.js / app.js.

   Mesmo projeto e mesma chave publishable do site (js/supabase-client.js).
   A chave é pública por design (vai pro navegador); quem protege os dados são
   as policies de RLS — no estoque, tudo exige is_owner(). NUNCA cole aqui a
   chave service_role. */
(function () {
  var SUPABASE_URL = 'https://ztbttzytysafdalpcdxu.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_NwKoj0so4JdsyoDaWKUdpA_cHY5y89N';

  window.BH = window.BH || {};

  var configured = SUPABASE_URL.indexOf('http') === 0;
  if (!configured || !window.supabase) {
    console.warn('[estoque] Supabase não configurado — veja estoque/supabase/README.md');
    window.BH.supabase = null;
    return;
  }

  window.BH.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
