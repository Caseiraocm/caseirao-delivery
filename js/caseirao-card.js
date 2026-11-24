(() => {
  'use strict';
  const marker = 'caseirao_card_session';
  const currency = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const percent = new Intl.NumberFormat('pt-BR',{maximumFractionDigits:4});
  const money = cents => currency.format(cents/100);
  const due = value => value.split('-').reverse().join('/');
  const tokenPattern = /^[a-f0-9]{64}$/;
  const shortCodePattern = /^\d{8,10}$/;
  let token = '';
  try { token = sessionStorage.getItem(marker)||''; } catch {}
  function remember(value){
    token=value;
    try { if(value)sessionStorage.setItem(marker,value); else sessionStorage.removeItem(marker); } catch {}
  }
  const cardEndpoint='https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/caseirao-card';
  let openedByLink=false;
  let requestedDue='';
  async function requestCard(payload){
    const result=await fetch(cardEndpoint,{
      method:'POST',cache:'no-store',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(payload)
    });
    return {result,card:await result.json()};
  }

  const fragment=location.hash.slice(1);
  if(fragment.startsWith('cartao-caseirao=')){
    const code=fragment.slice('cartao-caseirao='.length).trim().toLowerCase();
    if(tokenPattern.test(code)){remember(code);openedByLink=true;}
    history.replaceState(history.state,'',location.pathname+location.search);
  }

  const reminder=fragment.match(/^fatura-caseirao=(\d{4}-\d{2}-\d{2})$/);
  if(reminder){
    requestedDue=reminder[1];
    openedByLink=true;
    history.replaceState(history.state,'',location.pathname+location.search);
  }

  function addPixButton(row,bill,refresh,dialog){
    const start=document.createElement('button');
    start.type='button';
    start.className='caseiraoCardAccess caseiraoCardPixAction';
    start.textContent='Pagar com Pix';
    const panel=document.createElement('div');
    panel.className='caseiraoCardPixPanel';
    panel.hidden=true;
    row.append(start,panel);
    start.onclick=()=>{
      panel.hidden=!panel.hidden;
      if(panel.childElementCount)return;
      const form=document.createElement('form');
      form.innerHTML='<label>E-mail para gerar o Pix<input required name="email" type="email" autocomplete="email" maxlength="254"></label><button class="caseiraoCardAccess" type="submit">Gerar Pix</button>';
      const status=document.createElement('p');
      status.setAttribute('role','status');
      const codePanel=document.createElement('div');
      panel.append(form,codePanel,status);
      const submit=form.querySelector('button');
      const email=form.elements.namedItem('email');
      const session=token;
      let timer;
      let checking=false;

      async function pixRequest(action,fields){
        const {result,card}=await requestCard({action,payload:{token:session,due:bill.due,...fields}});
        if(!result.ok)throw new Error(card.error||'Não foi possível consultar o Pix agora.');
        return card;
      }
      function showState(state){
        if(state==='pending'){
          status.textContent='Aguardando a confirmação do Mercado Pago.';
          return;
        }
        clearTimeout(timer);
        codePanel.replaceChildren();
        form.hidden=state!=='closed';
        status.textContent=state==='paid'?'Pix confirmado. Fatura paga.':state==='closed'?
          'Este Pix encerrou. Gere um novo código para pagar a fatura.':
          'Pagamento em conferência. Fale com o Caseirão antes de pagar novamente.';
        if(state==='paid')refresh();
      }
      function showCode(pix){
        codePanel.replaceChildren();
        const amount=document.createElement('p');
        amount.textContent='Valor do Pix: '+money(pix.amount);
        codePanel.append(amount);
        if(pix.qr_code_base64&&/^[A-Za-z0-9+/=]+$/.test(pix.qr_code_base64)){
          const qr=document.createElement('img');
          qr.src='data:image/png;base64,'+pix.qr_code_base64;
          qr.alt='QR Code Pix da fatura';
          qr.width=180;
          qr.height=180;
          codePanel.append(qr);
        }
        const copyField=document.createElement('input');
        copyField.value=pix.qr_code;
        copyField.readOnly=true;
        copyField.setAttribute('aria-label','Código Pix Copia e Cola');
        const copy=document.createElement('button');
        copy.type='button';
        copy.className='caseiraoCardAccess';
        copy.textContent='Copiar código Pix';
        copy.onclick=async()=>{
          try{await navigator.clipboard.writeText(copyField.value);copy.textContent='Código copiado';}
          catch{copyField.select();copy.textContent='Copie o código selecionado';}
        };
        const check=document.createElement('button');
        check.type='button';
        check.className='caseiraoCardSignout';
        check.textContent='Verificar pagamento';
        const instructions=document.createElement('p');
        instructions.textContent='Cole o código na opção Pix Copia e Cola do app do seu banco ou escaneie o QR Code.';
        codePanel.append(copyField,copy,instructions,check);
        const poll=async()=>{
          clearTimeout(timer);
          if(checking||!dialog.open||!check.isConnected||token!==session)return;
          checking=true;
          check.disabled=true;
          try{
            const next=await pixRequest('customer_pix_status',{id:pix.id});
            if(!check.isConnected||token!==session)return;
            showState(next.state);
            if(next.state!=='pending')return;
          }catch{
            status.textContent='A confirmação ainda não está disponível. Vamos tentar novamente.';
          }finally{
            checking=false;
            check.disabled=false;
          }
          timer=setTimeout(poll,15000);
        };
        check.onclick=poll;
        timer=setTimeout(poll,15000);
      }

      form.onsubmit=async event=>{
        event.preventDefault();
        submit.disabled=true;
        status.textContent='Consultando o Mercado Pago…';
        try{
          const pix=await pixRequest('customer_pix',{email:email.value.trim()});
          if(!form.isConnected||token!==session)return;
          showState(pix.state);
          if(pix.state==='pending'&&!pix.qr_code){
            status.textContent='Pix em processamento. Tente consultar daqui a pouco.';
          }else if(pix.state==='pending'){
            form.hidden=true;
            showCode(pix);
          }
        }catch(error){status.textContent=error.message;}
        finally{submit.disabled=false;}
      };
      email.focus();
    };
  }

  function setupAccount(dialog){
    const form=dialog.querySelector('form');
    const content=dialog.querySelector('[data-account]');
    const pilotNotice=dialog.querySelector('[data-card-pilot-notice]');
    const input=form.elements.namedItem('token');
    const feedback=dialog.querySelector('[role="status"]');
    const phone=form.elements.namedItem('phone');
    const submit=form.querySelector('button');
    const signout=dialog.querySelector('[data-card-signout]');
    let pending=false;
    async function load(code,phoneNumber=''){
      if(pending)return;
      const usingCode=Boolean(phoneNumber);
      const payload=usingCode?{action:'customer_access_code',payload:{phone:phoneNumber,code}}:
        {action:'customer',payload:{token:code}};
      pending=true;
      submit.disabled=signout.disabled=true;
      feedback.textContent='Consultando…';
      try {
        const {result,card}=await requestCard(payload);
        if(!result.ok){
          if(result.status===401&&!usingCode&&token===code){
            remember('');
            form.hidden=false;
            content.replaceChildren();
            signout.hidden=true;
          }
          throw new Error(result.status===429?'Limite de tentativas. Aguarde 10 minutos.':
            result.status===401?'Confira o WhatsApp e o código do cartão.':'Não foi possível abrir o cartão agora.');
        }
        const credential=usingCode?card.session_token:code;
        if(!tokenPattern.test(credential))throw new Error('Não foi possível abrir o cartão agora.');
        remember(credential);
        input.value='';
        phone.value='';
        form.hidden=true;
        pilotNotice.hidden=true;
        signout.hidden=false;
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
          const row=document.createElement('div');
          const summary=document.createElement('p');
          const status=paid?'Paga':bill.due<card.today?'Vencida':'Em aberto';
          const total=paid?paid.amount:bill.amount;
          const interest=Math.max(0,total-bill.principal);
          summary.textContent=`${status} · ${due(bill.due)} · ${money(total)} (juros ${money(interest)}) · pedidos ${bill.orders.join(', ')}`;
          row.append(summary);
          if(!paid&&bill.due<=card.today)addPixButton(row,bill,()=>load(credential),dialog);
          content.append(row);
          if(bill.due===requestedDue)requestAnimationFrame(()=>row.scrollIntoView({block:'nearest'}));
        }
        if(!invoices.size){
          const empty=document.createElement('p');empty.textContent='Nenhuma fatura registrada.';content.append(empty);
        }
        const cancelled=card.charges.filter(charge=>charge.cancelled_at);
        if(cancelled.length){
          const item=document.createElement('p');item.textContent='Compras estornadas · '+cancelled.map(charge=>'#'+charge.order_number).join(', ');content.append(item);
        }
        feedback.textContent='O Pix online fica disponível a partir do vencimento. Para quitar antes, fale com o Caseirão.';
      }catch(error){
        if(!form.hidden)pilotNotice.hidden=false;
        feedback.textContent=error.message;
      }finally{
        pending=false;
        submit.disabled=signout.disabled=false;
      }
    }
    form.onsubmit=event=>{
      event.preventDefault();
      const code=input.value.trim().toLowerCase();
      if(tokenPattern.test(code)){
        load(code);
        return;
      }
      if(!shortCodePattern.test(code)){
        feedback.textContent='Digite o código de 8 a 10 dígitos recebido do Caseirão.';
        return;
      }
      const digits=phone.value.replace(/\D/g,'');
      if(!/^(?:55)?\d{10,11}$/.test(digits)){
        feedback.textContent='Informe o WhatsApp cadastrado com DDD.';
        phone.focus();
        return;
      }
      load(code,digits);
    };
    signout.onclick=()=>{
      remember('');
      form.hidden=false;
      pilotNotice.hidden=false;
      signout.hidden=true;
      input.value='';
      phone.value='';
      content.replaceChildren();
      feedback.textContent='';
      input.focus();
    };
    return ()=>{if(token)load(token);};
  }

  const requestMessage='Olá! Tenho interesse no Cartão Caseirão. Como faço para solicitar uma análise?';
  const whatsAppLink='https://wa.me/5586988620979?text='+encodeURIComponent(requestMessage);
  const dialog=document.createElement('dialog');
  dialog.setAttribute('aria-labelledby','caseiraoCardHeading');
  dialog.className='caseiraoCardDialog';
  dialog.innerHTML=`<header class="caseiraoCardHeader">
    <div class="caseiraoCardHeaderCopy">
      <span class="caseiraoCardBrand">O Caseirão Burger</span>
      <h2 id="caseiraoCardHeading">Meu Cartão Caseirão</h2>
    </div>
    <span class="caseiraoCardEmblem" aria-hidden="true"><i></i><b>CB</b></span>
    <button type="button" class="caseiraoCardClose" data-card-close aria-label="Fechar">×</button>
  </header>
  <div class="caseiraoCardBody">
    <form aria-labelledby="caseiraoCardAccessTitle">
      <h3 id="caseiraoCardAccessTitle">Acesse seu cartão</h3>
      <div class="caseiraoCardFields">
        <label>WhatsApp com DDD<input name="phone" type="tel" autocomplete="tel" maxlength="24" placeholder="(86) 00000-0000" aria-describedby="caseiraoCardAccessHint"></label>
        <label>Código privado<input required name="token" type="password" autocomplete="off" maxlength="64" aria-describedby="caseiraoCardAccessHint"></label>
      </div>
      <small id="caseiraoCardAccessHint">Use o WhatsApp cadastrado e o código de 8 a 10 dígitos recebido da loja.</small>
      <button class="caseiraoCardAccess" type="submit">Acessar cartão <span aria-hidden="true">→</span></button>
    </form>
    <div class="caseiraoCardAccount" data-account></div>
    <p class="caseiraoCardFeedback" role="status"></p>
    <button type="button" class="caseiraoCardSignout" data-card-signout hidden>Sair do cartão</button>
    <section class="caseiraoCardPilotNotice" data-card-pilot-notice aria-labelledby="caseiraoCardPilotTitle">
      <h3 id="caseiraoCardPilotTitle">Quer solicitar seu cartão?</h3>
      <p>O Cartão Caseirão está em fase de adaptação. A liberação depende da análise e aprovação da administração.</p>
      <a class="caseiraoCardContact" href="${whatsAppLink}" target="_blank" rel="noopener noreferrer">
        Solicitar análise pelo WhatsApp <span aria-hidden="true">↗</span>
      </a>
    </section>
  </div>`;
  document.body.append(dialog);
  dialog.querySelector('[data-card-close]').onclick=()=>dialog.close();
  const refreshAccount=setupAccount(dialog);
  const show=()=>{if(!dialog.open){dialog.showModal();refreshAccount();}};
  document.getElementById('caseiraoCardHome')?.addEventListener('click',show);
  if(openedByLink)show();

  function describe(quote,breakdown,panel){
    const ratio=quote.total/quote.principal;
    const monthly=(ratio**(30/quote.days)-1)*100;
    const yearly=(ratio**(365/quote.days)-1)*100;
    const header=document.createElement('div');
    header.className='caseiraoQuoteHeader';
    const cardIcon=document.createElement('span');
    cardIcon.className='caseiraoQuoteCardIcon';
    cardIcon.setAttribute('aria-hidden','true');
    const heading=document.createElement('h3');
    heading.textContent='Cartão Caseirão';
    header.append(cardIcon,heading);

    const highlights=document.createElement('dl');
    highlights.className='caseiraoQuoteHighlights';
    const amounts=document.createElement('dl');
    amounts.className='caseiraoQuoteAmounts';
    function line(list,label,amount,className=''){
      const row=document.createElement('div');
      if(className)row.className=className;
      const name=document.createElement('dt');
      name.textContent=label;
      const value=document.createElement('dd');
      value.textContent=amount;
      row.append(name,value);
      list.append(row);
    }
    line(highlights,'Total a pagar na fatura',money(quote.total),'caseiraoQuoteTotal');
    line(highlights,'Vencimento',due(quote.due_date),'caseiraoQuoteDue');

    if(Number.isSafeInteger(breakdown?.products)){
      line(amounts,'Produtos',money(breakdown.products));
      if(breakdown.delivery>0)line(amounts,'Entrega',money(breakdown.delivery));
      if(breakdown.discount>0)line(amounts,'Descontos','− '+money(breakdown.discount));
    }
    line(amounts,'Total à vista',money(quote.principal));
    line(amounts,`Juros por ${quote.days} ${quote.days===1?'dia':'dias'}`,money(quote.interest));
    line(amounts,'Limite após a compra',money(quote.remaining));

    const rates=document.createElement('p');
    rates.className='caseiraoQuoteRates';
    rates.textContent=`Juros efetivos ${percent.format(monthly)}% ao mês · CET ${percent.format(yearly)}% ao ano`;
    const terms=document.createElement('div');
    terms.className='caseiraoQuoteTerms';
    for(const text of [
      'Credor: O Caseirão Burger · Av. Monsenhor Mateus, 340, Campo Maior–PI · caseiraopedidos.api.br',
      'Pagamento integral no vencimento. Antecipação reduz proporcionalmente os juros. Em atraso, novas compras ficam bloqueadas.'
    ]){
      const row=document.createElement('p');
      row.textContent=text;
      terms.append(row);
    }
    panel.replaceChildren(header,highlights,amounts,rates,terms);
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


