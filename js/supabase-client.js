/* Cliente Supabase compartilhado por todas as páginas do site.
   Carregar SEMPRE depois do SDK (CDN) e antes de qualquer outro script
   que use window.BH.supabase.

   ⚠️ CONFIGURAÇÃO — cole aqui os dados do seu projeto Supabase:
   Dashboard → Project Settings → API. Passo a passo em supabase/README.md.

   A chave "anon" é pública por design (vai pro navegador de todo mundo);
   quem protege os dados são as policies de RLS no banco. NUNCA cole aqui
   a chave service_role. */
(function () {
  var SUPABASE_URL = 'COLE_A_PROJECT_URL_AQUI';
  var SUPABASE_ANON_KEY = 'COLE_A_ANON_KEY_AQUI';

  window.BH = window.BH || {};

  var configured = SUPABASE_URL.indexOf('http') === 0;
  if (!configured) {
    // Sem config o site continua funcionando no modo antigo (cardápio de
    // fallback + checkout só WhatsApp); os módulos checam BH.supabase.
    console.warn('[Garage] Supabase não configurado — veja supabase/README.md');
    window.BH.supabase = null;
    return;
  }

  window.BH.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
