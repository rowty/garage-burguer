/* Persistência do estoque no Supabase — substitui o antigo localStorage.

   O app.js mantém todo o estado em memória (state.insumos/produtos/log) e a
   lógica de negócio intacta. Este módulo só cuida do vai-e-vem com o banco:

   - loadAll()  → lê as 3 tabelas pro formato que o app já usa (boot e ao
     reabrir a aba, pra sincronizar PC × celular).
   - upsert/delete/insert → grava só a linha afetada a cada mutação.

   As escritas passam por uma FILA serial (uma de cada vez, na ordem), pra um
   pedido que mexe em vários insumos + registra a movimentação não embaralhar.
   Falha de escrita é registrada no console e disparada em onError (o app.js
   mostra um aviso), já que a mutação em memória é síncrona e a UI não espera. */
(function () {
  window.BH = window.BH || {};
  var sb = window.BH.supabase;

  var queue = Promise.resolve();
  var errorHandler = null;

  function check(res) {
    if (res && res.error) throw res.error;
    return res;
  }

  // Encadeia a operação na fila. O catch isola a falha (não trava as próximas)
  // e avisa o app; a fila sempre resolve pra whenIdle() não ficar preso.
  function enqueue(label, op) {
    queue = queue.then(op).catch(function (err) {
      console.error('[estoque] falha ao salvar (' + label + '):', err);
      if (errorHandler) errorHandler(err, label);
    });
    return queue;
  }

  function insumoRow(id, insumo) {
    return {
      id: id,
      nome: insumo.nome,
      unidade: insumo.unidade,
      custo: insumo.custo,
      estoque: insumo.estoque,
      minimo: insumo.minimo,
      updated_at: new Date().toISOString(),
    };
  }

  function produtoRow(id, produto) {
    return {
      id: id,
      nome: produto.nome,
      preco: produto.preco,
      ficha: produto.ficha,
      updated_at: new Date().toISOString(),
    };
  }

  window.BH.store = {
    disponivel: function () { return !!sb; },
    onError: function (cb) { errorHandler = cb; },
    // Promise que resolve quando a fila de escrita esvazia (usado antes de
    // reler do servidor, pra não sobrescrever uma gravação ainda em voo).
    whenIdle: function () { return queue; },

    upsertInsumo: function (id, insumo) {
      var row = insumoRow(id, insumo);
      return enqueue('insumo ' + id, function () {
        return sb.from('insumos').upsert(row).then(check);
      });
    },

    deleteInsumo: function (id) {
      return enqueue('remover insumo ' + id, function () {
        return sb.from('insumos').delete().eq('id', id).then(check);
      });
    },

    upsertProduto: function (id, produto) {
      var row = produtoRow(id, produto);
      return enqueue('produto ' + id, function () {
        return sb.from('produtos').upsert(row).then(check);
      });
    },

    deleteProduto: function (id) {
      return enqueue('remover produto ' + id, function () {
        return sb.from('produtos').delete().eq('id', id).then(check);
      });
    },

    insertMovimentacao: function (entry) {
      var row = {
        tipo: entry.tipo,
        texto: entry.texto,
        detalhes: entry.detalhes || null,
        valor: entry.valor,
        custo: entry.custo != null ? entry.custo : null,
        criado_em: entry.data,
      };
      return enqueue('movimentação', function () {
        return sb.from('movimentacoes').insert(row).then(check);
      });
    },

    // Lê as 3 tabelas e devolve no mesmo formato do state em memória.
    loadAll: function () {
      return Promise.all([
        sb.from('insumos').select('*'),
        sb.from('produtos').select('*'),
        sb.from('movimentacoes').select('*').order('criado_em', { ascending: false }).limit(1000),
      ]).then(function (res) {
        res.forEach(check);

        var insumos = {};
        res[0].data.forEach(function (r) {
          insumos[r.id] = {
            nome: r.nome,
            unidade: r.unidade,
            custo: Number(r.custo),
            estoque: Number(r.estoque),
            minimo: Number(r.minimo),
          };
        });

        var produtos = {};
        res[1].data.forEach(function (r) {
          produtos[r.id] = {
            nome: r.nome,
            preco: r.preco != null ? Number(r.preco) : null,
            ficha: r.ficha || [],
          };
        });

        var log = res[2].data.map(function (r) {
          var e = { tipo: r.tipo, texto: r.texto, valor: Number(r.valor), data: r.criado_em };
          if (r.detalhes) e.detalhes = r.detalhes;
          if (r.custo != null) e.custo = Number(r.custo);
          return e;
        });

        return { insumos: insumos, produtos: produtos, log: log };
      });
    },

    // Resetar demo: apaga tudo e regrava os seeds (SEED_INSUMOS/SEED_PRODUTOS).
    reseed: function (seedInsumos, seedProdutos) {
      return enqueue('resetar', function () {
        return sb.from('movimentacoes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
          .then(function () { return sb.from('produtos').delete().neq('id', '__nunca__'); })
          .then(function () { return sb.from('insumos').delete().neq('id', '__nunca__'); })
          .then(function () {
            var rows = Object.keys(seedInsumos).map(function (id) { return insumoRow(id, seedInsumos[id]); });
            return sb.from('insumos').insert(rows).then(check);
          })
          .then(function () {
            var rows = Object.keys(seedProdutos).map(function (id) { return produtoRow(id, seedProdutos[id]); });
            return sb.from('produtos').insert(rows).then(check);
          });
      });
    },
  };
})();
