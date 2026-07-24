/* Autenticação (Supabase Auth): login, cadastro, logout e estado de sessão.
   Expõe window.BH.auth pros outros módulos e dispara o evento
   'bh:auth-change' no documento sempre que o usuário loga/desloga ou o
   perfil é recarregado. */
(function () {
  var sb = window.BH ? window.BH.supabase : null;

  var currentUser = null;
  var currentProfile = null;

  var trigger = document.getElementById('account-trigger');
  var modal = document.getElementById('auth-modal');
  var overlay = document.getElementById('auth-modal-overlay');
  var closeBtn = document.getElementById('auth-modal-close');
  var formLogin = document.getElementById('auth-form-login');
  var errorEl = document.getElementById('auth-error');

  window.BH = window.BH || {};
  window.BH.auth = {
    getUser: function () { return currentUser; },
    getProfile: function () { return currentProfile; },
    isOwner: function () { return !!(currentProfile && currentProfile.is_owner); },
    refreshProfile: refreshProfile,
    openModal: openModal,
    signOut: function () {
      if (sb) sb.auth.signOut();
    },
    // Cria a conta do cliente no primeiro pedido (chamado pelo checkout do
    // cart.js). Não existe cadastro avulso: a conta só nasce por aqui.
    // Devolve { ok, jaExiste, error }.
    signUpAtCheckout: function (opts) {
      if (!sb) return Promise.resolve({ ok: false });
      var digits = onlyDigits(opts.phone);
      var authEmail = (opts.email && opts.email.trim()) || syntheticEmail(digits);
      return sb.auth.signUp({
        email: authEmail,
        password: opts.password,
        options: { data: { full_name: opts.name, phone: digits } }
      }).then(function (res) {
        if (res.error) {
          var jaExiste = /already registered/i.test(res.error.message || '');
          return { ok: false, jaExiste: jaExiste, error: res.error };
        }
        return { ok: true };
      });
    }
  };

  if (!sb) {
    // Sem Supabase configurado o botão de conta nem aparece.
    if (trigger) trigger.style.display = 'none';
    return;
  }

  function emitChange() {
    document.dispatchEvent(new CustomEvent('bh:auth-change'));
  }

  function firstName(profile, user) {
    var name = (profile && profile.full_name) || (user && user.email) || '';
    return name.split(/[\s@]/)[0];
  }

  function updateTrigger() {
    if (!trigger) return;
    if (currentUser) {
      trigger.textContent = '👤 ' + (firstName(currentProfile, currentUser) || 'Minha conta');
      trigger.classList.add('is-logged');
    } else {
      trigger.textContent = 'ENTRAR';
      trigger.classList.remove('is-logged');
    }
  }

  function refreshProfile() {
    if (!currentUser) {
      currentProfile = null;
      updateTrigger();
      emitChange();
      return Promise.resolve(null);
    }
    return sb.from('profiles').select('*').eq('id', currentUser.id).single().then(function (res) {
      currentProfile = res.data || null;
      updateTrigger();
      emitChange();
      return currentProfile;
    });
  }

  function openModal() {
    if (!modal) return;
    showError('');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function showError(message) {
    if (errorEl) errorEl.textContent = message || '';
  }

  // Traduz os erros mais comuns do Supabase Auth pro cliente final.
  function friendlyError(error) {
    var msg = (error && error.message) || '';
    if (/invalid login credentials/i.test(msg)) return 'E-mail, celular ou senha incorretos.';
    if (/already registered/i.test(msg)) return 'Esse e-mail ou celular já tem cadastro. Faça login.';
    if (/at least 6 characters/i.test(msg)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/valid email/i.test(msg)) return 'Digite um e-mail válido.';
    if (/rate limit/i.test(msg)) return 'Muitas tentativas. Espera um pouquinho e tenta de novo.';
    return 'Não deu certo: ' + msg;
  }

  // Só os dígitos do celular (tira parênteses, traços, espaços).
  function onlyDigits(value) {
    return (value || '').replace(/\D/g, '');
  }

  // Quem se cadastra sem e-mail ganha esse e-mail interno automático, que o
  // Supabase usa como login. Nenhum e-mail é enviado pra ele.
  function syntheticEmail(digits) {
    return 'cel' + digits + '@garage-cliente.com';
  }

  // Descobre o e-mail de login a partir do que a pessoa digitou (e-mail ou
  // celular). Se for celular, pergunta ao banco qual conta tem aquele número.
  function resolveLoginEmail(identifier) {
    if (identifier.indexOf('@') !== -1) return Promise.resolve(identifier);
    var digits = onlyDigits(identifier);
    if (!digits) return Promise.resolve(null);
    return sb.rpc('email_do_telefone', { p_phone: digits }).then(function (res) {
      if (res.error) {
        console.warn('[Garage] Falha ao resolver login por celular:', res.error);
        return null;
      }
      return res.data || null;
    });
  }

  if (trigger) {
    trigger.addEventListener('click', function () {
      if (currentUser) {
        // Logado: abre o painel "Minha conta" (account.js).
        if (window.BH.account) window.BH.account.open();
      } else {
        openModal();
      }
    });
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (overlay) overlay.addEventListener('click', closeModal);

  if (formLogin) {
    formLogin.addEventListener('submit', function (event) {
      event.preventDefault();
      showError('');
      var identifier = document.getElementById('auth-login-id').value.trim();
      var password = document.getElementById('auth-login-password').value;
      resolveLoginEmail(identifier).then(function (authEmail) {
        if (!authEmail) {
          showError('Conta não encontrada. Confira o e-mail ou o celular.');
          return;
        }
        return sb.auth.signInWithPassword({ email: authEmail, password: password }).then(function (res) {
          if (res.error) {
            showError(friendlyError(res.error));
            return;
          }
          closeModal();
        });
      }).catch(function (err) {
        showError('Erro ao entrar: ' + (err.message || err));
      });
    });
  }

  sb.auth.onAuthStateChange(function (_event, session) {
    currentUser = session ? session.user : null;
    refreshProfile();
  });

  sb.auth.getSession().then(function (res) {
    currentUser = res.data.session ? res.data.session.user : null;
    refreshProfile();
  });
})();
