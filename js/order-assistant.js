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
  const orderPrice = /^(?:e |entao )?(?:(?:me (?:diz|fala) )?(?:qual (?:e )?)?(?:o )?(?:valor(?: total| final)?|preco(?: total| final)?|total(?: final)?|subtotal|soma)(?: (?:d[oe] (?:meu |esse )?(?:pedido|carrinho)|d[eo]le|de tudo|com tudo|a pagar))?|quanto(?: (?:e|custa|fica|ficou|deu|da|sai|vai dar|(?:eu )?(?:vou pagar|tenho que pagar|pago)|ta|esta))?(?: (?:no total|ao todo|tudo|o pedido|meu pedido|isso|com tudo))?)(?: (?:ai|por favor))?$/;
  const orderSummary = /^(?:e )?(?:ver (?:meu|o) pedido|ver resumo|resumo(?: do pedido)?|o que (?:eu )?pedi(?: ate agora)?|o que tem no (?:meu )?(?:pedido|carrinho)|como (?:ficou|ta|esta) (?:meu|o) pedido|quais (?:sao )?os itens(?: do pedido)?)(?: por favor)?$/;
  const trackingQuestion = /\b(acompanhar|(?:cade|onde (?:ta|esta)) (?:o |meu )?pedido|status (?:do (?:meu )?)?pedido|saiu (?:(?:para|pra) (?:a )?entrega|em rota)|(?:meu|o) pedido (?:ja )?(?:ta|esta|ficou) (?:em preparo|pronto|em rota))\b/;
  const trackingCodeQuestion = /\bcodigo (?:do (?:meu )?pedido|pedido|(?:de|pra|para) acompanhar|de rastreio)\b|\b(?:qual|perdi|esqueci|manda) (?:e )?(?:o |meu )?codigo$/;
  const quickTracking = /^(?:e )?(?:ja saiu|saiu ja|ja foi pra rota|esta vindo|ta vindo|ja (?:ta|esta) (?:pronto|a caminho|em rota)|cade o (?:lanche|entregador|motoboy))$/;
  const delayQuestion = /\b(?:ta demorando|esta demorando|demorando demais|ta atrasado|esta atrasado|pedido atrasado|pedido (?:ainda )?nao chegou|quanto (?:tempo )?falta pro meu pedido)\b/;
  const thankYou = /^(?:muito obrigado|muito obrigada|obrigad[oa]|obg|vlw|valeu|show|beleza)(?: pessoal| pela ajuda| pelo atendimento| pelo pedido| caseirao| mesmo)?$|^(?:chegou tudo (?:certo|certinho)|tava uma delicia|estava uma delicia|parabens pelo lanche)$/;
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
  const orderIntent = text => /\b(quero(?! saber)|queria(?! saber)|gostaria de (pedir|comprar|fazer)|me (ve|manda|da|separa|arruma|prepara|faz)|manda|separa|coloca|bota|adiciona|vou (querer|pedir|levar|de)|mais (um|uma|dois|duas|\d+))\b/.test(text);
  const inquiryIntent = text => /\b(quanto|preco|valor|custa|tem|leva|ingrediente|ingredientes|o que vem|vem com|composicao|adicionais|disponivel|esgotado|mostre|saber|queria ver|diferenca|compare|comparar)\b/.test(text);
  const alias = name => normalize(name).replace(/\bcoca cola\b/g,'coca').replace(/\bpe (?:para|pra) fora\b/g,'pe pra fora').replace(/\b((?:500|350|600) ?ml|1 ?l(?:itro)?|lata)\b/g,'').replace(/\s+/g,' ').trim();
  const menuName = name => normalize(name).replace(/\bpe para fora\b/g,'pe pra fora');

  function matchingProducts(text, products, useAliases = false) {
    let rest = words(useAliases ? alias(text) : menuName(text));
    const matches = [];
    const names = new Map();
    for (const product of products) {
      const name = useAliases ? alias(product.name) : menuName(product.name);
      if (!name) continue;
      const entries = names.get(name) || [];
      entries.push(product);
      names.set(name,entries);
    }
    const candidates = [...names].sort(([a],[b])=>b.length-a.length);
    for (const [name,entries] of candidates) {
      let match=rest.indexOf(' '+name+' ');
      while (match>=0) {
        const preceding = rest.slice(0,match).trim().split(' ').at(-1);
        const qty = Math.max(1, Math.min(30,Number(numberWords[preceding] || (/^\d+$/.test(preceding) ? preceding : 1))));
        matches.push({entries,qty,index:match,length:name.length});
        rest = rest.slice(0,match+1)+' '.repeat(name.length)+rest.slice(match+1+name.length);
        match=rest.indexOf(' '+name+' ',match+1);
      }
    }
    return matches.sort((a,b)=>a.index-b.index);
  }

  function orderSegments(text,products) {
    const pieces=text.split(/(\s+e\s+|[,;]\s*)/i);
    const segments=[pieces[0]];
    for (let index=1;index<pieces.length;index+=2) {
      const part=pieces[index+1];
      const normalized=menuName(part);
      const match=matchingProducts(part,products)[0];
      const prefix=match?normalized.slice(0,match.index).trim():'';
      const startsWithItem=match&&/^(?:(?:mais|tambem|outro|outra|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|\d{1,2})\s*)*$/.test(prefix);
      if (startsWithItem) segments.push(part);
      else segments[segments.length-1]+=pieces[index]+part;
    }
    return segments;
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
    let editScope=null;
    let typingTurn=null;
    let replyGreeting='';
    let retryPending=false;
    let recentMenuMessage='';
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
      return bubble;
    }
    function trackingCredentials() {
      if (receipt?.tracking_code&&draft.phone) return {tracking_code:receipt.tracking_code,phone:draft.phone};
      try {
        const saved=JSON.parse(localStorage.getItem('caseirao_last_tracking')||'{}');
        if (saved.tracking_code&&saved.phone) return {tracking_code:saved.tracking_code,phone:String(saved.phone)};
      } catch {}
      return null;
    }
    function lastCustomerMessage() {
      return history.findLast(turn=>turn.customer)?.text || '';
    }
    async function offerTracking(kind='track') {
      const saved=trackingCredentials();
      const question=lastCustomerMessage();
      let text=kind==='code'&&saved
        ? 'O código do pedido salvo neste aparelho é '+saved.tracking_code+'.'
        : 'Para ver a situação, toque em Acompanhar pedido e informe o código e o WhatsApp usado na compra.';
      if (kind!=='code'&&saved) {
        try {
          const {order}=await request('track-order',saved);
          const status=String(order?.status??'').trim();
          if (status && order.order_number!=null) {
            text='O pedido #'+order.order_number+' está com o status “'+status+'”.';
            if (kind==='delay') {
              const closed=/cancel|recus|entregue|finaliz|conclu|retirad pelo cliente/.test(normalize(status));
              if (!closed) text+=' Entendo a espera. Nossa equipe pode confirmar a previsão atualizada.';
            }
          } else text='Não consegui localizar o pedido salvo. Confira o código e o WhatsApp em Acompanhar pedido.';
        } catch {
          text='Não consegui consultar o status agora. Tente em Acompanhar pedido ou fale com a equipe.';
        }
      }
      if (kind==='delay'&&!saved) text='Entendo a espera. '+text+' Se precisar, a equipe pode conferir a demora.';
      const bubble=say(text);
      const button=node('button','Acompanhar pedido','supportTrackingButton');
      button.type='button';
      button.onclick=()=>onTrack(saved,saved?.phone);
      bubble.append(button);
      if (kind==='delay') {
        const help=node('button','Pedir ajuda à equipe','supportTrackingButton');
        help.type='button';
        help.onclick=()=>void run(()=>handoff(saved,question));
        bubble.append(help);
      }
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
    function hasPendingItemChoice() {
      return ['verify_extra','combo_drink','product_choice'].includes(step);
    }
    function footer(extra=[],canFinalize=true) {
      const menu=extra.some(([label])=>label==='Ver cardápio'||label==='Outras categorias')?[]:[['Ver cardápio',()=>showMenu()]];
      const checkout=canFinalize&&draft.items.length&&!hasPendingItemChoice()
        ? [[mode==='checkout'&&step?'Continuar pedido':'Finalizar pedido',()=>proceed(true)]]
        : [];
      const cart=draft.items.length?[['Ver meu pedido',()=>review(false,Boolean(step))],['Adicionar mais',()=>beginOrder()]]:[];
      return [...checkout,...extra,...menu,...cart,['Falar com a equipe',()=>handoff()]];
    }
    function handoff(order,question=lastCustomerMessage()) {
      if (retryPending) {
        say('Antes de trocar de atendimento, confira se o seu pedido foi registrado. Toque em Verificar envio.');
        return;
      }
      const summary=!order&&!receipt&&draft.items.length ? '\nItens no carrinho: '+draft.items.map(lineLabel).join(', '):'';
      onHuman((question+summary).slice(0,600),order);
    }
    function offerHelp(text,relatedToOrder=false) {
      const question=lastCustomerMessage();
      const order=relatedToOrder?trackingCredentials():null;
      const bubble=say(text);
      const button=node('button','Falar com a equipe','supportTrackingButton');
      button.type='button';
      button.onclick=()=>void run(()=>handoff(order,question));
      bubble.append(button);
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
    function describe(product, addonsOnly, showButtons=true) {
      productContext=product.id;
      const drinks=window.CaseiraoComboDrinks?.options(catalog,product.id)||[];
      const addons=linkedAddons(product).filter(addon=>available(addon)&&!drinks.some(drink=>drink.id===addon.id));
      const lines=[productDetails(product)];
      if (!addonsOnly && (product.description||product.desc)) lines.push(product.description||product.desc);
      if (addonsOnly || addons.length) lines.push(addons.length ? 'Adicionais disponíveis: '+addons.map(addon=>addon.name+' · '+brl(cents(addon.price))).join(', ') : 'Esse item está sem adicionais disponíveis.');
      if (drinks.length) lines.push('Bebidas do combo: '+(drinks.filter(drink=>drink.available).map(drink=>drink.name+(cents(drink.addon?.price)>0?' · +'+brl(cents(drink.addon.price)):'' )).join(', ')||'esgotadas no momento.'));
      say(lines.join('\n'));
      if (showButtons) buttons(footer(available(product)?[['Adicionar '+product.name,()=>addProduct(product,1,'')]]:[]));
    }
    function listProducts(products, message, empty) {
      say(products.length?message+'\n'+products.map(productDetails).join('\n'):empty);
      buttons(footer(products.slice(0,8).map(product=>['Ver '+product.name,()=>describe(product,false)])));
      return true;
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
    function itemCustomizations(message) {
      const itemText=message.split(/\b(?:pra|para) (?:entrega|retirada|comer)|\b(?:pagamento|pago|pagar|vou pagar)\b/i)[0];
      const clauses=[...itemText.matchAll(/(?:^|\s|[,;])(?:e\s+)?(sem|com(?:\s+(?:adiciona(?:l|is)|extra)(?:\s+de)?)?|\+|adiciona(?:l|is)(?:\s+de)?)\s+/gi)];
      const notes=[];
      const extras=[];
      clauses.forEach((clause,index)=>{
        const content=itemText.slice(clause.index+clause[0].length,clauses[index+1]?.index)
          .replace(/(?:[\s,;.!?]+|\s+e)+$/i,'').trim();
        if (!content) return;
        if (normalize(clause[1])==='sem') notes.push('sem '+content);
        else extras.push(content);
      });
      return {note:notes.join(', ').slice(0,160),extras};
    }
    function extraName(value) {
      return normalize(value).replace(/^(?:adicional|extra)(?: de)? /,'').replace(/ extra$/,'');
    }
    function requestedExtras(parts, options) {
      const matches=[];
      const unknown=[];
      function match(matchingText) {
        const name=extraName(matchingText);
        const exact=options.filter(option=>extraName(option.name)===name);
        if (exact.length) return exact;
        return options.filter(option=>{
          const label=extraName(option.name);
          return name==='carne' && /^(?:carne(?: (?:bovina|hamburguer))?|hamburguer)(?: \d{2,3} ?g)?$/.test(label);
        });
      }
      function resolve(part) {
        const entries=match(part);
        if (entries.length===1 && !matches.includes(entries[0])) matches.push(entries[0]);
        else unknown.push(part);
      }
      for (const part of parts) {
        if (match(part).length) resolve(part);
        else part.split(/\s+e\s+|[,;+]/i).map(value=>value.trim()).filter(Boolean).forEach(resolve);
      }
      return {matches,unknown};
    }
    function addLine(product,qty,note,addons) {
      draft.items.push({product_id:product.id,name:product.name,qty,note,addon_ids:addons.map(addon=>addon.id)});
    }
    function editOrder(normalized) {
      const change=normalized.match(/^(?:(?:pode|consegue|quero) )?(tira(?:r)?|retira(?:r)?|remove(?:r)?|deixa(?:r)?|troca(?:r)?|coloca(?:r)?|bota(?:r)?|adiciona(?:r)?) (.+)$/);
      if (!change || !draft.items.length) return false;
      const [,verb,request]=change;
      const remove=/^(tir|retir|remov)/.test(verb);
      const setQuantity=/^deix/.test(verb);
      const replace=/^troc/.test(verb);
      const exact=matchingProducts(request,catalog.products);
      const matches=exact.length?exact:matchingProducts(request,catalog.products,true);
      const target=matches.at(0)?.entries;
      const inCart=draft.items.map((line,index)=>({line,index}));
      const candidates=target?inCart.filter(({line})=>target.some(product=>product.id===line.product_id)):inCart;
      const scope=request.match(/\b(?:(?:de|em|no|na) )?(?:so |apenas )?(um|uma|dois|duas|tres|\d{1,2}) (?:so|apenas|deles|delas)\b|\b(?:de|em) (?:so |apenas )?(um|uma|dois|duas|tres|\d{1,2})(?: |$)/);
      const scopeToken=scope?.[1]||scope?.[2];
      const amount=Number(numberWords[scopeToken]||scopeToken||0);
      const subject=request.replace(/^(?:o |a |os |as )/,'');
      const addonText=subject.split(/\s+(?:de|do|da|em|no|na|dos|das)\s+(?=(?:so |apenas )?(?:um|uma|dois|duas|tres|\d{1,2})\b|(?:o |a )?(?:meu |esse |essa )?(?:lanche|pedido|hamburguer|combo|todos|ambos)\b)/)[0];
      const beforeProduct=target?request.slice(0,matches[0].index).trim():'';
      const addonName=target ? beforeProduct.replace(/\s+(?:de|do|da|em|no|na|dos|das)\s*$/,'').replace(/^(?:o |a |os |as )/,'').trim() : addonText;
      const choices=candidates.flatMap(({line,index})=>{
        const product=catalog.products.find(item=>item.id===line.product_id);
        if (!product) return [];
        const options=linkedAddons(product).filter(addon=>!window.CaseiraoComboDrinks?.includes(addon.id)&&
          (remove?line.addon_ids.includes(addon.id):available(addon)&&!line.addon_ids.includes(addon.id)));
        const {matches:extras}=requestedExtras([addonName],options);
        return extras.length===1?[{line,index,addon:extras[0]}]:[];
      });
      const update=async action=>{
        action();
        quote=null;
        if (step==='confirm') step='';
        if (!draft.items.length) {
          say('Seu pedido ficou vazio. O que você quer adicionar?');
          return beginOrder();
        }
        return review(false);
      };
      if (!replace&&!setQuantity&&choices.length) {
        const apply=({line,index,addon},qty)=>update(()=>{
          editScope=null;
          const addon_ids=remove?line.addon_ids.filter(id=>id!==addon.id):[...line.addon_ids,addon.id];
          const edited={...line,qty,addon_ids};
          if (qty===line.qty) draft.items[index]=edited;
          else draft.items.splice(index,1,{...line,qty:line.qty-qty},edited);
        });
        const applyChoice=choice=>{
          const {line,addon}=choice;
          if (amount>line.qty) return say('Só há '+line.qty+' unidade(s) nessa opção. Quantas você quer alterar?');
          if (amount && amount<line.qty && draft.items.length>=30) return say('Seu pedido atingiu o limite de itens. Posso chamar a equipe para ajudar.');
          if (!remove&&line.addon_ids.length>=10) return say('Esse item já atingiu o limite de adicionais.');
          if (amount||line.qty===1||/\b(todos|todas|ambos|ambas)\b/.test(request)) return apply(choice,amount||line.qty);
          say('Você quer '+(remove?'tirar ':'colocar ')+addon.name+' em um só ou em todos os '+line.qty+' '+line.name+'?');
          editScope={one:()=>draft.items.length<30?apply(choice,1):say('Seu pedido atingiu o limite de itens.'),all:()=>apply(choice,line.qty)};
          buttons([['Em um só',editScope.one],['Em todos',editScope.all],['Falar com a equipe',()=>handoff()]]);
        };
        if (choices.length===1) return applyChoice(choices[0])||true;
        say('Em qual item você quer alterar esse adicional?');
        buttons([...choices.map(choice=>[lineLabel(choice.line),()=>applyChoice(choice)]),['Falar com a equipe',()=>handoff()]]);
        return true;
      }
      if (!(remove||replace||setQuantity)) return false;
      const quantityToken=request.match(/^(?:so |apenas )?(um|uma|dois|duas|tres|quatro|cinco|\d{1,2})\b/)?.[1];
      const quantity=Number(numberWords[quantityToken]||quantityToken||0);
      const identifiesProduct=target&&/^(?:(?:o|a|os|as|so|apenas|um|uma|dois|duas|tres|quatro|cinco|\d{1,2})\s*)*$/.test(beforeProduct);
      const referencesItem=identifiesProduct||/^(?:(?:o |a |esse |essa )?(?:ultimo|ultima|lanche|combo|hamburguer|item))$/.test(request)||setQuantity&&quantity&&!target;
      if (!referencesItem||replace||!candidates.length||setQuantity&&(!quantity||quantity>30)) {
        say(replace?'Posso remover o item antigo e adicionar o novo em seguida. Qual você quer remover?':'Me diga qual item do pedido você quer alterar.');
        return review(false);
      }
      const edit=({line,index})=>{
        const qty=setQuantity?quantity:quantity?Math.max(0,line.qty-quantity):0;
        return update(()=>qty?draft.items[index]={...line,qty}:draft.items.splice(index,1));
      };
      if (candidates.length===1 || /^o? ?ultim[oa]$/.test(request)) return edit(candidates.at(-1));
      say('Qual destas linhas você quer alterar?');
      buttons([...candidates.map(candidate=>[lineLabel(candidate.line),()=>edit(candidate)]),['Falar com a equipe',()=>handoff()]]);
      return true;
    }
    function lineLabel(line) {
      const extras=line.addon_ids.map(id=>catalog?.addons.find(option=>option.id===id)?.name).filter(Boolean);
      return line.qty+'× '+line.name+(extras.length?' com '+extras.join(', '):'')+(line.note?' · '+line.note:'');
    }
    function addProduct(product,qty,message,customizations) {
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
      const scopedExtra=message.match(/\b(?:em|no|na)\s+(?:s[oó]\s+)?(um|uma|dois|duas|tr[eê]s|[1-9])(?:\s+(?:s[oó]|apenas|deles|delas))?\s*[.!?]*$/iu);
      if (qty>1&&scopedExtra&&itemCustomizations(message.slice(0,scopedExtra.index)).extras.length) {
        const scopedQty=Number(numberWords[normalize(scopedExtra[1])]||scopedExtra[1]);
        if (scopedQty<qty && draft.items.length<29) {
          const customized=message.slice(0,scopedExtra.index);
          const {note}=itemCustomizations(customized);
          pendingChoices.unshift({entries:[product],qty:qty-scopedQty,message:note});
          qty=scopedQty;
          message=customized;
        }
      }
      const mixedNotes=message.match(/(?:[,;]|\be)\s*(um|uma|dois|duas|tr[eê]s|[1-9])\s+(sem\s+[\p{L}\s-]+?)(?=[.,;!?]|\s+(?:pra|para)\s|$)/iu);
      if (mixedNotes&&qty>1) {
        const annotatedQty=Number(numberWords[normalize(mixedNotes[1])]||mixedNotes[1]);
        if (annotatedQty>0&&annotatedQty<qty) {
          pendingChoices.unshift({entries:[product],qty:annotatedQty,message:mixedNotes[2]});
          qty-=annotatedQty;
          message=message.slice(0,mixedNotes.index);
        }
      }
      const {note,extras}=customizations || itemCustomizations(message);
      const addonOptions=linkedAddons(product).filter(addon=>available(addon)&&!window.CaseiraoComboDrinks?.includes(addon.id));
      const {matches,unknown}=customizations || requestedExtras(extras,[...addonOptions,...drinks.filter(option=>option.available)]);
      const addons=matches.filter(option=>addonOptions.includes(option));
      const requestedDrinks=matches.filter(option=>drinks.includes(option));
      if (unknown.length || addons.length>(drinks.length?9:10) || requestedDrinks.length>1) {
        const retained=addons.slice(0,drinks.length?9:10);
        const confirmedDrinks=requestedDrinks.length===1?requestedDrinks:[];
        const unresolved=unknown.length?' ('+unknown.join(', ').slice(0,160)+')':'';
        step='verify_extra';
        say('Preciso confirmar os adicionais de '+product.name+unresolved+'. Você pode ficar com as opções que consegui identificar ou falar com a equipe.');
        buttons([[retained.length||confirmedDrinks.length?'Manter os adicionais identificados':'Adicionar sem adicional',()=>{
          step='';
          if (addProduct(product,qty,'',{note,matches:[...retained,...confirmedDrinks],unknown:[]})||!step) return continueAdding();
        }],['Falar com a equipe',()=>handoff()]]);
        return false;
      }
      if (drinks.length) {
        if (customizations && requestedDrinks.length===1) {
          addLine(product,qty,note,[...addons,requestedDrinks[0].addon]);
          say('Anotei '+qty+'× '+product.name+' com '+requestedDrinks[0].name+'.');
          mode='items'; step='';
          buttons(footer());
          return true;
        }
        focusProduct={product,qty,remaining:qty,note,addons,selections:new Map()};
        step='combo_drink';
        if (requestedDrinks.length===1 && qty===1) return chooseDrink(requestedDrinks[0]);
        askDrink(drinks);
        return false;
      }
      addLine(product,qty,note,addons);
      const summary=[qty+'× '+product.name+' · '+brl(price(product)*qty)];
      for (const addon of addons) summary.push('+ '+qty+'× '+addon.name+' · '+brl(cents(addon.price)*qty));
      if (addons.length) summary.push('Subtotal destes itens: '+brl(qty*(price(product)+addons.reduce((sum,addon)=>sum+cents(addon.price),0))));
      if (note) summary.push('Observação: '+note);
      say('Anotei '+summary.join('\n')+'.');
      mode='items'; step='';
      buttons(footer());
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
        const {entries,qty,message,customizations}=pendingChoices.shift();
        if (entries.length>1) {
          step='product_choice';
          focusProduct={entries,qty,message};
          say('Qual destas opções você quer?');
          buttons([...entries.map(product=>[productDetails(product),()=>chooseProduct(product)]),['Falar com a equipe',()=>handoff()]]);
          return;
        }
        if (!addProduct(entries[0],qty,message,customizations) && step) return;
      }
      if (finishRequested && draft.items.length) return proceed();
      buttons(footer());
    }
    function chooseProduct(product) {
      const {qty,message}=focusProduct;
      focusProduct=null; step='';
      if (!addProduct(product,qty,message)&&step) return;
      return continueAdding();
    }
    function prompt(title,choices=[]) {
      say(title);
      buttons([...choices,['Ver meu pedido',()=>review(false,true)],['Falar com a equipe',()=>handoff()]]);
    }
    function proceed(refresh=false) {
      if (receipt) return;
      if (retryPending) return confirm();
      if (hasPendingItemChoice()) return say('Escolha a opção pendente do item antes de finalizar o pedido.');
      if (!draft.items.length) return beginOrder();
      return checkStoreAndProceed(refresh);
    }
    function showClosedCheckout() {
      say('O Caseirão está fechado para novos pedidos agora. Seus itens continuam no carrinho. Toque no botão novamente quando a loja abrir.');
      buttons(footer());
    }
    async function checkStoreAndProceed(refresh) {
      await latest(refresh);
      if (!catalog.settings.store_open) return showClosedCheckout();
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
      for (const {product,line,options,basePrice} of items) {
        const row=node('li','','assistantOrderItem');
        if (product.image_url) {
          const photo=node('img','','assistantOrderPhoto');
          photo.alt='';
          photo.addEventListener('error',()=>photo.remove(),{once:true});
          photo.src=product.image_url;
          row.append(photo);
        }
        const description=node('div');
        description.append(node('strong',line.qty+'× '+product.name+' · '+basePrice));
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

    async function review(showConfirm=true,keepActions=false) {
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
        const options=addons.map(addon=>{
          const name=selectedDrink?.id===addon.id ? selectedDrink.name : addon.name;
          return '+ '+line.qty+'× '+name+' · '+brl(cents(addon.price)*line.qty);
        });
        items.push({product,line,options,basePrice:brl(price(product)*line.qty)});
        lines.push([line.qty+'× '+product.name+' · '+brl(price(product)*line.qty),...options,
          ...(line.note?['Observação: '+line.note]:[])].join('\n'));
      });
      const hood=catalog.neighborhoods.find(item=>item.id===draft.address.neighborhood_id);
      const fee=draft.type==='delivery'&&hood ? cents(hood.fee) : 0;
      const total=subtotal+fee;
      const edits=draft.items.map((line,index)=>['Remover '+line.name,()=>{draft.items.splice(index,1);return review(false)}]);
      if (unavailable.length) {
        if (!keepActions) buttons(footer(edits,false));
        say(lines.join('\n')+'\nRemova ou troque os itens indisponíveis para continuar.');
        return;
      }
      if (!showConfirm) {
        const totals=['Subtotal dos itens: '+brl(subtotal)];
        if (draft.type==='delivery'&&hood) totals.push('Taxa de entrega: '+brl(fee),'Total com entrega: '+brl(total));
        else if (!draft.type||draft.type==='delivery') totals.push('A taxa de entrega, se houver, depende do bairro.');
        else totals.push('Total do pedido: '+brl(total));
        if (!catalog.settings.store_open) totals.push('A loja está fechada para confirmar pedidos agora.');
        say(lines.join('\n\n')+'\n\n'+totals.join('\n'));
        if (!keepActions) buttons(footer(edits));
        return;
      }
      if (!catalog.settings.store_open) return showClosedCheckout();
      if (draft.type==='delivery'&&!hood) {
        delete draft.address.neighborhood_id;
        return proceed();
      }
      if (subtotal<cents(catalog.settings.min_order)) {
        say('O pedido mínimo é de '+brl(cents(catalog.settings.min_order))+'. Seu subtotal está em '+brl(subtotal)+'.');
        buttons(footer([],false));
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
        } else if (checkingFee && !deliveryQuestion.test(normalized) && !/\b(?:quanto|taxa|frete|cardapio|horario|pagamento|ingredientes|adicionais|entrega)\b/.test(normalized)) {
          say('Não encontrei esse bairro na lista de entrega. Pode escolher um bairro abaixo ou falar com a equipe.');
        } else if (!checkingFee || deliveryQuestion.test(normalized)) {
          checkingFee=true;
          say('Qual é o seu bairro? Eu confiro a entrega pra você.');
          buttons(footer(catalog.neighborhoods.map(hood=>[hood.name,()=>{
            checkingFee=false;
            say('A taxa de entrega no bairro '+hood.name+' é '+brl(cents(hood.fee))+'.');
            buttons(footer());
          }])));
        } else return false;
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
    function catalogQuestion(normalized) {
      const products=catalog.products.filter(available);
      const named=matchingProducts(normalized,catalog.products).length||matchingProducts(normalized,catalog.products,true).length;
      if (named) return false;
      const categories=[...new Set(catalog.products.map(product=>product.category).filter(Boolean))];
      const category=categories.find(item=>includes(normalized,item)||includes(normalized,normalize(item).replace(/s$/,'')));
      const inCategory=product=>{
        const group=normalize(product.category);
        if (category) return product.category===category;
        if (/\bcombos?\b/.test(normalized)) return /\bcombos?\b/.test(group);
        if (/\b(?:lanches?|hamburguer(?:es)?|burgers?)\b/.test(normalized)) return /lanche|hamburguer|burger|sanduiche/.test(group);
        return true;
      };
      const budget=normalized.match(/\b(ate|menos de|no maximo) (?:r )?(\d{1,4})(?: (\d{2}))?\b/);
      if (budget) {
        const limit=Number(budget[2])*100+Number(budget[3]||0);
        const results=products.filter(product=>inCategory(product)&&(budget[1]==='menos de'?price(product)<limit:price(product)<=limit));
        results.sort((a,b)=>price(a)-price(b));
        return listProducts(results,'Opções '+(budget[1]==='menos de'?'abaixo de ':'de até ')+brl(limit)+', antes da entrega:',
          'Não encontrei uma opção disponível nessa faixa do cardápio.');
      }
      if (/\b(?:mais barato|mais barata|mais em conta|menor preco|mais baratos|mais baratas|recomenda|indicaria|sugere)\b/.test(normalized)) {
        const results=products.filter(inCategory).sort((a,b)=>price(a)-price(b)).slice(0,4);
        return listProducts(results,'Algumas das opções mais em conta agora:','Essa parte do cardápio está sem itens disponíveis agora.');
      }
      const ingredient=normalized.match(/^(?:(?:quais|qual|que) (?:os |as )?(?:itens|lanches|hamburgueres|combos) (?:que )?(?:tem|levam|vem com)|(?:tem|voces tem) (?:algum |alguma )?(?:lanche|hamburguer|combo|opcao) com|(?:quero ver|mostra|me mostra) (?:os |as )?(?:lanches|combos|opcoes) com) (.+?)(?: por favor)?$/)?.[1];
      if (ingredient) {
        const results=products.filter(product=>inCategory(product)&&includes(product.description||product.desc,ingredient));
        return listProducts(results,'O cardápio menciona '+ingredient+' nestes itens:',
          'Não encontrei '+ingredient+' nas descrições desses itens. A equipe pode confirmar a composição.');
      }
      if (category && (normalize(category)===normalized || /\b(?:quais|qual|ver|mostrar|mostra|tem|manda|lista|opcoes|cardapio)\b/.test(normalized))) {
        return showCategory(category);
      }
      if (/^(?:(?:quais|qual) (?:sao )?(?:os |as )?|(?:tem|ver|listar|mostrar) )?(?:opcoes de )?(?:adicionais|extras)(?: disponiveis)?$/.test(normalized)) {
        const relevant=products.find(product=>product.id===productContext)||
          (draft.items.length===1?products.find(product=>product.id===draft.items[0].product_id):null);
        if (relevant) {describe(relevant,true);return true;}
        say('Os adicionais e os preços variam por item. De qual lanche ou combo você quer ver as opções?');
        buttons(footer());
        return true;
      }
      return false;
    }
    function showSuggestions(products,quantity,wantsToOrder,message) {
      say('Encontrei estas opções no cardápio. Qual delas você quis dizer?');
      buttons(footer(products.map(product=>[productDetails(product),()=>{
        if (wantsToOrder&&available(product)) {
          pendingChoices=[{entries:[product],qty:quantity||1,message}];
          return continueAdding();
        }
        return describe(product,false);
      }])));
    }

    function estimateProducts(matches,text) {
      if (matches.length!==1 || matches[0].entries.length!==1) return false;
      const {entries:[product],qty}=matches[0];
      if (!available(product) || (product.stock_enabled&&qty>Number(product.stock_quantity))) return false;
      const drinks=window.CaseiraoComboDrinks?.options(catalog,product.id)||[];
      if (drinks.length) return false;
      const {extras}=itemCustomizations(text);
      const {matches:addons,unknown}=requestedExtras(extras,linkedAddons(product).filter(available));
      if (unknown.length || (qty===1&&!addons.length)) return false;
      const lines=[qty+'× '+product.name+' · '+brl(price(product)*qty)];
      for (const addon of addons) lines.push('+ '+qty+'× '+addon.name+' · '+brl(cents(addon.price)*qty));
      const total=qty*(price(product)+addons.reduce((sum,addon)=>sum+cents(addon.price),0));
      say([...lines,'Subtotal da simulação: '+brl(total)+' antes da taxa de entrega.'].join('\n'));
      buttons(footer([['Adicionar ao pedido',()=>addProduct(product,qty,text)]]));
      return true;
    }

    function aiContext(message,hasOrder) {
      return {
        message,recent:recentMenuMessage,hasOrder,step:step||mode,
        focus:productContext==null?'':String(productContext),
        cart:draft.items.map(line=>({product:String(line.product_id),quantity:line.qty,options:line.addon_ids.map(String)})),
        neighborhoods:catalog.neighborhoods.map(hood=>hood.name),
        menu:catalog.products.map(product=>{
          const drinks=window.CaseiraoComboDrinks?.options(catalog,product.id)||[];
          const options=linkedAddons(product).filter(addon=>available(addon)&&!window.CaseiraoComboDrinks?.includes(addon.id));
          return {id:String(product.id),name:product.name,category:product.category,
            description:String(product.description||product.desc||'').slice(0,260),
            price:price(product),available:available(product),options:[
              ...options.map(addon=>[String(addon.id),addon.name,cents(addon.price)]),
              ...drinks.filter(drink=>drink.available).map(drink=>[String(drink.id),drink.name,cents(drink.addon?.price),'bebida']),
            ]};
        }),
      };
    }
    function resolveAiLines(rows,text) {
      if (!Array.isArray(rows)||!rows.length||rows.length>12) return null;
      const parsed=[];
      for (const row of rows) {
        const product=catalog.products.find(item=>String(item.id)===row?.product);
        const qty=row?.quantity;
        if (!product||!Number.isInteger(qty)||qty<1||qty>30||!Array.isArray(row.options)||row.options.length>12||
            !Array.isArray(row.removals)||row.removals.length>8) return null;
        const drinks=window.CaseiraoComboDrinks?.options(catalog,product.id)||[];
        const options=linkedAddons(product).filter(addon=>available(addon)&&!window.CaseiraoComboDrinks?.includes(addon.id));
        const matches=[],unknown=[],notes=[];
        for (const id of new Set(row.options)) {
          if (typeof id!=='string') return null;
          const match=[...options,...drinks.filter(drink=>drink.available)].find(option=>String(option.id)===id);
          if (match) matches.push(match);
          else if (id.startsWith('?:')&&includes(text,id.slice(2))) unknown.push(id.slice(2,82));
          else return null;
        }
        for (const ingredient of new Set(row.removals)) {
          if (typeof ingredient!=='string'||ingredient.length>55||!includes(text,ingredient)||
              !/^[\p{L}\p{M}\s-]+$/u.test(ingredient)) return null;
          notes.push('sem '+ingredient.trim());
        }
        const note=notes.join(', ');
        if (note.length>160) return null;
        parsed.push({entries:[product],qty,message:'',customizations:{note,matches,unknown,drinks}});
      }
      return parsed;
    }
    function quoteAiLines(lines) {
      const displayed=[];
      let total=0;
      const quantities=new Map();
      for (const {entries:[product],qty} of lines) quantities.set(product.id,(quantities.get(product.id)||0)+qty);
      for (const {entries:[product],qty,customizations:{note,matches,unknown,drinks}} of lines) {
        if (!available(product)||(product.stock_enabled&&quantities.get(product.id)>Number(product.stock_quantity))) {
          return say('Não há unidades suficientes de '+product.name+' para essa combinação agora.');
        }
        if (unknown.length||drinks.length&&matches.filter(item=>drinks.includes(item)).length!==1) {
          return describe(product,true);
        }
        displayed.push(qty+'× '+product.name+' · '+brl(qty*price(product)));
        total+=qty*price(product);
        for (const option of matches) {
          const value=qty*cents(option.addon?.price??option.price);
          total+=value;
          displayed.push('+ '+qty+'× '+option.name+' · '+brl(value));
        }
        if (note) displayed.push('Observação: '+note);
      }
      say([...displayed,'Subtotal da simulação: '+brl(total)+' antes da taxa de entrega.'].join('\n'));
    }
    function hours() {
      const times=[catalog.settings.open_time,catalog.settings.close_time].map(value=>String(value||'').slice(0,5));
      say((catalog.settings.store_open?'O Caseirão está aberto agora.':'O Caseirão está fechado agora.')+
        (times.every(Boolean)?' Horário informado: '+times.join(' às ')+'.':''));
    }
    async function useAi(text,wantsToOrder) {
      const ai=window.caseiraoAssistantAI;
      if (!ai?.eligible(text)) return false;
      const actions=await ai.interpret(aiContext(text,Boolean(trackingCredentials())));
      const normalized=normalize(text);
      let handled=false;
      let added=false;
      for (const action of actions) {
        if (!host.open) return true;
        const query=typeof action?.query==='string'?action.query:'';
        switch (action?.intent) {
          case 'add': {
            if (receipt||!wantsToOrder||added||hasPendingItemChoice()||
                /\b(?:nao (?:quero|manda|envia|coloca|bota)|se (?:eu |voce )?(?:pedir|comprar|colocar))\b/.test(normalized)) continue;
            const lines=resolveAiLines(action.lines,text);
            if (!lines) return handled;
            const quantities=new Map();
            for (const line of draft.items) quantities.set(line.product_id,(quantities.get(line.product_id)||0)+line.qty);
            for (const {entries:[product],qty} of lines) quantities.set(product.id,(quantities.get(product.id)||0)+qty);
            if (lines.some(({entries:[product]})=>!available(product)||
                product.stock_enabled&&quantities.get(product.id)>Number(product.stock_quantity))) {
              say('Um dos itens não está disponível agora. Confira as opções para ajustar sua escolha.');
              return showMenu().then(()=>true);
            }
            if (draft.items.length+lines.reduce((count,line)=>count+Math.max(1,Math.min(line.qty,line.customizations.drinks.length)),0)>30) {
              offerHelp('Seu pedido atingiu o limite de itens. A equipe pode ajudar.');
              return true;
            }
            pickupDetails(text);
            suggestedQuantity=0;
            productContext=lines.length===1?lines[0].entries[0].id:null;
            mode='items';step='';
            finishRequested=Boolean(draft.type);
            pendingChoices=lines;
            await continueAdding();
            added=true;
            break;
          }
          case 'quote': {
            const lines=resolveAiLines(action.lines,text);
            if (!lines) continue;
            quoteAiLines(lines);
            break;
          }
          case 'products': {
            if (!Array.isArray(action.products)) continue;
            const products=[...new Set(action.products)].slice(0,6)
              .map(id=>catalog.products.find(product=>String(product.id)===id)).filter(Boolean);
            if (!products.length) say('Não encontrei uma opção assim no cardápio de hoje.');
            const keep=receipt||mode==='checkout'||hasPendingItemChoice();
            for (const product of products) describe(product,false,!keep);
            if (products.length>1) {
              productContext=null;
              if (!keep) buttons(footer(products.filter(available).map(product=>['Adicionar '+product.name,()=>addProduct(product,1,'')])));
            }
            break;
          }
          case 'menu': if (receipt) continue; await showMenu(); break;
          case 'offers': {
            const promos=catalog.products.filter(product=>available(product)&&Number(product.promo_price)>0);
            say(promos.length?promos.map(productDetails).join('\n'):'O cardápio está sem produtos em promoção agora.');
            break;
          }
          case 'hours': hours(); break;
          case 'delivery': {
            const hood=catalog.neighborhoods.find(item=>normalize(item.name)===normalize(query));
            if (hood) {
              checkingFee=false;
              say('Entregamos em '+hood.name+'. A taxa é de '+brl(cents(hood.fee))+'.');
            } else if (receipt) say('A taxa de entrega depende do bairro.');
            else storeQuestion('taxa de entrega');
            break;
          }
          case 'eta': {
            const {settings}=catalog;
            if (query==='retirada') {
              const eta=settings.peak_mode?settings.peak_pickup_eta:settings.pickup_eta;
              say(eta?'A previsão de retirada informada no cardápio é de '+eta+'.':'A previsão de retirada ainda não está informada no cardápio.');
            } else {
              const eta=settings.peak_mode?settings.peak_delivery_eta:settings.delivery_eta;
              say(eta?'A previsão geral de entrega informada no cardápio é de '+eta+'.':'A previsão de entrega ainda não está informada no cardápio.');
            }
            break;
          }
          case 'payments': say('Você pode escolher Pix, cartão ou dinheiro ao finalizar o pedido.'); break;
          case 'address': {
            const place=document.querySelector('#storeLocationBtn strong')?.textContent;
            say(place?'O Caseirão fica em '+place+', Campo Maior–PI.':'A localização está no topo do cardápio.');
            break;
          }
          case 'track': await offerTracking(); break;
          case 'delay': await offerTracking('delay'); break;
          case 'handoff': offerHelp('Nossa equipe pode conferir isso pra você. Toque abaixo para abrir o atendimento.',true); break;
          case 'thanks': say(receipt?'Obrigado por pedir no Caseirão! 😊':'De nada! Se precisar de mais alguma coisa, é só falar.'); break;
          case 'greet': if (!replyGreeting) say('Oi! Tudo bem? Como posso te ajudar?'); else continue; break;
          case 'cart':
            if (receipt || hasPendingItemChoice()) continue;
            if (draft.items.length) await review(false,true);
            else say('Seu pedido ainda está vazio. Quer ver o cardápio?');
            break;
          case 'checkout':
            if (receipt||!draft.items.length||hasPendingItemChoice()||!/\b(?:finaliza|finalizar|fechar|fecha|terminar|so isso|e so)\b/.test(normalized)) continue;
            await proceed(true);
            break;
          default: continue;
        }
        handled=true;
      }
      if (handled) recentMenuMessage=text;
      return handled;
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
      if (editScope) {
        if (/^(?:em )?(?:so |apenas )?(?:um|uma|1)(?: so| apenas| deles| delas)?$/.test(normalized)) return editScope.one();
        if (/^(?:em )?(?:todos|todas|os dois|as duas|ambos|ambas)$/.test(normalized)) return editScope.all();
        if (!orderPrice.test(normalized)&&!orderSummary.test(normalized)) editScope=null;
      }
      const wantsToOrder=orderIntent(normalized)&&!/^(?:me (?:manda|da|ve) |manda |quero |queria )?(?:saber|ver|comparar|o preco|o valor|os ingredientes|os adicionais)\b/.test(normalized);
      const addingExtras=/\bcom (?:os |uns )?adicionais de\b/.test(normalized)&&!/\b(?:quanto|valor|preco|custa|quais|opcoes)\b/.test(normalized);
      const asks=inquiryIntent(normalized)&&!wantsToOrder&&!addingExtras;
      if (/\b(falar com (a equipe|alguem|uma pessoa)|atendente|atendimento humano)\b/.test(normalized)) return handoff();
      if (thankYou.test(normalized)) {
        if (receipt||/chegou|pelo pedido|delicia|parabens/.test(normalized)) return say('Obrigado por pedir no Caseirão! 😊');
        return say('De nada! Se precisar de mais alguma coisa, é só falar.');
      }
      if (delayQuestion.test(normalized)) return offerTracking('delay');
      if (trackingCodeQuestion.test(normalized)) return offerTracking('code');
      if (trackingQuestion.test(normalize(text))||quickTracking.test(normalized)) return offerTracking();
      if (/\b(?:veio (?:faltando|errado|frio)|esqueceram|mandaram errado|item faltando|reembolso|estorno|cancelar (?:meu |o )?pedido|pix (?:nao caiu|nao confirmou)|pedido errado)\b/.test(normalized)) {
        return offerHelp('A equipe do Caseirão pode conferir o que aconteceu. Toque abaixo para abrir o atendimento.',true);
      }
      if (/\b(?:alergia|alergico|alergica|celiaco|celiaca|contaminacao cruzada|intolerancia)\b/.test(normalized)) {
        return offerHelp('A equipe pode confirmar os ingredientes e como o pedido é preparado. Toque abaixo para falar com a gente.');
      }
      if (receipt&&normalized==='novo pedido') {savePix(null);return reset();}
      if (/\b(mudar (meu|os) dados|corrigir dados)\b/.test(normalized)&&draft.items.length) return editDetails();
      if (!receipt&&(orderPrice.test(normalized)||orderSummary.test(normalized))) {
        if (hasPendingItemChoice()) {
          if (draft.items.length) await review(false,true);
          say('A opção pendente acima ainda precisa ser escolhida para entrar no pedido.');
          return;
        }
        if (draft.items.length) return review(false,Boolean(step||editScope));
        if (orderSummary.test(normalized)) return say('Seu pedido está vazio. Pode escrever o nome de um item para começar.');
        if (productContext!==null) {
          await latest();
          const product=catalog.products.find(item=>item.id===productContext);
          if (product) return describe(product,false);
        }
        say('Qual item do cardápio você quer consultar?');
        return;
      }
      if (step==='confirm'&&/^(sim|confirmo|confirmar|pode enviar|pode mandar)$/.test(normalized)) {
        say('Pra registrar, toque no botão Confirmar pedido.');
        return;
      }
      if (!receipt&&/^(?:(?:quero|vou|pode|vamos) )?(?:(?:finalizar|fechar|terminar)(?: (?:meu|o))?(?: pedido)?|so isso|e so)(?: por favor)?$/.test(normalized)) return proceed(true);
      const requestMenu=/^(cardapio|menu|(?:ver|manda|mandar|mostra|mostrar|me manda) (?:o )?cardapio)\b/.test(normalized);
      const faq=/\b(alergia|alergico|alergica|celiaco|celiaca|contaminacao cruzada|quanto tempo|qual o prazo|demora quanto|previsao de entrega|tempo de entrega|onde fica|como chegar|localizacao da loja|horario|que horas|qual o endereco|aberto|fechado|funcionando)\b/.test(normalized) ||
        deliveryQuestion.test(normalized) ||
        /^(?:voces )?(aceita|aceitam|recebe|recebem|quais|como|pode|da pra|tem)\b.*\b(pagamento|pagar|pix|cartao|dinheiro)\b/.test(normalized);
      const catalogInquiry=/\b(?:ate|menos de|no maximo|mais barat[oa]s?|mais em conta|recomenda|indicaria|sugere|compare|diferenca)\b/.test(normalized);
      const editIntent=/^(?:(?:pode|consegue|quero) )?(?:tirar?|retirar?|remover?|deixar?|trocar?|colocar?|botar?|adicionar?)\b/.test(normalized);
      const question=asks||requestMenu||faq||checkingFee||catalogInquiry;
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
      if (mode==='checkout'&&step!=='confirm'&&!question&&!wantsToOrder&&!editIntent) {
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
      if ((receipt||mode!=='checkout')&&!hasPendingItemChoice()&&!checkingFee&&!(editIntent&&draft.items.length)&&await useAi(text,wantsToOrder)) return;
      if (receipt) {
        if (/\b(aberto|fechado|funcionando|horario|que horas)\b/.test(normalized)) return hours();
        return say('Seu pedido #'+receipt.order_number+' já foi registrado. Você pode acompanhar ou começar outro pedido pelos botões.');
      }
      if (editIntent) {
        const edited=editOrder(normalized);
        if (edited) return edited;
      }
      if (await catalogQuestion(normalized)) return;
      if (storeQuestion(normalized)) return;
      if (/\b(aberto|fechado|funcionando|horario|que horas)\b/.test(normalized)&&!wantsToOrder) {
        hours();
        return buttons(footer([['Ver cardápio',()=>showMenu()]]));
      }
      if (/\b(promocao|promocoes|oferta|ofertas)\b/.test(normalized)&&!matchingProducts(text,catalog.products).length) {
        const promos=catalog.products.filter(product=>available(product)&&Number(product.promo_price)>0);
        say(promos.length?promos.map(productDetails).join('\n'):'O cardápio está sem produtos em promoção agora.');
        return buttons(footer([['Ver cardápio',()=>showMenu()],['Fazer pedido',()=>beginOrder()]]));
      }
      if (requestMenu) return showMenu();

      const clauses=text.split(/[!?]+\s*|\.\s+(?=[\p{L}])/u).filter(part=>part.trim());
      const adding=[];
      const describing=new Map();
      for (const clause of clauses) {
        const context=conversational(clause);
        const names=matchingProducts(clause,catalog.products);
        const matches=names.length?names:matchingProducts(clause,catalog.products,true);
        const priceInquiry=/\b(quanto|valor|preco|custa)\b/.test(context);
        const clauseQuestion=(inquiryIntent(context)&&!orderIntent(context)&&!addingExtras)||priceInquiry||asks;
        if (clauseQuestion) {
          if (clauses.length===1&&priceInquiry&&estimateProducts(matches,clause)) return;
          for(const match of matches) for(const product of match.entries) describing.set(product.id,product);
          continue;
        }
        if (asks&&!wantsToOrder) continue;
        const segments=matches.length>1?orderSegments(clause,catalog.products):[clause];
        for (const segment of segments) {
          const match=matchingProducts(segment,catalog.products)[0]||matchingProducts(segment,catalog.products,true)[0];
          if (match) adding.push({...match,message:segment});
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
      const leadingQuantity=normalized.match(/^(?:(?:eu )?quero |me ve |manda )?(um|uma|dois|duas|tres|quatro|cinco|\d{1,2})\b/)?.[1];
      if (suggestions.length) return showSuggestions(suggestions,Math.min(30,Number(numberWords[leadingQuantity]||leadingQuantity||suggestedQuantity||1)),!question&&(wantsToOrder||mode==='items'),text);
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
      say(draft.items.length
        ?'Seu pedido continua anotado aqui. Pode pedir o total, dizer o que quer mudar ou chamar a equipe.'
        :'Pode me dizer o nome de um lanche ou perguntar, por exemplo, “quais combos têm hoje?” ou “quanto é a taxa de entrega?”.');
      buttons(draft.items.length?footer([['Ver cardápio',()=>showMenu()]]):nav());
    }
    function reset() {
      for(const key of Object.keys(draft)) delete draft[key];
      Object.assign(draft,{items:[],address:{},requestId:crypto.randomUUID()});
      history.length=0; log.replaceChildren();
      mode='home';step='';receipt=null;quote=null;focusProduct=null;pendingChoices=[];finishRequested=false;
      suggestedQuantity=0;productContext=null;checkingFee=false;editScope=null;
      recentMenuMessage='';
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
      void run(async()=>{
        const originalStep=step;
        const originalButtons=[...actions.querySelectorAll('button')];
        const originalLayout=actions.dataset.layout;
        await handle(text);
        if (originalStep&&originalStep===step&&originalButtons.length&&
            originalButtons.some(button=>button.textContent==='Confirmar pedido')&&
            ![...actions.querySelectorAll('button')].some(button=>button.textContent==='Confirmar pedido')) {
          actions.replaceChildren(...originalButtons);
          actions.dataset.layout=originalLayout;
        }
      },Math.min(1050,560+text.length*4));
    }
    reset();
    return {submit,reset};
  }

  window.caseiraoOrderAssistant={create};
})();
