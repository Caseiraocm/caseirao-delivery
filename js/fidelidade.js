(() => {
  const key = 'caseirao_fidelidade_wallet';
  let wallet;
  let selected;
  let config;
  let call;
  const claimRequests = new Map();
  const claimLabels = { pending:'Aguardando retirada', delivered:'Entregue', cancelled:'Cancelado' };
  const historyLabels = { resgate:'Resgate no pedido', estorno:'Estorno', ajuste:'Ajuste de saldo',
    brinde:'Resgate de brinde', devolucao:'Pontos devolvidos' };
  const pickupCode = id => id.slice(0,12).toUpperCase();

  function requestKey(wallet, gift) {
    const key = 'caseirao_claim_' + wallet + '_' + gift;
    let id = claimRequests.get(key);
    try { id ||= localStorage.getItem(key); } catch { /* Keep the request in memory. */ }
    id ||= crypto.randomUUID();
    claimRequests.set(key,id);
    try { localStorage.setItem(key,id); } catch { /* Keep the request in memory. */ }
    return { id, clear() {
      claimRequests.delete(key);
      try { localStorage.removeItem(key); } catch { /* Storage may be unavailable. */ }
    } };
  }

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
    if (!current) throw new Error('Permita armazenamento do site para usar o Clube Pontos.');
    const response = await call('caseirao-fidelidade', { action:'status', wallet:current });
    if (current !== code()) return status();
    config = response;
    return response;
  };

  const rewards = cfg => cfg.rewards ?? (cfg.reward ? [{ ...cfg.reward, goal:cfg.goal }] : []);
  const canRedeem = (cfg, reward) => cfg.active && reward.available && cfg.balance >= reward.goal;
  const seenKey = 'caseirao_points_receipts_seen';
  const seenReceipts = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(seenKey) || '[]');
    if (Array.isArray(saved)) saved.filter(id => typeof id === 'string').slice(-100).forEach(id => seenReceipts.add(id));
  } catch { /* The notice still works for the current visit. */ }

  function readWallet() {
    try {
      const current = wallet || localStorage.getItem(key);
      if (/^[0-9a-f]{64}$/.test(current || '')) return current;
    } catch { /* Tracking remains available without a points wallet. */ }
  }

  function openPointsReceipt(receipt) {
    if (document.querySelector('dialog[open]')) return false;
    const dialog = document.createElement('dialog');
    dialog.className = 'caseiraoPointsReceipt';
    dialog.setAttribute('aria-labelledby', 'pointsReceiptTitle');
    dialog.innerHTML = `
      <div class="pointsReceiptStar" aria-hidden="true">★</div>
      <p class="pointsReceiptClub">Clube Pontos</p>
      <h2 id="pointsReceiptTitle">Você ganhou <span data-receipt-earned></span> nessa compra!</h2>
      <p data-receipt-invite>Continue comprando e resgate seu brinde!</p>
      <div class="pointsReceiptBalance">
        <div><strong>Seu saldo</strong><strong data-receipt-balance></strong></div>
        <progress aria-label="Progresso para o brinde" hidden></progress>
        <p data-receipt-remaining hidden></p>
      </div>
      <form method="dialog"><button type="submit" value="close" autofocus>Continuar</button>
        <button type="submit" value="redeem" data-open-rewards hidden>Resgatar brinde</button></form>`;
    const find = selector => dialog.querySelector(selector);
    find('[data-receipt-earned]').textContent = '+' + points(receipt.earned);
    find('[data-receipt-invite]').hidden = !receipt.reward;
    find('[data-receipt-balance]').textContent = points(receipt.balance);
    if (receipt.reward) {
      const { name, goal } = receipt.reward;
      const missing = Math.max(0, goal - receipt.balance);
      const bar = find('progress');
      const remaining = find('[data-receipt-remaining]');
      const redeem = find('[data-open-rewards]');
      redeem.hidden = missing > 0;
      redeem.style.display = missing > 0 ? 'none' : '';
      bar.max = goal;
      bar.value = Math.min(receipt.balance, goal);
      bar.hidden = remaining.hidden = false;
      remaining.textContent = missing
        ? (missing === 1 ? 'Falta ' : 'Faltam ') + points(missing) + ' para resgatar ' + name + '.'
        : 'Você já pode resgatar ' + name + '.';
    }
    dialog.addEventListener('close', () => {
      const openRewards = dialog.returnValue === 'redeem';
      dialog.remove();
      if (openRewards) document.querySelector('#loyaltyBtn')?.click();
    }, { once:true });
    document.body.append(dialog);
    try { dialog.showModal(); }
    catch {
      dialog.remove();
      return false;
    }
    return true;
  }

  function showTrackingCredit(orderId, receipt, container) {
    const orderCard = container.querySelector('.trackCard');
    if (!orderCard) return;
    let note = orderCard.querySelector('.pointsTrackingNote');
    if (!Number.isSafeInteger(receipt?.earned) || receipt.earned <= 0) {
      note?.remove();
      return;
    }
    if (!note) {
      note = document.createElement('p');
      note.className = 'pointsTrackingNote';
      note.innerHTML = '<strong></strong><button type="button">Ver meus pontos</button>';
      const metrics = orderCard.querySelector('.trackMetrics');
      if (metrics) metrics.after(note);
      else orderCard.append(note);
    }
    const label = '★ +' + points(receipt.earned) + ' no Clube Pontos';
    if (note.firstElementChild.textContent !== label) note.firstElementChild.textContent = label;
    note.querySelector('button').onclick = () => openPointsReceipt(receipt);
    if (!seenReceipts.has(orderId) && openPointsReceipt(receipt)) {
      seenReceipts.add(orderId);
      if (seenReceipts.size > 100) seenReceipts.delete(seenReceipts.values().next().value);
      try { localStorage.setItem(seenKey, JSON.stringify([...seenReceipts])); } catch { /* Visit-only deduplication. */ }
    }
  }

  function updateCheckout(net) {
    const box = document.querySelector('#pointsCheckout');
    if (!box || !config) return;
    box.hidden = !config.active;
    if (!config.active) {
      selected = null;
      return;
    }
    const count = Math.floor(Math.max(0, Math.round(net() * 100)) / config.step_cents);
    const amount = box.querySelector('[data-estimated-points]');
    const hint = box.querySelector('[data-points-hint]');
    const label = count ? '+' + points(count) : 'Junte pontos';
    if (amount.textContent !== label) {
      amount.textContent = label;
      if (count && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        amount.animate?.([
          { transform:'scale(.88)' },
          { transform:'scale(1.08)', offset:.55 },
          { transform:'scale(1)' }
        ], { duration:460, easing:'ease-out' });
      }
    }
    const explanation = count
      ? 'Pontos previstos. Entram após o pagamento e a conclusão.'
      : 'Ganhe 1 ponto a cada ' + money(config.step_cents) + ' em produtos.';
    if (hint.textContent !== explanation) hint.textContent = explanation;
    const eligible = rewards(config).filter(reward => reward.kind !== 'physical' && canRedeem(config, reward));
    if (selected && !eligible.some(reward => reward.id === selected.reward && reward.goal === selected.goal)) {
      selected = null;
    }
    const choice = box.querySelector('select');
    const options = JSON.stringify(eligible.map(({ id, name, goal }) => [id, name, goal]));
    if (choice.dataset.options !== options) {
      choice.replaceChildren(new Option('Sem resgate', ''), ...eligible.map(reward =>
        new Option(reward.name + ' · ' + points(reward.goal), reward.id)));
      choice.dataset.options = options;
    }
    choice.value = selected?.reward || '';
    choice.closest('label').hidden = eligible.length === 0;
    choice.onchange = () => {
      const reward = eligible.find(item => item.id === choice.value);
      selected = reward ? { goal:reward.goal, reward:reward.id, name:reward.name } : null;
    };
  }

  window.caseiraoPoints = {
    async campaignActive() {
      return (await status()).active === true;
    },
    trackingWallet: readWallet,
    showTrackingCredit,
    checkout(send, net) {
      if (!send || !call) return;
      const box = document.createElement('section');
      box.id = 'pointsCheckout';
      box.className = 'pointsCheckout';
      box.hidden = true;
      box.innerHTML = `
        <div class="pointsEstimate">
          <span class="pointsEstimateIcon" aria-hidden="true">★</span>
          <div class="pointsEstimateCopy" aria-live="polite" aria-atomic="true">
            <span class="pointsEstimateName">Clube Pontos</span>
            <span data-estimated-points></span>
            <p data-points-hint></p>
          </div>
        </div>
        <label hidden>Brinde do Clube Pontos<select></select></label>`;
      const footer = send.closest('.checkoutFooter');
      if (footer) footer.prepend(box);
      else send.before(box);
      updateCheckout(net);
      status().then(() => updateCheckout(net)).catch(() => {});
    },
    estimate(net) { updateCheckout(net); },
    cart(list) {
      if (!list || !selected) return;
      const row = document.createElement('article');
      row.className = 'cartItem';
      const body = document.createElement('div');
      body.className = 'cartItemBody';
      const name = document.createElement('strong');
      name.textContent = selected.name;
      const detail = document.createElement('p');
      detail.textContent = 'Brinde · ' + points(selected.goal) + ' · R$ 0,00';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'cartRemove';
      remove.textContent = 'Remover brinde';
      remove.onclick = () => { selected = null; row.remove(); };
      body.append(name,detail,remove);
      row.append(body);
      list.append(row);
    },
    payload() {
      const current = code();
      return current ? { wallet:current, redeem:!!selected, goal:selected?.goal, reward:selected?.reward } : undefined;
    },
    clear() { selected = null; },
    bind(api, openCart) {
      call = api;
      const entry = document.querySelector('#loyaltyBtn');
      if (!entry) return;
      entry.onclick = () => {
        const dialog = document.createElement('dialog');
        dialog.className = 'caseiraoPoints';
        dialog.setAttribute('aria-labelledby','pointsTitle');
        dialog.innerHTML = `
          <header class="pointsHeader">
            <button type="button" data-exit aria-label="Voltar">←</button>
            <img src="./assets/caseirao-logo-petroleo.webp" alt="" width="221" height="145">
            <h2 id="pointsTitle">Clube Pontos</h2>
          </header>
          <div class="pointsContent">
            <p class="pointsNotice" data-message role="status">Consultando seus pontos…</p>
            <section class="pointsBalance" aria-labelledby="pointsBalanceTitle" hidden>
              <h3 id="pointsBalanceTitle">Seu saldo</h3>
              <p class="pointsTotal"><strong data-balance></strong> <span data-unit></span></p>
              <div class="pointsProgress">
                <progress aria-label="Progresso para o brinde" value="0"></progress>
                <span data-percent aria-hidden="true"></span>
              </div>
              <p data-remaining></p>
            </section>
            <section aria-label="Brindes do Clube Pontos" data-rewards></section>
            <template>
              <details class="pointsReward">
                <summary>
                  <img alt="" width="84" height="84" hidden>
                  <span><strong data-reward></strong><span class="pointsGoal" data-goal></span></span>
                </summary>
                <div class="pointsRewardAction">
                  <p class="pointsDescription" data-description hidden></p>
                  <p data-reward-status></p>
                  <button type="button" data-redeem hidden>Resgatar brinde</button>
                </div>
              </details>
            </template>
            <details class="pointsHistory" data-physical-claims hidden>
              <summary>Meus brindes solicitados</summary>
              <ul></ul>
            </details>
            <details class="pointsHistory" data-movements hidden>
              <summary>Histórico</summary>
              <p data-empty-history hidden>Seus pontos aparecem aqui quando o pedido for pago e concluído.</p>
              <ul></ul>
            </details>
            <details class="pointsOptions">
              <summary>Mais opções</summary>
              <div class="pointsCode">
                <label>Seu código pessoal<input type="password" spellcheck="false" autocomplete="off" maxlength="64"></label>
                <small>Para usar seu saldo em outro aparelho, copie o código e cole no outro aparelho.</small>
                <div><button type="button" data-copy>Copiar código</button><button type="button" data-load>Usar código</button></div>
              </div>
            </details>
          </div>
          <footer class="pointsFooter">
            <button type="button" class="pointsInvite" data-order>Fazer pedido <span aria-hidden="true">→</span></button>
            <p data-rule hidden></p>
          </footer>`;
        const find = selector => dialog.querySelector(selector);
        let submittingClaim = false;
        function show(cfg) {
          if (!dialog.open) return;
          announce(cfg.active ? '' : 'Campanha pausada. Seu saldo está guardado.');
          find('[data-balance]').textContent = cfg.balance.toLocaleString('pt-BR');
          find('[data-unit]').textContent = cfg.balance === 1 ? 'ponto' : 'pontos';
          find('.pointsBalance').hidden = false;
          const available = rewards(cfg);
          const target = available.find(reward => reward.available);
          const progress = find('progress');
          const progressNote = find('[data-remaining]');
          progress.parentElement.hidden = progressNote.hidden = !target;
          if (target) {
            const missing = Math.max(0, target.goal - cfg.balance);
            progress.max = target.goal;
            progress.value = Math.min(cfg.balance, target.goal);
            find('[data-percent]').textContent = Math.floor(progress.value * 100 / target.goal) + '%';
            progressNote.textContent = missing
              ? (missing === 1 ? 'Falta ' : 'Faltam ') + points(missing) + ' para resgatar ' + target.name + '.'
              : 'Você já tem pontos para resgatar ' + target.name + '.';
          }
          const rule = find('[data-rule]');
          rule.textContent = '1 ponto a cada ' + money(cfg.step_cents) + ' em produtos';
          rule.hidden = !cfg.active;
          const template = find('template');
          find('[data-rewards]').replaceChildren(...available.map(reward => {
            const section = template.content.firstElementChild.cloneNode(true);
            const get = selector => section.querySelector(selector);
            get('[data-reward]').textContent = reward.name;
            get('[data-goal]').textContent = points(reward.goal);
            const photo = get('img');
            if (reward.photo) {
              photo.hidden = false;
              photo.addEventListener('error', () => { photo.hidden = true; });
              photo.src = reward.photo;
            }
            const description = get('[data-description]');
            description.textContent = reward.description || '';
            description.hidden = !reward.description;
            const eligible = canRedeem(cfg, reward);
            const redeem = get('[data-redeem]');
            redeem.hidden = !eligible;
            redeem.textContent = reward.kind === 'physical' ? 'Solicitar ' + reward.name : 'Adicionar ao pedido';
            const rewardStatus = get('[data-reward-status]');
            rewardStatus.textContent = !cfg.active ? 'Os resgates estão pausados.'
              : !reward.available ? 'Brinde temporariamente indisponível.'
              : 'Junte ' + points(reward.goal) + (reward.kind === 'physical' ? ' para solicitar a retirada.' : ' para resgatar no seu pedido.');
            rewardStatus.hidden = eligible;
            section.open = eligible;
            redeem.onclick = async () => {
              if (reward.kind === 'physical') {
                if (submittingClaim || !confirm('Usar ' + points(reward.goal) + ' para solicitar ' + reward.name + '?')) return;
                const current = code();
                if (!current) return;
                const request = requestKey(current,reward.id);
                submittingClaim = true;
                redeem.disabled = true;
                announce('Enviando solicitação…');
                try {
                  const claim = await call('caseirao-fidelidade', {
                    action:'claim', wallet:current, id:request.id, gift:reward.id, goal:reward.goal,
                  });
                  request.clear();
                  if (!dialog.open || current !== code()) return;
                  const message = 'Solicitação registrada. Código de retirada: ' + pickupCode(claim.id) + '.';
                  announce(message);
                  try {
                    show(await status());
                    announce(message);
                    find('[data-physical-claims]').open = true;
                  } catch { /* Keep the confirmation visible if refreshing fails. */ }
                } catch (error) {
                  announce(error.message);
                } finally {
                  submittingClaim = false;
                  redeem.disabled = false;
                }
                return;
              }
              if (submittingClaim) return;
              selected = { goal:reward.goal, reward:reward.id, name:reward.name };
              dialog.close();
              openCart();
            };
            return section;
          }));
          const physical = find('[data-physical-claims]');
          const claims = cfg.claims || [];
          physical.hidden = !claims.length;
          physical.querySelector('ul').replaceChildren(...claims.map(claim => {
            const row = document.createElement('li');
            row.textContent = claim.gift_name + ' · ' + claimLabels[claim.status] + ' · ' + pickupCode(claim.id);
            return row;
          }));
          const movements = find('[data-movements]');
          movements.hidden = false;
          find('[data-empty-history]').hidden = cfg.history.length > 0;
          movements.querySelector('ul').replaceChildren(...cfg.history.map(entry => {
            const row = document.createElement('li');
            const value = document.createElement('strong');
            value.textContent = (entry.points > 0 ? '+' : '−') + points(Math.abs(entry.points));
            const kind = historyLabels[entry.kind] || 'Pedido';
            row.append(kind + (entry.order_number == null ? '' : ' #' + entry.order_number)
              + (entry.detail ? ' · ' + entry.detail : ''), value);
            return row;
          }));
        }
        function announce(message) {
          find('[data-message]').textContent = message;
        }
        function refresh() {
          status().then(show).catch(error => {
            if (dialog.open) announce(error.message);
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
            find('[data-message]').textContent = 'Confira o código do Clube Pontos.';
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
        dialog.addEventListener('close', () => dialog.remove(), { once:true });
        document.body.append(dialog);
        dialog.showModal();
        refresh();
      };
    },
  };
})();


