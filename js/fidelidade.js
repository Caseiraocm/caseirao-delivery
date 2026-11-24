(() => {
  const key = 'caseirao_fidelidade_wallet';
  let wallet;
  let selected;
  let config;
  let call;

  function code() {
    if (wallet) return wallet;
    try { wallet = localStorage.getItem(key); } catch { /* Checkout remains available. */ }
    if (!/^[0-9a-f]{64}$/.test(wallet || '')) {
      const random = [...crypto.getRandomValues(new Uint8Array(32))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(key, random); wallet = random; } catch { return null; }
    }
    return wallet;
  }

  const money = cents => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(cents / 100);
  const points = count => count + (count === 1 ? ' ponto' : ' pontos');
  const status = async () => {
    const current = code();
    if (!current) throw new Error('Permita armazenamento do site para usar a fidelidade.');
    const response = await call('caseirao-fidelidade', { action:'status', wallet:current });
    if (current !== code()) return status();
    config = response;
    return response;
  };

  function updateCheckout(net) {
    const box = document.querySelector('#pointsCheckout');
    if (!box || !config?.active) return;
    const count = Math.floor(Math.max(0, Math.round(net() * 100)) / config.step_cents);
    box.hidden = false;
    box.querySelector('p').textContent = count
      ? 'Este pedido pode render ' + points(count) + '.'
      : 'A cada ' + money(config.step_cents) + ' em produtos você ganha 1 ponto.';
    const button = box.querySelector('button');
    const reward = config.reward;
    const canRedeem = reward?.available && config.balance >= config.goal;
    if (selected && (!canRedeem || selected.goal !== config.goal || selected.reward !== reward.id)) selected = null;
    button.hidden = !canRedeem;
    button.textContent = selected ? 'Remover ' + reward.name + ' de brinde' : 'Resgatar ' + (reward?.name || 'brinde');
    button.onclick = () => {
      selected = selected ? null : { goal:config.goal, reward:reward.id };
      updateCheckout(net);
    };
  }

  window.caseiraoPoints = {
    checkout(send, net) {
      if (!send || !call) return;
      const box = document.createElement('section');
      box.id = 'pointsCheckout';
      box.className = 'pointsCheckout';
      box.hidden = true;
      box.innerHTML = '<p></p><button type="button" hidden></button>';
      send.closest('.checkoutFooter')?.before(box);
      if (!box.isConnected) send.before(box);
      updateCheckout(net);
      status().then(() => updateCheckout(net)).catch(() => {});
    },
    estimate(net) { updateCheckout(net); },
    payload() {
      const current = code();
      return current ? { wallet:current, redeem:!!selected, ...selected } : undefined;
    },
    clear() { selected = null; },
    bind(api, openCart) {
      call = api;
      const entry = document.querySelector('#loyaltyBtn');
      if (!entry) return;
      const openLegacy = entry.onclick;
      entry.onclick = () => {
        const dialog = document.createElement('dialog');
        dialog.className = 'caseiraoPoints';
        dialog.setAttribute('aria-labelledby','pointsTitle');
        dialog.innerHTML = `
          <header><button type="button" data-exit aria-label="Voltar">←</button><img src="./assets/caseirao-logo-petroleo.webp" alt="Caseirão Burger"></header>
          <h2 id="pointsTitle">Fidelidade Caseirão</h2><p>Peça pelo cardápio e ganhe pontos</p>
          <p data-message role="status">Consultando seus pontos…</p>
          <section class="pointsBalance" hidden><h3>Seu saldo</h3><p><strong data-balance></strong> pontos</p>
            <progress aria-label="Progresso para o brinde"></progress><p data-remaining></p></section>
          <section class="pointsReward" hidden><img alt="" hidden>
            <div><p>Seu próximo brinde</p><h3 data-reward></h3><p data-goal></p>
            <button type="button" data-redeem>Resgatar brinde</button></div></section>
          <button type="button" class="pointsInvite" data-order>Fazer pedido e ganhar pontos →</button><p data-rule></p>
          <section class="pointsHistory" hidden><h3>Últimos pontos</h3><ul></ul></section>
          <details><summary>Usar meus pontos em outro aparelho</summary>
            <label>Código pessoal da fidelidade<input type="password" spellcheck="false" autocomplete="off" maxlength="64"></label>
            <button type="button" data-copy>Copiar meu código</button><button type="button" data-load>Usar este código</button>
            <small>Guarde seu código e use apenas em aparelhos de confiança.</small></details>
          <button type="button" data-legacy>Consultar brindes da campanha anterior</button>`;
        const find = selector => dialog.querySelector(selector);
        function show(cfg) {
          if (!dialog.open) return;
          find('[data-message]').textContent = cfg.active ? '' : 'A campanha está pausada.';
          find('[data-balance]').textContent = cfg.balance;
          find('.pointsBalance').hidden = false;
          const progress = find('progress');
          progress.max = cfg.goal;
          requestAnimationFrame(() => { progress.value = Math.min(cfg.balance, cfg.goal); });
          const missing = Math.max(0,cfg.goal - cfg.balance);
          find('[data-remaining]').textContent = missing
            ? (missing === 1 ? 'Falta ' : 'Faltam ') + points(missing) + ' para o brinde'
            : 'Você atingiu a meta do brinde!';
          find('[data-rule]').textContent = '1 ponto a cada ' + money(cfg.step_cents) + ' em produtos pagos.';
          const reward = cfg.reward;
          const section = find('.pointsReward');
          section.hidden = !reward;
          if (reward) {
            find('[data-reward]').textContent = reward.name;
            find('[data-goal]').textContent = points(cfg.goal);
            const photo = section.querySelector('img');
            photo.hidden = !reward.photo;
            if (reward.photo) photo.src = reward.photo;
            const redeem = find('[data-redeem]');
            redeem.disabled = !cfg.active || !reward.available || missing > 0;
            redeem.textContent = (redeem.disabled ? '🔒 ' : '') + 'Resgatar ' + reward.name;
            redeem.onclick = () => {
              selected = { goal:cfg.goal, reward:reward.id };
              dialog.close();
              if (document.querySelector('#cartBtn')?.hasAttribute('data-empty')) {
                document.querySelector('#menuHeading')?.scrollIntoView({ block:'start' });
              } else openCart();
            };
          }
          find('.pointsHistory').hidden = !cfg.history.length;
          find('ul').replaceChildren(...cfg.history.map(entry => {
            const row = document.createElement('li');
            const value = document.createElement('strong');
            value.textContent = (entry.points > 0 ? '+' : '−') + points(Math.abs(entry.points));
            row.append((entry.kind === 'resgate' ? 'Resgate' : 'Pedido') + ' #' + entry.order_number, value);
            return row;
          }));
        }
        function refresh() {
          status().then(show).catch(error => {
            if (dialog.open) find('[data-message]').textContent = error.message;
          });
        }
        find('[data-exit]').onclick = () => dialog.close();
        find('[data-order]').onclick = () => {
          dialog.close();
          document.querySelector('#menuHeading')?.scrollIntoView({ block:'start' });
        };
        find('[data-copy]').onclick = async () => {
          const current = code();
          if (!current) return;
          try { await navigator.clipboard.writeText(current); find('[data-message]').textContent = 'Código copiado.'; }
          catch { find('input').type = 'text'; find('input').value = current; find('input').select(); }
        };
        find('[data-load]').onclick = () => {
          const input = find('input');
          const candidate = input.value.trim().toLowerCase();
          if (!/^[0-9a-f]{64}$/.test(candidate)) {
            find('[data-message]').textContent = 'Confira o código de fidelidade.';
            return;
          }
          try { localStorage.setItem(key, candidate); } catch {
            find('[data-message]').textContent = 'O navegador não conseguiu salvar o código.';
            return;
          }
          wallet = candidate;
          config = null;
          selected = null;
          input.value = '';
          find('[data-message]').textContent = 'Consultando seus pontos…';
          refresh();
        };
        find('[data-legacy]').onclick = () => { dialog.close(); openLegacy?.call(entry); };
        dialog.addEventListener('close', () => dialog.remove(), { once:true });
        document.body.append(dialog);
        dialog.showModal();
        refresh();
      };
    },
  };
})();
