'use strict';

window.caseiraoCustomerSupport = (() => {
  const dialog = document.querySelector('#customerSupportDialog');
  const title = dialog.querySelector('h2');
  const messages = dialog.querySelector('.customerSupportMessages');
  const form = dialog.querySelector('form');
  const input = form.elements.message;
  const button = form.querySelector('button');
  const feedback = dialog.querySelector('[role="status"]');
  let conversation;
  let guestToken;

  function getGuestToken() {
    const key = 'caseirao_chat_guest_v1';
    if (guestToken) return guestToken;
    try { guestToken = localStorage.getItem(key); } catch {}
    if (!/^[a-f0-9]{64}$/.test(guestToken || '')) {
      guestToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte =>
        byte.toString(16).padStart(2, '0')).join('');
      try { localStorage.setItem(key, guestToken); } catch {}
    }
    return guestToken;
  }

  function showMessages(rows, current) {
    const latest = rows.at(-1)?.id || 0;
    if (current.latest === latest) return;
    const atBottom = current.latest == null || messages.scrollHeight - messages.scrollTop - messages.clientHeight < 65;
    current.latest = latest;
    if (!rows.length) {
      const hint = document.createElement('p');
      hint.className = 'supportEmpty';
      hint.textContent = 'Escreva sua dúvida para a equipe do Caseirão.';
      messages.replaceChildren(hint);
      return;
    }
    messages.replaceChildren(...rows.map(row => {
      const bubble = document.createElement('div');
      bubble.className = row.actor === 'customer' ? 'supportBubble outgoing' : 'supportBubble';
      const sender = document.createElement('strong');
      sender.textContent = row.actor === 'customer' ? 'Você' : 'Caseirão';
      const body = document.createElement('p');
      body.textContent = row.body;
      bubble.append(sender, body);
      return bubble;
    }));
    if (atBottom) messages.scrollTop = messages.scrollHeight;
  }

  async function sync(current, pending) {
    if (conversation !== current || !dialog.open) return;
    if (pending && current.reading) await current.reading;
    if (conversation !== current || !dialog.open || (!pending && (current.reading || current.sending))) return;
    async function run() {
      try {
        const result = await current.request('caseirao-chat', {
          action: pending ? 'customer_send' : 'customer_read', ...current.credentials,
          ...(pending ? {message:pending.body,request_id:pending.id} : {}),
        });
        if (conversation !== current || !dialog.open) return;
        showMessages(result.messages, current);
        if (pending) {
          if (input.value.trim() === pending.body) input.value = '';
          current.pending = null;
          messages.scrollTop = messages.scrollHeight;
        }
        if (pending || !current.pending) feedback.textContent = '';
      } catch (error) {
        if (conversation === current && dialog.open && (pending || current.latest == null)) {
          feedback.textContent = error.message || 'Falha no atendimento. Tente novamente.';
        }
      }
    }
    if (pending) return run();
    current.reading = run();
    try { await current.reading; } finally { current.reading = null; }
  }

  function open(request, order) {
    if (dialog.open) return;
    const credentials = order ? {tracking_code:order.code,phone:order.phone} : {guest_token:getGuestToken()};
    conversation = {request, credentials, latest:null};
    const current = conversation;
    title.textContent = order ? 'Atendimento · Pedido #' + order.number : 'Atendimento Caseirão';
    messages.textContent = 'Carregando conversa…';
    feedback.textContent = '';
    input.value = '';
    button.disabled = false;
    dialog.showModal();
    void sync(current);
    current.timer = setInterval(() => {
      if (!document.hidden) void sync(current);
    }, 4500);
  }

  dialog.querySelector('[data-chat-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    clearInterval(conversation?.timer);
    conversation = null;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const current = conversation;
    const body = input.value.trim();
    if (!current || !body || current.sending) return;
    if (current.pending?.body !== body) current.pending = {body,id:crypto.randomUUID()};
    current.sending = true;
    button.disabled = true;
    feedback.textContent = 'Enviando…';
    try { await sync(current,current.pending); }
    finally {
      if (conversation === current) {
        current.sending = false;
        button.disabled = false;
        input.focus();
      }
    }
  });

  function queueHtml(queue) {
    if (!queue) return '';
    if (!queue.grouped) return '<section class="customerQueue"><strong>Seu pedido está a caminho</strong></section>';
    const remaining = Math.min(29, Math.max(0, Number(queue.ahead) || 0));
    const complete = Math.min(29 - remaining, Math.max(0, Number(queue.completed) || 0));
    const text = remaining === 0 ? 'Seu pedido é o próximo da rota'
      : remaining === 1 ? '1 entrega antes da sua' : remaining + ' entregas antes da sua';
    const shownComplete = Math.min(complete, 2);
    const shownRemaining = Math.min(remaining, 4);
    const steps = [
      ...Array(shownComplete).fill('<span class="queueDot done">✓</span>'),
      ...Array.from({length:shownRemaining}, (_, index) =>
        '<span class="queueDot' + (index === 0 ? ' next' : '') + '"><svg viewBox="0 0 24 24"><path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></span>'),
      ...(remaining > shownRemaining ? ['<span class="queueDot">…</span>'] : []),
      '<span class="queueDot' + (!remaining ? ' next' : '') + '"><svg viewBox="0 0 24 24"><path d="m3 11 9-8 9 8M6 9v11h12V9m-8 11v-6h4v6"/></svg></span>',
    ];
    const destination = shownComplete;
    steps[destination] = '<span class="queueNextStep"><span class="queueBike">🛵</span>' + steps[destination] + '</span>';
    return '<section class="customerQueue" aria-label="Fila da entrega"><small>Fila da entrega</small><strong>' + text +
      '</strong><div class="queueStops" aria-hidden="true">' + steps.join('<span class="queueLine"></span>') +
      '</div><p>A fila atualiza a cada entrega concluída ou mudança na rota.</p></section>';
  }
  return {open,queueHtml};
})();
