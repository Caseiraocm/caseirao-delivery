(() => {
  'use strict';
  const marker = 'caseirao_card_session';
  const currency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const percent = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
  const money = cents => currency.format(cents/100);
  const due = value => value.split('-').reverse().join('/');
  const tokenPattern = /^[a-f0-9]{64}$/;
  let token = '';
  try { token = sessionStorage.getItem(marker)||''; } catch {}
  function remember(value){
    token=value;
    try { if(value)sessionStorage.setItem(marker,value); else sessionStorage.removeItem(marker); } catch {}
  }
  let openedByLink=false;
  const fragment=location.hash.slice(1);
  if(fragment.startsWith('cartao-caseirao=')){
    const code=fragment.slice('cartao-caseirao='.length).trim().toLowerCase();
    if(tokenPattern.test(code)){remember(code);openedByLink=true;}
    history.replaceState(history.state,'',location.pathname+location.search);
  }

  async function showAccount(dialog){
    const form=dialog.querySelector('form');
    const content=dialog.querySelector('[data-account]');
    const pilotNotice=dialog.querySelector('[data-card-pilot-notice]');
    const input=form.elements.namedItem('token');
    const feedback=dialog.querySelector('[role="status"]');
    async function load(code){
      feedback.textContent='Consultando…';
      try {
        const result=await fetch('https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/caseirao-card',{
          method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({action:'customer',payload:{token:code}})
        });
        if(!result.ok)throw new Error('Não foi possível abrir o cartão. Confira o código e tente novamente.');
        const card=await result.json();
        remember(code);
        form.hidden=true;
        pilotNotice.hidden=true;
        dialog.querySelector('[data-card-signout]').hidden=false;
        content.replaceChildren();
        const heading=document.createElement('h3');
        heading.textContent=card.name;
        const info=document.createElement('p');
        info.textContent=`Limite disponível ${money(card.available)} de ${money(card.credit_limit)}`;
        content.append(heading,info);
        if(!card.can_shop){
          const blocked=document.createElement('p');
          blocked.textContent='Cartão indisponível para novas compras. Consulte as faturas ou fale com a loja.';
          content.append(blocked);
        }
        const settled=new Map(card.payments.map(item=>[item.id,item]));
        const invoices=new Map();
        for(const charge of card.charges){
          const key=charge.payment_id||charge.due_date;
          if(charge.cancelled_at)continue;
          const entry=invoices.get(key)||{amount:0,principal:0,due:charge.due_date,orders:[]};
          entry.amount+=charge.principal+charge.interest;
          entry.principal+=charge.principal;
          entry.orders.push('#'+charge.order_number);
          invoices.set(key,entry);
        }
        for(const [key,bill] of invoices){
          const paid=settled.get(key);
          const row=document.createElement('p');
          const status=paid?'Paga':bill.due<card.today?'Vencida':'Em aberto';
          const total=paid?paid.amount:bill.amount;
          const interest=Math.max(0,total-bill.principal);
          row.textContent=`${status} · ${due(bill.due)} · ${money(total)} (juros ${money(interest)}) · pedidos ${bill.orders.join(', ')}`;
          content.append(row);
        }
        if(!invoices.size){
          const empty=document.createElement('p');empty.textContent='Nenhuma fatura registrada.';content.append(empty);
        }
        const cancelled=card.charges.filter(charge=>charge.cancelled_at);
        if(cancelled.length){
          const item=document.createElement('p');item.textContent='Compras estornadas · '+cancelled.map(charge=>'#'+charge.order_number).join(', ');content.append(item);
        }
        feedback.textContent='Pague a fatura com o Caseirão em dinheiro, maquininha ou Pix. Consulte a loja para quitação antecipada.';
      }catch(error){
        if(!form.hidden)pilotNotice.hidden=false;
        feedback.textContent=error.message;
      }
    }
    form.onsubmit=event=>{
      event.preventDefault();
      const code=input.value.trim().toLowerCase();
      if(tokenPattern.test(code))load(code);
      else feedback.textContent='Cole o código privado recebido do Caseirão.';
    };
    dialog.querySelector('[data-card-signout]').onclick=()=>{
      remember('');
      form.hidden=false;
      pilotNotice.hidden=false;
      dialog.querySelector('[data-card-signout]').hidden=true;
      input.value='';
      content.replaceChildren();
      feedback.textContent='';
      input.focus();
    };
    if(token)await load(token);
  }

  const requestMessage='Olá! Tenho interesse no Cartão Caseirão. Como faço para solicitar uma análise?';
  const whatsAppLink='https://wa.me/5586995653888?text='+encodeURIComponent(requestMessage);
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-labelledby','caseiraoCardHeading');
  dialog.className='caseiraoCardDialog';
  dialog.innerHTML=`<header><h2 id="caseiraoCardHeading">Meu Cartão Caseirão</h2><button type="button" data-card-close aria-label="Fechar">×</button></header>
    <section class="caseiraoCardPilotNotice" data-card-pilot-notice aria-labelledby="caseiraoCardPilotTitle">
      <h3 id="caseiraoCardPilotTitle">Cartão em fase de adaptação</h3>
      <p>Tem interesse no Cartão Caseirão? Fale com a gente pelo WhatsApp para solicitar o seu.</p>
      <p><strong>Nesta fase, a liberação do cartão depende da análise e da aprovação da administração.</strong></p>
      <a class="caseiraoCardContact" href="${whatsAppLink}" target="_blank" rel="noopener noreferrer">Solicitar análise pelo WhatsApp</a>
    </section>
    <form><label>Código privado do cartão<input required name="token" type="password" autocomplete="off" maxlength="64"></label><button class="primary">Acessar cartão</button></form>
    <div data-account></div><p role="status"></p><button type="button" data-card-signout hidden>Sair do cartão</button>`;
  document.body.append(dialog);
  dialog.querySelector('[data-card-close]').onclick=()=>dialog.close();
  const show=()=>{if(!dialog.open)dialog.showModal();showAccount(dialog);};
  document.getElementById('caseiraoCardHome').onclick=show;
  if(openedByLink)show();

  function describe(quote,breakdown,panel){
    const ratio=quote.total/quote.principal;
    const monthly=(ratio**(30/quote.days)-1)*100;
    const yearly=(ratio**(365/quote.days)-1)*100;
    const heading=document.createElement('h3');
    heading.textContent='Confira sua compra no Cartão Caseirão';
    const amounts=document.createElement('dl');
    function line(label,amount,emphasis=false){
      const row=document.createElement('div');
      if(emphasis)row.className='caseiraoCardAmountTotal';
      const name=document.createElement('dt');
      name.textContent=label;
      const value=document.createElement('dd');
      value.textContent=amount;
      row.append(name,value);
      amounts.append(row);
    }
    if(Number.isSafeInteger(breakdown?.products)){
      line('Produtos',money(breakdown.products));
      if(breakdown.delivery>0)line('Entrega',money(breakdown.delivery));
      if(breakdown.discount>0)line('Descontos','− '+money(breakdown.discount));
    }
    line('Total à vista',money(quote.principal));
    line(`Juros por ${quote.days} ${quote.days===1?'dia':'dias'}`,money(quote.interest));
    line('Total a pagar na fatura',money(quote.total),true);
    line('Vencimento',due(quote.due_date));
    panel.replaceChildren(heading,amounts);
    for(const text of [
      `Limite após a compra ${money(quote.remaining)}`,
      `Juros efetivos ${percent.format(monthly)}% ao mês · CET ${percent.format(yearly)}% ao ano`,
      'Credor: O Caseirão Burger · Av. Monsenhor Mateus, 340, Campo Maior–PI · caseiraopedidos.api.br',
      'Pagamento integral no vencimento. Antecipação reduz proporcionalmente os juros. Em atraso, novas compras ficam bloqueadas.'
    ]){
      const row=document.createElement('p');
      row.textContent=text;
      panel.append(row);
    }
    panel.hidden=false;
  }

  window.caseiraoCard={
    token:()=>token,
    mount(lookup){
      const payment=lookup('#payment');
      const cardOption=[...payment.options].find(option=>option.value==='Cartão Caseirão');
      cardOption.hidden=!token;
      cardOption.disabled=!token;
    },
    describe
  };
})();
