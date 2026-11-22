'use strict';

(() => {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const conversational = value => normalize(value)
    .replace(/\b(qto|qt|qnt)\b/g,'quanto').replace(/\b(vcs|vces)\b/g,'voces')
    .replace(/\b(pra|pro|pr|p) (?:a |o )?(entrega|retirada)\b/g,'para $1')
    .replace(/\b(zap|wpp|zapzap)\b/g,'whatsapp');
  const greetingPattern = /^(?:(?:oi|olá|ola|opa|e aí|e ai|oie+)\s*[,!.–—-]*\s*)?(boa\s+noite|bom\s+dia|boa\s+tarde|oi|olá|ola|opa|e aí|e ai|oie+)(?=$|[^\p{L}\p{N}])/iu;
  const deliveryQuestion = /\b(taxa|frete|entrega (?:para|em|no bairro|na rua)|entregam (?:em|no|na|para|pra)|faz(?:em)? entrega|tem delivery)\b/;
  const words = value => ' ' + normalize(value) + ' ';
  const includes = (text, term) => !!normalize(term) && words(text).includes(words(term));
  const brl = cents => (cents / 100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
  const cents = value => Math.round(Number(value || 0) * 100);
  const price = item => cents(Number(item.promo_price)>0 ? item.promo_price : item.price);
  const available = item => item && item.active!==false && !item.sold_out && (!item.stock_enabled || Number(item.stock_quantity)>0);
  const types = {delivery:'Entrega',pickup:'Retirada',local:'Consumo no local'};
  const numberWords = {um:1,uma:1,dois:2,duas:2,tres:3,quatro:4,cinco:5,seis:6,sete:7,oito:8,nove:9,dez:10};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^(?:\+?55[ \-]?)?\(?\d{2}\)?[ \-]?\d{4,5}[ \-]?\d{4}$/;
  const paymentFrom = value => includes(value,'pix') ? 'Pix' : includes(value,'dinheiro') ? 'Dinheiro'
    : /\b(cartao|credito|debito)\b/.test(normalize(value)) ? 'Cartão' : '';
  const typeFrom = value => /\b(retirada|retirar|buscar|busco)\b/.test(normalize(value)) ? 'pickup'
    : /\b(no local|consumo no local|comer ai|comer aqui|mesa)\b/.test(normalize(value)) ? 'local'
    : /\b(entrega|delivery|entregar)\b/.test(normalize(value)) ? 'delivery' : '';
  const phoneDigits = input => {
    if (phonePattern.test(input.trim())) return input.replace(/\D/g,'');
    const tokens=conversational(input).replace(/^(?:(?:meu|o|eu) )?(?:telefone|whatsapp|celular|numero)(?: e)? /,'').split(' ');
    const spoken={zero:0,meia:6,...numberWords,onze:11,doze:12,treze:13,catorze:14,quatorze:14,
      quinze:15,dezesseis:16,dezessete:17,dezoito:18,dezenove:19,vinte:20,trinta:30,quarenta:40,
      cinquenta:50,sessenta:60,setenta:70,oitenta:80,noventa:90};
    const digits=[];
    for (let index=0;index<tokens.length;index++) {
      const word=tokens[index];
      if (/^\d+$/.test(word)) {digits.push(word);continue;}
      if (!Object.hasOwn(spoken,word)) return '';
      const value=spoken[word];
      const unit=spoken[tokens[index+2]];
      if (value>=20&&tokens[index+1]==='e'&&unit>0&&unit<10) {
        digits.push(String(value+unit));index+=2;
      } else digits.push(String(value));
    }
    const result=digits.join('');
    return /^(?:55)?\d{10,11}$/.test(result)?result:'';
  };
  const orderQuantity = normalized => {
    const token=normalized.match(/\b(um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|\d{1,2})\s+(?:lanches?|hamburguer(?:es)?|burgers?|combos?)\b/)?.[1];
    const qty=Number(numberWords[token]||token);
    return qty>0&&qty<=30?qty:0;
  };
  const orderIntent = text => /\b(quero(?! saber)|queria(?! saber)|gostaria de (pedir|comprar|fazer)|me (ve|manda|da)|manda|coloca|bota|adiciona|vou (querer|pedir)|mais (um|uma|dois|duas|\d+))\b/.test(text);
  const inquiryIntent = text => /\b(quanto|preco|valor|tem|ingrediente|ingredientes|o que vem|vem com|adicionais|disponivel|esgotado|mostre|saber|queria ver)\b/.test(text);
  const alias = name => normalize(name).replace(/\bcoca cola\b/g,'coca').replace(/\b((?:500|350|600) ?ml|1 ?l(?:itro)?|lata)\b/g,'').replace(/\s+/g,' ').trim();

  function matchingProducts(text, products, useAliases = false) {
    let rest = words(useAliases ? alias(text) : text);
    const matches = [];
    const names = new Map();
    for (const product of products) {
      const name = useAliases ? alias(product.name) : normalize(product.name);
      if (!name) continue;
      const entries = names.get(name) || [];
      entries.push(product);
      names.set(name,entries);
    }
    const candidates = [...names].sort(([a],[b])=>b.length-a.length);
    for (const [name,entries] of candidates) {
      const match = rest.indexOf(' '+name+' ');
      if (match<0) continue;
      const preceding = rest.slice(0,match).trim().split(' ').at(-1);
      const qty = Math.max(1, Math.min(30,Number(numberWords[preceding] || (/^\d+$/.test(preceding) ? preceding : 1))));
      matches.push({entries,qty,index:match,length:name.length});
      rest = rest.slice(0,match+1)+' '.repeat(name.length)+rest.slice(match+1+name.length);
    }
    return matches.sort((a,b)=>a.index-b.index);
  }

  function similarToken(left,right) {
    if (left===right) return true;
    if (left.length<4 || Math.abs(left.length-right.length)>1) return false;
    if (right.length<left.length) [left,right]=[right,left];
    let index=0;
    while (index<left.length && left[index]===right[index]) index++;
    if (left.length!==right.length) return left.slice(index)===right.slice(index+1);
    return left.slice(index+1)===right.slice(index+1) ||
      (left[index]===right[index+1] && left[index+1]===right[index] && left.slice(index+2)===right.slice(index+2));
  }
  function suggestedProducts(text,products) {
    const tokens=alias(text).split(' ').filter(word=>word.length>=4 &&
      !['quero','queria','gostaria','pedir','adiciona','quanto','custa','lanches','lanche','pegar','saber','mostre','preco','valor','pedir','cardapio','pedido','igual','entrega','retirada'].includes(word));
    if (!tokens.length) return [];
    return products.map(product=>{
      const name=alias(product.name);
      const score=tokens.reduce((sum,word)=>sum+(includes(name,word)?3:
        name.split(' ').some(part=>similarToken(word,part))?2:0),0);
      return {product,score};
    }).filter(item=>item.score>0).sort((a,b)=>b.score-a.score)
      .filter((item,_,list)=>item.score>=list[0].score-1).slice(0,5).map(item=>item.product);
  }

  function create({host,log,form,input,feedback,actions,request,catalogRequest,onTrack,onPix,onHuman,remember}) {
    const history=[];
    const draft={items:[],address:{},requestId:crypto.randomUUID()};
    let catalog,mode='home',step='',focusProduct=null,pendingChoices=[],quote,receipt,busy=false;
    let finishRequested=false;
    let suggestedQuantity=0;
    let productContext=null;
    let checkingFee=false;
    let typingTurn=null;
    let replyGreeting='';
    let retryPending=false;
    const timestamps = {catalog:0};
    const nav = () => [
      ['Fazer pedido',()=>beginOrder()],['Ver cardápio',()=>showMenu()],
      ['Acompanhar pedido',()=>onTrack(receipt,draft.phone)],
      ['Falar com a equipe',()=>handoff()],
    ];

    function node(tag,text,klass) {
      const element=document.createElement(tag);
      if (text) element.textContent=text;
      if (klass) element.className=klass;
      return element;
    }
    function say(text,customer=false) {
      if (!customer) {
        typingTurn?.remove();
        if (replyGreeting) text=replyGreeting+' '+text;
        replyGreeting='';
      }
      history.push({text,customer});
      const bubble=node('div','',customer?'supportBubble outgoing':'supportBubble');
      bubble.append(node('strong',customer?'Você':'Assistente do Caseirão'),node('p',text));
      log.append(bubble);
      log.scrollTop=log.scrollHeight;
    }
    function buttons(choices=[],layout='') {
      actions.dataset.layout=layout;
      actions.replaceChildren(...choices.map(([label,action])=>{
        const button=node('button',label,'assistantChoice');
        button.type='button';
        button.onclick=()=>void run(action);
        return button;
      }));
    }
    async function run(action,delay=450) {
      if (busy) return;
      busy=true;
      host.setAttribute('aria-busy','true');
      const submitButton=form.querySelector('button[type=submit]');
      if (submitButton) submitButton.disabled=true;
      const choices=[...actions.querySelectorAll('button')];
      choices.forEach(button=>button.disabled=true);
      feedback.textContent='';
      const typing=node('div','','assistantTyping');
      typing.setAttribute('aria-hidden','true');
      typing.append(node('span','Assistente digitando'),node('i'),node('i'),node('i'));
      typingTurn=typing;
      log.append(typing);
      log.scrollTop=log.scrollHeight;
      function removeTyping() {typing.remove();}
      try {
        await new Promise(resolve=>setTimeout(resolve,delay));
        if (host.open) await action();
      } catch (error) {feedback.textContent=error.message || 'Não consegui concluir. Tente de novo.';}
      finally {
        removeTyping();
        typingTurn=null;
        replyGreeting='';
        if (submitButton) submitButton.disabled=false;
        choices.forEach(button=>button.disabled=false);
        busy=false;
        host.removeAttribute('aria-busy');
      }
    }
    async function latest(force=false) {
      if (force || !catalog || Date.now()-timestamps.catalog>12_000) {
        catalog=await catalogRequest();
        timestamps.catalog=Date.now();
      }
      return catalog;
    }
    function footer(extra=[]) {
      const menu=extra.some(([label])=>label==='Ver cardápio'||label==='Outras categorias')?[]:[['Ver cardápio',()=>showMenu()]];
      return [...extra,...menu,...(mode==='checkout'&&step!=='confirm'?[['Continuar pedido',()=>proceed()]]:[]),...(draft.items.length?[['Ver meu pedido',()=>review()],['Adicionar mais',()=>beginOrder()]]:[]),['Falar com a equipe',()=>handoff()]];
    }
    function handoff() {
      if (retryPending) {
        say('Antes de trocar de atendimento, confira se o seu pedido foi registrado. Toque em Verificar envio.');
        return;
      }
      const summary=draft.items.length ? 'Itens que estávamos montando: '+draft.items.map(item=>item.qty+'× '+item.name+(item.note?' ('+item.note+')':'')).join(', ')+'. ' : '';
      const lastQuestion=[...history].reverse().find(turn=>turn.customer)?.text || '';
      onHuman((summary+lastQuestion).slice(0,600));
    }

    function productDetails(product) {
      const availability=available(product)?'':' · esgotado';
      return product.name+' · '+brl(price(product))+availability;
    }
    async function showMenu() {
      await latest(true);
      const groups=[...new Set(catalog.products.map(product=>product.category||'Outros'))];
      if (!groups.length) {
        say('O cardápio está sem itens no momento. Posso chamar a equipe.');
        buttons(footer());
        return;
      }
      say('Qual parte do cardápio você quer ver? Pode tocar numa categoria ou escrever o nome de um item.');
      buttons(footer(groups.map(group=>[group,()=>showCategory(group)])));
    }
    async function showCategory(group) {
      await latest();
      const products=catalog.products.filter(product=>(product.category||'Outros')===group);
      say(products.length?products.map(productDetails).join('\n'):'Essa categoria está sem itens agora.');
      buttons(footer([['Outras categorias',()=>showMenu()],['Fazer pedido',()=>beginOrder()]]));
    }
    function linkedAddons(product) {
      const linked=new Set(catalog.product_addons.filter(link=>String(link.product_id)===String(product.id)).map(link=>String(link.addon_id)));
      return catalog.addons.filter(addon=>linked.has(String(addon.id)));
    }
    function describe(product, addonsOnly) {
      productContext=product.id;
      const addons=linkedAddons(product).filter(available);
      const lines=[productDetails(product)];
      if (!addonsOnly && (product.description||product.desc)) lines.push(product.description||product.desc);
      if (addonsOnly || addons.length) lines.push(addons.length ? 'Opções: '+addons.map(addon=>addon.name+' · '+brl(cents(addon.price))).join(', ') : 'Esse item está sem adicionais disponíveis.');
      say(lines.join('\n'));
      buttons(footer(available(product)?[['Adicionar '+product.name,()=>addProduct(product,1,'')]]:[]));
    }
    async function beginOrder() {
      if (receipt) return say('O pedido #'+receipt.order_number+' já foi registrado. Toque em Novo pedido pra começar outro.');
      if (retryPending) return;
      await latest();
      mode='items';
      step='';
      say(draft.items.length?'O que mais você quer adicionar?':'O que você quer pedir? Pode mandar o nome do lanche, a quantidade e observações, como “dois Pé pra Fora sem cebola”.');
      buttons(footer([['Ver cardápio',()=>showMenu()]]));
    }
    function noteFrom(text) {
      return /\bsem\s+([^.!?]+)/i.exec(text)?.[0]?.slice(0,160).trim() || '';
    }
    function addLine(product,qty,note,addons) {
      draft.items.push({product_id:product.id,name:product.name,qty,note,addon_ids:addons.map(addon=>addon.id)});
    }
    function addProduct(product,qty,message) {
      if (receipt||retryPending) return false;
      if (draft.items.length>=30) {
        say('Seu pedido já tem muitos itens. Posso passar a conversa para a equipe.');
        buttons(footer());
        return false;
      }
      if (!available(product)) {
        say(product.name+' está esgotado no momento.');
        return false;
      }
      const drinks=window.CaseiraoComboDrinks?.options(catalog,product.id) || [];
      const mixedNotes=message.match(/(?:[,;]|\be)\s*(um|uma|dois|duas|tr[eê]s|[1-9])\s+(sem\s+[\p{L}\s-]+?)(?=[.,;!?]|\s+(?:pra|para)\s|$)/iu);
      if (mixedNotes&&qty>1) {
        const annotatedQty=Number(numberWords[normalize(mixedNotes[1])]||mixedNotes[1]);
        if (annotatedQty>0&&annotatedQty<qty) {
          pendingChoices.unshift({entries:[product],qty:annotatedQty,message:mixedNotes[2]});
          qty-=annotatedQty;
          message=message.slice(0,mixedNotes.index);
        }
      }
      const itemText=message.split(/(?:[,;]|\b(?:pra|para) (?:entrega|retirada|comer)|\b(?:pagamento|pago|pagar|vou pagar)\b)/i)[0];
      const note=noteFrom(itemText);
      const extraText=itemText.match(/\b(?:com|adicional de)\s+(.+)/i)?.[1] || '';
      const addons=linkedAddons(product).filter(addon=>available(addon)&&
        !window.CaseiraoComboDrinks?.includes(addon.id)&&includes(extraText,addon.name));
      if (extraText && !addons.length && !drinks.some(option=>includes(extraText,option.name))) {
        focusProduct={product,qty,message};
        step='verify_extra';
        say('Não consegui confirmar o adicional de '+product.name+'. Posso adicionar o item sem esse extra ou passar a conversa para a equipe.');
        buttons([['Adicionar sem esse extra',()=>{step='';if(addProduct(product,qty,note)||!step)return continueAdding()}],['Falar com a equipe',()=>handoff()]]);
        return false;
      }
      if (drinks.length) {
        focusProduct={product,qty,remaining:qty,note,addons:addons.slice(0,9),selections:new Map()};
        step='combo_drink';
        const requested=drinks.filter(option=>option.available&&includes(extraText,option.name));
        if (requested.length===1 && qty===1) return chooseDrink(requested[0]);
        askDrink(drinks);
        return false;
      }
      addLine(product,qty,note,addons.slice(0,10));
      say('Anotei '+qty+'× '+product.name+(addons.length?' com '+addons.map(addon=>addon.name).join(', '):'')+(note?' ('+note+')':'')+'.');
      mode='items'; step='';
      buttons(footer([['Finalizar pedido',()=>proceed()]]));
      return true;
    }
    function askDrink(options) {
      const {product,qty,remaining}=focusProduct;
      const availableOptions=options.filter(option=>option.available);
      say(availableOptions.length
        ? 'Qual bebida você quer no '+(qty>1?'combo '+(qty-remaining+1)+' de '+qty:product.name)+'?'
        : 'As bebidas deste combo estão esgotadas. Você pode escolher outro item.');
      buttons([...availableOptions.map(option=>[option.name,()=>chooseDrink(option)]),['Escolher outro item',()=>{focusProduct=null;return beginOrder()}],['Falar com a equipe',()=>handoff()]]);
    }
    function chooseDrink(option) {
      const current=focusProduct;
      if (!current||!option.available) return;
      const count=current.selections.get(option.id)?.qty || 0;
      current.selections.set(option.id,{addon:option.addon,qty:count+1});
      current.remaining--;
      if (current.remaining) return askDrink(window.CaseiraoComboDrinks.options(catalog,current.product.id));
      for (const selection of current.selections.values()) {
        addLine(current.product,selection.qty,current.note,[...current.addons,selection.addon]);
      }
      say('Anotei '+current.qty+'× '+current.product.name+' com '+[...current.selections.values()].map(selection=>selection.addon.name).join(', ')+'.');
      focusProduct=null; step='';
      return continueAdding();
    }
    async function continueAdding() {
      while (pendingChoices.length) {
        const {entries,qty,message}=pendingChoices.shift();
        if (entries.length>1) {
          step='product_choice';
          focusProduct={entries,qty,message};
          say('Qual destas opções você quer?');
          buttons([...entries.map(product=>[productDetails(product),()=>chooseProduct(product)]),['Falar com a equipe',()=>handoff()]]);
          return;
        }
        if (!addProduct(entries[0],qty,message) && step) return;
      }
      if (finishRequested && draft.items.length) return proceed();
      buttons(footer([['Finalizar pedido',()=>proceed()]]));
    }
    function chooseProduct(product) {
      const {qty,message}=focusProduct;
      focusProduct=null; step='';
      if (!addProduct(product,qty,message)&&step) return;
      return continueAdding();
    }
    function prompt(title,choices=[]) {
      say(title);
      buttons([...choices,['Ver meu pedido',()=>review(false)],['Falar com a equipe',()=>handoff()]]);
    }
    function proceed() {
      if (receipt) return;
      if (retryPending) return confirm();
      if (!draft.items.length) return beginOrder();
      mode='checkout';
      if (!draft.type) {
        step='type';
        return prompt('Você quer entrega, retirada ou consumo no local?',
          Object.entries(types).map(([type,label])=>[label,()=>{draft.type=type;return proceed()}]));
      }
      if (!draft.name) {
        step='name';
        return prompt('Qual é o seu nome?');
      }
      if (!draft.phone) {
        step='phone';
        return prompt('Qual é o seu telefone com DDD? Você usa esse número pra acompanhar o pedido.');
      }
      if (draft.type==='delivery') {
        if (!draft.address.neighborhood_id) {
          step='neighborhood';
          return prompt('Qual é o bairro?',catalog.neighborhoods.map(hood=>[hood.name,()=>{draft.address.neighborhood_id=hood.id;return proceed()}]));
        }
        if (!draft.address.street) {step='street';return prompt('Qual é a rua ou avenida?');}
        if (!draft.address.number) {step='number';return prompt('Qual é o número da casa? Se for sem número, pode escrever “s/n”.');}
        if (draft.address.reference===undefined) {
          step='reference';
          return prompt('Tem complemento ou ponto de referência?', [['Pular',()=>{draft.address.reference='';return proceed()}]]);
        }
      }
      if (draft.type==='local'&&!draft.table) {
        step='table';
        return prompt('Qual é o número da sua mesa no Caseirão?');
      }
      if (!draft.payment) {
        step='payment';
        return prompt('Como você vai pagar?', ['Pix','Cartão','Dinheiro'].map(method=>[method,()=>{draft.payment=method;return proceed()}]));
      }
      if (draft.payment==='Pix'&&!draft.email) {step='email';return prompt('Qual é o seu e-mail? Ele é usado pra gerar o Pix.');}
      if (draft.payment==='Dinheiro'&&draft.change===undefined) {
        step='change';
        return prompt('Precisa de troco? Se precisar, digite o valor da nota.', [['Sem troco',()=>{draft.change='';return proceed()}]]);
      }
      return review();
    }
    function pickupDetails(text) {
      draft.type ||= typeFrom(text);
      draft.payment ||= paymentFrom(text);
      const explicitName=text.match(/(?:me chamo|meu nome (?:é|e)|aqui (?:é|e))\s+([^,.;!?]+)/i)?.[1]
        ?.split(/\s+(?:e\s+)?(?:o pagamento|vou pagar|pago|meu telefone|meu whatsapp|meu email|o endereço|endereço|moro|rua|avenida)\b/i)[0];
      if (explicitName&&explicitName.length<90) draft.name ||= explicitName.trim();
      const phone=text.match(/(?:\b(?:telefone|whatsapp|celular)\s*:?\s*)?((?:\+55\s*)?\(?\d{2}\)?[ -]?\d{4,5}[ -]?\d{4})\b/)?.[1];
      if (phone) draft.phone ||= phone.replace(/\D/g,'');
      const email=text.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i)?.[0];
      if (email) draft.email ||= email;
      if (draft.type==='delivery') {
        const candidates=catalog.neighborhoods.filter(hood=>includes(text,hood.name));
        if (candidates.length===1) draft.address.neighborhood_id ||= candidates[0].id;
        const address=text.match(/\b((?:rua|avenida|travessa|av\.)\s+[^,.;]+?)(?:,\s*|\s+n[º°o]\s*)(\d+[a-z]?|s\/n)\b/i);
        if (address) {
          draft.address.street ||= address[1].trim();
          draft.address.number ||= address[2];
        }
        const reference=text.match(/(?:referência|referencia|complemento)(?:\s*(?:é|e|:))?\s+([^.;!?]+)/i)?.[1];
        if (reference) draft.address.reference ??= reference.trim().slice(0,190);
      }
      if (draft.type==='local') {
        const table=normalize(text).match(/\bmesa (\d{1,3})\b/)?.[1];
        if (Number(table)>0) draft.table ||= Number(table);
      }
    }
    function answerField(text) {
      const normalized=normalize(text);
      const field=step;
      switch(field) {
        case 'type': draft.type=typeFrom(text); break;
        case 'name': if (text.length<90&&text.length>1&&/^[\p{L}][\p{L} .'-]+$/u.test(text)) draft.name=text; break;
        case 'phone': draft.phone ||= phoneDigits(text); break;
        case 'neighborhood': {
          const candidates=catalog.neighborhoods.filter(hood=>normalize(hood.name)===normalized||includes(text,hood.name));
          if(candidates.length===1) draft.address.neighborhood_id=candidates[0].id;
          break;
        }
        case 'street': if (text.length>2&&text.length<=150) draft.address.street=text; break;
        case 'number': if (/^(\d+[a-z]?|s\/n|sem numero)$/i.test(text)||normalized==='sem numero') draft.address.number=normalized==='sem numero'?'S/N':text; break;
        case 'reference': if (text.length<200) draft.address.reference=['pular','nao','nenhum','sem complemento','sem referencia'].includes(normalized)?'':text; break;
        case 'table': {
          const table=normalized.match(/^(?:mesa )?(\d{1,3})$/)?.[1];
          if (Number(table)>0) draft.table=Number(table);
          break;
        }
        case 'payment': draft.payment=paymentFrom(text); break;
        case 'email': if (emailPattern.test(text)) draft.email=text; break;
        case 'change': {
          const value=text.match(/^(?:r\$\s*)?(\d{1,5}(?:[.,]\d{1,2})?)$/i)?.[1];
          if (['nao','sem troco','nao precisa'].includes(normalized)) draft.change='';
          else if (value) draft.change=value;
          break;
        }
      }
      return proceed();
    }
    function showOrderCard(items,details,total) {
      typingTurn?.remove();
      const card=node('section','','assistantOrder');
      const heading=node('h3','Seu pedido');
      card.append(heading);
      const list=node('ul','','assistantOrderItems');
      for (const {product,line,options} of items) {
        const row=node('li','','assistantOrderItem');
        if (product.image_url) {
          const photo=node('img','','assistantOrderPhoto');
          photo.alt='';
          photo.addEventListener('error',()=>photo.remove(),{once:true});
          photo.src=product.image_url;
          row.append(photo);
        }
        const description=node('div');
        description.append(node('strong',line.qty+'× '+product.name));
        for (const option of [...options,line.note].filter(Boolean)) {
          description.append(node('p',option));
        }
        row.append(description);
        list.append(row);
      }
      const orderDetails=node('dl','','assistantOrderDetails');
      for (const [label,value] of details) {
        const row=node('div');
        row.append(node('dt',label),node('dd',value));
        orderDetails.append(row);
      }
      const totalRow=node('div','','assistantOrderTotal');
      totalRow.append(node('span','Total'),node('strong',brl(total)));
      card.append(list,orderDetails,totalRow);
      log.querySelector('.assistantOrder')?.remove();
      log.append(card);
      log.scrollTop=log.scrollHeight;
    }

    async function review(showConfirm=true) {
      if (receipt||retryPending) return;
      if (!draft.items.length) return beginOrder();
      await latest(showConfirm&&mode==='checkout');
      const lines=[];
      const items=[];
      const unit=[];
      const unavailable=[];
      let subtotal=0;
      const quantities=new Map();
      for(const line of draft.items) quantities.set(line.product_id,(quantities.get(line.product_id)||0)+line.qty);
      draft.items.forEach((line,index)=>{
        const product=catalog.products.find(item=>item.id===line.product_id);
        const addons=line.addon_ids.map(id=>catalog.addons.find(addon=>addon.id===id));
        const linked=product?linkedAddons(product).map(addon=>addon.id):[];
        const drinks=product?(window.CaseiraoComboDrinks?.options(catalog,product.id)||[]):[];
        const selectedDrink=drinks.find(drink=>line.addon_ids.includes(drink.id));
        if (!available(product)||(product.stock_enabled&&quantities.get(product.id)>Number(product.stock_quantity))||addons.some(addon=>!available(addon)||!linked.includes(addon.id))||
          (drinks.length&&!selectedDrink?.available)) {
          unavailable.push(index);
          lines.push(line.qty+'× '+line.name+' · indisponível');
          return;
        }
        const value=price(product)+addons.reduce((sum,addon)=>sum+cents(addon.price),0);
        unit.push(value); subtotal+=value*line.qty;
        const options=addons.map(addon=>selectedDrink?.id===addon.id ? selectedDrink.name : addon.name);
        items.push({product,line,options});
        lines.push(line.qty+'× '+product.name+(addons.length?' + '+addons.map(addon=>addon.name).join(', '):'')+
          (line.note?' ('+line.note+')':'')+' · '+brl(value*line.qty));
      });
      const hood=catalog.neighborhoods.find(item=>item.id===draft.address.neighborhood_id);
      const fee=draft.type==='delivery'&&hood ? cents(hood.fee) : 0;
      const total=subtotal+fee;
      const edits=draft.items.map((line,index)=>['Remover '+line.name,()=>{draft.items.splice(index,1);return review(false)}]);
      buttons(footer(edits));
      if (unavailable.length) {
        say(lines.join('\n')+'\nRemova ou troque os itens indisponíveis para continuar.');
        return;
      }
      if (!showConfirm) {
        say(lines.join('\n')+'\nSubtotal dos itens: '+brl(subtotal));
        buttons(footer([['Finalizar pedido',()=>proceed()],...edits]));
        return;
      }
      if (!catalog.settings.store_open) {
        say('O Caseirão está fechado para pedidos agora. Você pode consultar o cardápio ou falar com a equipe.');
        buttons([['Ver cardápio',()=>showMenu()],['Falar com a equipe',()=>handoff()]]);
        return;
      }
      if (draft.type==='delivery'&&!hood) {
        delete draft.address.neighborhood_id;
        return proceed();
      }
      if (subtotal<cents(catalog.settings.min_order)) {
        say('O pedido mínimo é de '+brl(cents(catalog.settings.min_order))+'. Seu subtotal está em '+brl(subtotal)+'.');
        buttons(footer([['Ver cardápio',()=>showMenu()]]));
        return;
      }
      if (draft.payment==='Dinheiro'&&draft.change&&cents(draft.change.replace(',','.'))<total) {
        delete draft.change;
        say('O valor para troco precisa cobrir o total de '+brl(total)+'.');
        return proceed();
      }
      const eta=draft.type==='delivery'
        ? (catalog.settings.peak_mode?catalog.settings.peak_delivery_eta:catalog.settings.delivery_eta)
        : (catalog.settings.peak_mode?catalog.settings.peak_pickup_eta:catalog.settings.pickup_eta);
      const details=[
        [types[draft.type],draft.type==='local'?'Mesa '+draft.table:(eta||'')],
        ['Pagamento',draft.payment+(draft.change?' · Troco para '+draft.change:'')],
        ['Cliente',draft.name+' · '+draft.phone],
      ];
      if (draft.type==='delivery') {
        const {street,number,reference}=draft.address;
        details.splice(1,0,
          ['Endereço',street+', '+number+' · '+hood.name+(reference?' · '+reference:'')],
          ['Taxa de entrega',brl(fee)]);
      }
      quote={total_cents:total,unit_cents:unit};
      step='confirm';
      if (replyGreeting) {
        const greeting=replyGreeting;
        replyGreeting='';
        say(greeting+' Confere o resumo do pedido.');
      }
      showOrderCard(items,details,total);
      const showReviewActions=()=>buttons([
        ['Confirmar pedido',()=>confirm()],
        ['Editar pedido',()=>buttons([
          ['Corrigir dados',()=>editDetails()],['Adicionar mais',()=>beginOrder()],...edits,
          ['Voltar ao resumo',()=>showReviewActions()],['Falar com a equipe',()=>handoff()],
        ])],
        ['Falar com a equipe',()=>handoff()],
      ],'review');
      showReviewActions();
    }
    function editDetails() {
      for (const key of ['type','name','phone','email','payment','change','table']) delete draft[key];
      draft.address={};
      return proceed();
    }
    const pendingKey='caseirao_assistant_pending_v1';
    const pixKey='caseirao_assistant_pix_v1';
    function readPix() {
      try {return JSON.parse(sessionStorage.getItem(pixKey)||'null')}catch{return null}
    }
    function savePix(value) {
      try {if(value)sessionStorage.setItem(pixKey,JSON.stringify(value));else sessionStorage.removeItem(pixKey)}catch{}
    }
    let pendingInMemory;
    function restorePending() {
      if (pendingInMemory) return pendingInMemory;
      try {return JSON.parse(sessionStorage.getItem(pendingKey)||'null')}catch{return null}
    }
    function savePending(value) {
      pendingInMemory=value;
      try {if(value)sessionStorage.setItem(pendingKey,JSON.stringify(value));else sessionStorage.removeItem(pendingKey)}catch{}
    }
    async function confirm() {
      const previous=restorePending();
      const payload=retryPending&&previous ? previous.payload : {
        client_request_id:draft.requestId, source:'client', type:draft.type, payment:draft.payment,
        customer:{name:draft.name,phone:draft.phone}, address:draft.address,
        change_for:draft.change||'', chat_table_number:draft.table||null, chat_quote:quote,
        items:draft.items.map(({product_id,qty,note,addon_ids})=>({product_id,qty,note,addon_ids})),
      };
      const email=retryPending&&previous ? previous.email : draft.email;
      savePending({payload,email});
      feedback.textContent='Registrando pedido…';
      try {
        receipt=await request('create-order',payload);
        savePending(null);
        retryPending=false;
      } catch (error) {
        if (!error.httpStatus||error.httpStatus>=500) {
          retryPending=true;
          say('A resposta do sistema demorou. Toque em Verificar envio para consultar a mesma tentativa.');
          buttons([['Verificar envio',()=>confirm()]]);
          return;
        }
        savePending(null);
        retryPending=false;
        if (error.code==='chat_table_invalid') {
          delete draft.table;
          say(error.message);
          return proceed();
        }
        if (error.code==='chat_quote_changed') say('Um valor mudou. Confira o resumo atualizado antes de confirmar novamente.');
        else say(error.message);
        if (draft.items.length) return review();
        return beginOrder();
      } finally {
        feedback.textContent='';
      }
      draft.phone=payload.customer.phone;
      draft.email=email;
      remember(receipt.tracking_code,draft.phone);
      if (payload.payment==='Pix') savePix({receipt,phone:draft.phone,email});
      showReceipt(payload.payment==='Pix',email);
    }
    function showReceipt(isPix,email) {
      say('Pedido #'+receipt.order_number+' registrado! Seu código pra acompanhar é '+receipt.tracking_code+
        (isPix?'. Toque em Pagar com Pix para abrir o pagamento.':'. Você pode acompanhar a situação por aqui.'));
      buttons([...(isPix?[['Pagar com Pix',()=>onPix(receipt,draft.phone,email)]]:[]),
        ['Acompanhar pedido',()=>onTrack(receipt,draft.phone)],['Novo pedido',()=>{savePix(null);return reset()}],['Falar com a equipe',()=>handoff()]]);
    }
    function storeQuestion(normalized) {
      if (/\b(alergia|alergico|alergica|contaminacao cruzada|celiaco|celiaca)\b/.test(normalized)) {
        say('Para confirmar ingredientes e preparo por causa de alergia, fale com a equipe do Caseirão.');
        buttons(footer());
        return true;
      }
      if (/\b(onde fica|qual (o )?endereco (da loja|de voces)|localizacao da loja|como chegar|qual o endereco)\b/.test(normalized)) {
        const place=document.querySelector('#storeLocationBtn strong')?.textContent;
        say(place?'O Caseirão fica em '+place+', Campo Maior–PI.':'Você pode ver a localização do Caseirão no topo do cardápio.');
        buttons(footer());
        return true;
      }
      if (checkingFee||deliveryQuestion.test(normalized)&&!orderIntent(normalized)) {
        const neighborhoods=catalog.neighborhoods.filter(hood=>includes(normalized,hood.name));
        if (neighborhoods.length) {
          checkingFee=false;
          say(neighborhoods.length===1
            ? 'Entregamos em '+neighborhoods[0].name+'. A taxa é de '+brl(cents(neighborhoods[0].fee))+'.'
            : neighborhoods.map(hood=>hood.name+': taxa de '+brl(cents(hood.fee))+'.').join(' '));
          buttons(footer());
        } else {
          checkingFee=true;
          say('Qual é o seu bairro? Eu confiro a entrega pra você.');
          buttons(footer(catalog.neighborhoods.map(hood=>[hood.name,()=>{
            checkingFee=false;
            say('A taxa de entrega no bairro '+hood.name+' é '+brl(cents(hood.fee))+'.');
            buttons(footer());
          }])));
        }
        return true;
      }
      const budget=normalized.match(/\b(?:ate|menos de|no maximo) (?:r )?(\d{1,3})(?: (\d{2}))?\b/);
      if (budget&&/\b(lanche|lanches|hamburguer|hamburgueres|combo|combos|opcoes|tem)\b/.test(normalized)&&!orderIntent(normalized)) {
        const category=/\bcombos?\b/.test(normalized)?'combo':'hamburguer';
        const limit=Number(budget[1])*100+Number(budget[2]||0);
        const results=catalog.products.filter(product=>available(product)&&price(product)<=limit&&normalize(product.category).includes(category))
          .sort((a,b)=>price(a)-price(b)).slice(0,5);
        say(results.length?'Aqui vão opções de até '+brl(limit)+' no cardápio, antes da entrega:\n'+results.map(productDetails).join('\n'):
          'Não encontrei uma opção disponível nessa faixa no cardápio.');
        buttons(footer(results.map(product=>['Ver '+product.name,()=>describe(product,false)])));
        return true;
      }
      if (/\b(quanto tempo|qual o prazo|demora quanto|previsao de entrega|tempo de entrega)\b/.test(normalized)) {
        const {settings}=catalog;
        const eta=settings.peak_mode?settings.peak_delivery_eta:settings.delivery_eta;
        say(eta?'A previsão de entrega informada no cardápio é de '+eta+'.':'A previsão de entrega ainda não está informada no cardápio.');
        buttons(footer());
        return true;
      }
      if (/^(?:voces )?(aceita|aceitam|recebe|recebem|quais|como|pode|da pra|tem)\b/.test(normalized)&&/\b(pagamento|pagar|pix|cartao|dinheiro)\b/.test(normalized)) {
        say('Pelo assistente você pode escolher Pix, cartão ou dinheiro. Se for Pix, o botão de pagamento aparece depois que você confirma o pedido.');
        buttons(footer());
        return true;
      }
      return false;
    }
    function showSuggestions(products,quantity,wantsToOrder) {
      say('Encontrei estas opções no cardápio. Qual delas você quis dizer?');
      buttons(footer(products.map(product=>[productDetails(product),()=>{
        if (wantsToOrder&&available(product)) {
          pendingChoices=[{entries:[product],qty:quantity||1,message:''}];
          return continueAdding();
        }
        return describe(product,false);
      }])));
    }

    async function handle(text) {
      if (retryPending) {
        say('Toque em Verificar envio para consultar a tentativa anterior.');
        return;
      }
      const greeting=text.match(greetingPattern);
      if (greeting) {
        const greetingText=normalize(greeting[1]);
        const salutation=['boa noite','bom dia','boa tarde'].includes(greetingText)
          ? greetingText[0].toUpperCase()+greetingText.slice(1)+'!' : 'Oi!';
        const rest=text.slice(greeting[0].length).replace(/^[^\p{L}\p{N}+]+/u,'').trim();
        if (!rest || /^(tudo bem|tudo bom|como vai|como voce esta)$/.test(normalize(rest))) {
          const answer=rest ? ' Tudo bem por aqui.' : '';
          if (receipt) return say(salutation+answer+' Quer acompanhar seu pedido ou fazer outro?');
          if (step||draft.items.length||checkingFee) return say(salutation+answer+' Vamos continuar de onde paramos?');
          say(salutation+answer+' Quer ver o cardápio ou já sabe o que vai pedir?');
          return buttons(nav());
        }
        text=rest;
        replyGreeting=salutation;
      }
      const normalized=conversational(text);
      const wantsToOrder=orderIntent(normalized);
      const asks=inquiryIntent(normalized)&&!wantsToOrder;
      if (/\b(falar com (a equipe|alguem|uma pessoa)|atendente|atendimento humano)\b/.test(normalized)) return handoff();
      if (/\b(acompanhar|cade meu pedido|status do pedido|saiu para entrega)\b/.test(normalized)) return onTrack(receipt,draft.phone);
      if (receipt) {
        if (normalized==='novo pedido') {savePix(null);return reset();}
        return say('Seu pedido #'+receipt.order_number+' já foi registrado. Você pode acompanhar ou começar outro pedido pelos botões.');
      }
      if (/\b(mudar (meu|os) dados|corrigir dados)\b/.test(normalized)&&draft.items.length) return editDetails();
      if (/^(ver (meu|o) pedido|ver resumo|quanto deu|quanto ficou( tudo)?|qual (e )?o total)$/.test(normalized)&&draft.items.length) return review(false);
      if (step==='confirm'&&/^(sim|confirmo|confirmar|pode enviar|pode mandar)$/.test(normalized)) {
        say('Pra registrar, toque no botão Confirmar pedido.');
        return;
      }
      const requestMenu=/^(cardapio|menu|(?:ver|manda|mandar|mostra|mostrar|me manda) (?:o )?cardapio)\b/.test(normalized);
      const faq=/\b(alergia|alergico|alergica|celiaco|celiaca|contaminacao cruzada|quanto tempo|qual o prazo|demora quanto|previsao de entrega|tempo de entrega|onde fica|como chegar|localizacao da loja|horario|que horas|qual o endereco|aberto|fechado|funcionando)\b/.test(normalized) ||
        deliveryQuestion.test(normalized) ||
        /^(?:voces )?(aceita|aceitam|recebe|recebem|quais|como|pode|da pra|tem)\b.*\b(pagamento|pagar|pix|cartao|dinheiro)\b/.test(normalized);
      const question=asks||requestMenu||faq||checkingFee;
      if (!question&&!wantsToOrder&&step==='product_choice') {
        const choices=focusProduct.entries.filter(product=>includes(text,product.name));
        if (choices.length===1) return chooseProduct(choices[0]);
        say('Qual item da lista você quis dizer? Pode tocar no nome ou escrever o nome completo.');
        return;
      }
      if (!question&&step==='verify_extra') {
        say('Escolha uma das opções acima pra eu continuar.');
        return;
      }
      if (!question&&step==='combo_drink') {
        const options=window.CaseiraoComboDrinks.options(catalog,focusProduct.product.id);
        const match=options.filter(option=>option.available&&(normalize(option.name)===normalized||includes(text,option.name)));
        if (match.length===1) return chooseDrink(match[0]);
        return askDrink(options);
      }
      if (mode==='checkout'&&step!=='confirm'&&!question&&!wantsToOrder) {
        await latest();
        pickupDetails(text);
        if (step==='name'&&!draft.name&&text.includes(',')) {
          const first=text.split(',')[0].trim();
          if (/^[\p{L}][\p{L} .'-]{1,87}$/u.test(first)&&!/^rua\b|^avenida\b/i.test(first)) draft.name=first;
        }
        const filled={type:draft.type,name:draft.name,phone:draft.phone,neighborhood:draft.address.neighborhood_id,
          street:draft.address.street,number:draft.address.number,reference:draft.address.reference,table:draft.table,payment:draft.payment,email:draft.email};
        return filled[step]!==undefined&&filled[step]!=='' ? proceed() : answerField(text);
      }
      await latest();
      if (checkingFee&&(requestMenu||wantsToOrder)) checkingFee=false;
      if (storeQuestion(normalized)) return;
      if (/\b(aberto|fechado|funcionando|horario|que horas)\b/.test(normalized)&&!wantsToOrder) {
        const hours=[catalog.settings.open_time,catalog.settings.close_time].map(value=>String(value||'').slice(0,5));
        say((catalog.settings.store_open?'O Caseirão está aberto agora.':'O Caseirão está fechado agora.')+
          (hours.every(Boolean)?' Horário informado: '+hours.join(' às ')+'.':''));
        return buttons(footer([['Ver cardápio',()=>showMenu()]]));
      }
      if (/\b(promocao|promocoes|oferta|ofertas)\b/.test(normalized)&&!matchingProducts(text,catalog.products).length) {
        const promos=catalog.products.filter(product=>available(product)&&Number(product.promo_price)>0);
        say(promos.length?promos.map(productDetails).join('\n'):'O cardápio está sem produtos em promoção agora.');
        return buttons(footer([['Ver cardápio',()=>showMenu()],['Fazer pedido',()=>beginOrder()]]));
      }
      if (requestMenu) return showMenu();
      if (/^(finalizar|fechar|so isso|e so|terminar)( meu| o)?( pedido)?$/.test(normalized)) return proceed();

      const clauses=text.split(/[!?]+\s*|\.\s+(?=[\p{L}])/u).filter(part=>part.trim());
      const adding=[];
      const describing=new Map();
      for (const clause of clauses) {
        const context=conversational(clause);
        const names=matchingProducts(clause,catalog.products);
        const matches=names.length?names:matchingProducts(clause,catalog.products,true);
        const clauseQuestion=inquiryIntent(context)&&!orderIntent(context);
        if (clauseQuestion) {
          for(const match of matches) for(const product of match.entries) describing.set(product.id,product);
          continue;
        }
        if (asks&&!wantsToOrder) continue;
        for (const match of matches) {
          const segment=matches.length===1?clause:
            clause.split(/\s+e\s+|,|;/i).find(part=>match.entries.some(product=>includes(part,product.name)||includes(part,alias(product.name))))||clause;
          adding.push({...match,message:segment});
        }
      }
      const contextual=/\b(esse|essa|desse|dessa|dele|dela|deste|desta)\b/.test(normalized)
        ?catalog.products.find(product=>product.id===productContext):null;
      if (!adding.length&&!describing.size&&contextual) {
        if (asks) describing.set(contextual.id,contextual);
        else if (wantsToOrder) {
          const token=normalized.match(/\b(um|uma|dois|duas|tres|\d{1,2})\s+(?:desse|dessa|dele|dela|deste|desta)\b/)?.[1];
          adding.push({entries:[contextual],qty:Math.max(1,Math.min(30,Number(numberWords[token]||token||1))),message:text});
        }
      }
      if (describing.size) {
        const products=[...describing.values()].slice(0,6);
        for(const product of products) describe(product,includes(text,'adicionais'));
        if (products.length>1) {
          productContext=null;
          buttons(footer(products.filter(available).map(product=>['Adicionar '+product.name,()=>addProduct(product,1,'')])));
        }
        if (!adding.length) return;
      }
      if (adding.length) {
        if (/^nao (quero|coloca|manda)\b|^tirar\b|^remov/.test(normalized)) {
          say('Vou mostrar o seu pedido para você escolher qual item quer tirar.');
          return review(false);
        }
        pickupDetails(text);
        if (adding.length===1&&adding[0].qty===1&&suggestedQuantity&&!/\b(um|uma|\d+)\b/.test(normalized)) {
          adding[0].qty=suggestedQuantity;
        }
        suggestedQuantity=0;
        if (adding.length===1&&adding[0].entries.length===1) productContext=adding[0].entries[0].id;
        mode='items'; step='';
        finishRequested=Boolean(draft.type);
        pendingChoices=adding;
        return continueAdding();
      }
      const categories=[...new Set(catalog.products.map(product=>product.category||'Outros'))];
      const category=categories.find(item=>normalize(item)===normalized||
        /\b(quais|mostre|ver|tem)\b/.test(normalized)&&includes(text,item));
      if (category) return showCategory(category);
      const quantity=orderQuantity(normalized);
      if (quantity&&(wantsToOrder||/^(?:\w+ )+lanches?$/.test(normalized))) {
        suggestedQuantity=quantity;
        mode='items';step='';
        say(quantity===1?'Qual lanche você gostaria de pedir?':'Quais são os '+quantity+' lanches? Pode escrever os nomes ou tocar em Ver cardápio.');
        return buttons(footer([['Ver cardápio',()=>showMenu()]]));
      }
      if (draft.items.length&&!question&&typeFrom(text)) {
        draft.type=typeFrom(text);
        pickupDetails(text);
        return proceed();
      }
      const suggestions=suggestedProducts(text,catalog.products);
      if (suggestions.length) return showSuggestions(suggestions,suggestedQuantity,wantsToOrder||mode==='items');
      if (wantsToOrder||/\b(pedir|comprar|pedido)\b/.test(normalized)) {
        if (draft.items.length && typeFrom(text)) {
          pickupDetails(text);
          return proceed();
        }
        if (/\b(fazer um pedido|fazer pedido|quero pedir|gostaria de pedir)\b/.test(normalized)||normalized==='pedido') return beginOrder();
        say('Não encontrei um item com esse nome. Você pode me dizer outro nome ou escolher no cardápio.');
        return buttons(footer([['Ver cardápio',()=>showMenu()]]));
      }
      if (/^(obrigado|obrigada|valeu|show|beleza)$/.test(normalized)) return say('De nada! Se precisar de mais alguma coisa, é só falar.');
      say('Posso consultar o cardápio, montar seu pedido ou chamar a equipe. Qual você prefere?');
      buttons(draft.items.length?footer([['Ver cardápio',()=>showMenu()]]):nav());
    }
    function reset() {
      for(const key of Object.keys(draft)) delete draft[key];
      Object.assign(draft,{items:[],address:{},requestId:crypto.randomUUID()});
      history.length=0; log.replaceChildren();
      mode='home';step='';receipt=null;quote=null;focusProduct=null;pendingChoices=[];finishRequested=false;
      suggestedQuantity=0;productContext=null;checkingFee=false;
      const previous=restorePending();
      retryPending=Boolean(previous?.payload?.client_request_id);
      if (retryPending) {
        say('Há um envio em andamento. Confira se ele foi registrado antes de começar outro pedido.');
        buttons([['Verificar envio',()=>confirm()]]);
      } else if (readPix()) {
        const saved=readPix();
        receipt=saved.receipt;
        draft.phone=saved.phone;
        showReceipt(true,saved.email);
      } else {
        say('Oi! Sou o Assistente do Caseirão. Pode escrever seu pedido do seu jeito ou escolher uma opção.');
        buttons(nav());
      }
    }
    function submit() {
      const text=input.value.trim();
      if (!text||busy) return;
      input.value='';
      say(text,true);
      void run(()=>handle(text),Math.min(1050,560+text.length*4));
    }
    reset();
    return {submit,reset};
  }

  window.caseiraoOrderAssistant={create};
})();
