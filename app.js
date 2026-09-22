(()=>{'use strict';
const FN='https://jhvtjhjzlljqfzdccrxc.supabase.co/functions/v1/';
const $=s=>document.querySelector(s);
const money=v=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
let data={settings:{},products:[],neighborhoods:[],addons:[],product_addons:[],coupons:[]},cart=[],cat='Todos',search='',orderType='delivery';

async function api(slug,opts={}){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
 try{
  const r=await fetch(FN+slug,{cache:'no-store',...opts,signal:ctl.signal});
  let j={}; try{j=await r.json()}catch{}
  if(!r.ok||j.error)throw new Error(j.error||`Erro ${r.status}`);
  return j;
 }catch(e){if(e.name==='AbortError')throw new Error('Servidor demorou para responder. Tente novamente.');throw e}
 finally{clearTimeout(timer)}
}
function price(p){return Number(p.promo_price)>0?Number(p.promo_price):Number(p.price||0)}
function count(){return cart.reduce((s,x)=>s+x.qty,0)}
function subtotal(){return cart.reduce((s,x)=>s+(price(x.product)+x.addons.reduce((a,b)=>a+Number(b.price||0),0))*x.qty,0)}
function updateCart(){ $('#cartLabel').textContent=`Carrinho • ${count()} ${count()===1?'item':'itens'}`;$('#cartTotal').textContent=money(subtotal())}
function modal(html){$('#modal').innerHTML=`<div class="overlay"><section class="sheet">${html}</section></div>`;$('#modal .overlay').onclick=e=>{if(e.target.classList.contains('overlay'))closeModal()};document.querySelectorAll('[data-close]').forEach(x=>x.onclick=closeModal)}
function closeModal(){$('#modal').innerHTML=''}

async function loadCatalog(){
 try{
  data=await api('catalog');
  if(!Array.isArray(data.products))throw new Error('Resposta do catálogo inválida.');
  render();
 }catch(e){
  $('#storeStatus').textContent='Erro ao carregar';$('#storeStatus').className='closed';
  $('#products').innerHTML=`<div class="empty"><b>Não foi possível carregar o cardápio.</b><div class="error">${esc(e.message)}</div><button class="primary" id="retry">Tentar novamente</button></div>`;
  $('#retry').onclick=loadCatalog;
 }
}
function render(){
 const s=data.settings||{},open=!!s.store_open;
 $('#storeName').textContent=s.store_name||'O Caseirão Burger';
 $('#storeStatus').textContent=open?(s.status_text||'Aberto'):'Fechado no momento';$('#storeStatus').className=open?'open':'closed';
 const bn=$('#banner'),img=String(s.banner_image_url||''),txt=String(s.banner_text||'');
 if(s.banner_active&&(img||txt)){bn.innerHTML=(img?`<img src="${esc(img)}" alt="Banner">`:'')+(txt?`<p>${esc(txt)}</p>`:'');bn.classList.remove('hidden')}else bn.classList.add('hidden');
 const cats=['Todos',...new Set(data.products.filter(p=>p.active!==false).map(p=>p.category||'Outros'))];
 $('#cats').innerHTML=cats.map(c=>`<button class="chip ${c===cat?'on':''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('');
 document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{cat=b.dataset.cat;render()});
 const q=search.trim().toLowerCase();
 const list=data.products.filter(p=>p.active!==false&&(cat==='Todos'||(p.category||'Outros')===cat)&&(!q||(p.name+' '+(p.description||'')).toLowerCase().includes(q)));
 $('#products').innerHTML=list.length?list.map(p=>`<article class="card"><div class="pic">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:'SEM FOTO'}</div><div class="body"><div class="name">${esc(p.name)}</div><div class="desc">${esc(p.description||'')}</div><div class="price">${Number(p.promo_price)>0?`<span class="old">${money(p.price)}</span>`:''}${money(price(p))}</div><button class="primary" data-add="${p.id}">Adicionar</button></div></article>`).join(''):'<div class="empty">Nenhum produto encontrado.</div>';
 document.querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>openProduct(b.dataset.add));
 updateCart();
}
function allowed(p){const ids=new Set(data.product_addons.filter(x=>String(x.product_id)===String(p.id)).map(x=>String(x.addon_id)));return data.addons.filter(a=>a.active!==false&&ids.has(String(a.id)))}
function openProduct(id){
 const p=data.products.find(x=>String(x.id)===String(id));if(!p)return;const adds=allowed(p);
 modal(`<div class="head"><h2>${esc(p.name)}</h2><button class="x" data-close>×</button></div><p>${esc(p.description||'')}</p><div class="field"><label>Adicionais</label>${adds.length?adds.map(a=>`<label class="addon"><input type="checkbox" data-addon="${a.id}"><span class="grow">${esc(a.name)}</span><b>+ ${money(a.price)}</b></label>`).join(''):'<div class="notice">Sem adicionais.</div>'}</div><div class="field"><label>Observação</label><textarea id="itemNote" class="textarea"></textarea></div><button id="confirmAdd" class="primary">Adicionar • ${money(price(p))}</button>`);
 $('#confirmAdd').onclick=()=>{const chosen=[...document.querySelectorAll('[data-addon]:checked')].map(i=>data.addons.find(a=>String(a.id)===String(i.dataset.addon))).filter(Boolean);cart.push({key:crypto.randomUUID(),product:p,addons:chosen,note:$('#itemNote').value.trim(),qty:1});updateCart();closeModal()}
}
function renderCart(){
 modal(`<div class="head"><h2>Seu pedido</h2><button class="x" data-close>×</button></div><div id="lines"></div><div class="sum"><div class="sumrow total"><span>Subtotal</span><b>${money(subtotal())}</b></div></div><button id="checkout" class="primary" ${cart.length?'':'disabled'}>Continuar</button>`);
 $('#lines').innerHTML=cart.length?cart.map(x=>`<div class="line"><div class="grow"><b>${esc(x.product.name)}</b><small>${x.addons.length?'<br>'+x.addons.map(a=>esc(a.name)).join(', '):''}</small></div><div class="qty"><button data-q="${x.key}" data-d="-1">−</button><b>${x.qty}</b><button data-q="${x.key}" data-d="1">+</button></div></div>`).join(''):'<div class="empty">Carrinho vazio.</div>';
 document.querySelectorAll('[data-q]').forEach(b=>b.onclick=()=>{const x=cart.find(i=>i.key===b.dataset.q);if(!x)return;x.qty+=Number(b.dataset.d);if(x.qty<=0)cart=cart.filter(i=>i.key!==x.key);updateCart();renderCart()});
 $('#checkout').onclick=openCheckout;
}
function fee(){if(orderType!=='delivery')return 0;return Number(data.neighborhoods.find(n=>String(n.id)===String($('#hood')?.value))?.fee||0)}
function openCheckout(){
 const h=data.neighborhoods.filter(n=>n.active!==false);
 modal(`<div class="head"><h2>Finalizar pedido</h2><button class="x" data-close>×</button></div><div class="seg"><button data-type="delivery">Entrega</button><button data-type="pickup">Retirada</button><button data-type="local">No local</button></div><div class="field"><label>Nome</label><input id="name" class="input"></div><div class="field"><label>WhatsApp</label><input id="phone" class="input" inputmode="tel"></div><div id="address"></div><div class="field"><label>Pagamento</label><select id="payment" class="select"><option>Pix</option><option>Dinheiro</option><option>Cartão</option></select></div><div class="field"><label>Troco para</label><input id="change" class="input" placeholder="Ex.: 50,00"></div><div class="field"><label>Observações</label><textarea id="notes" class="textarea"></textarea></div><div id="sum" class="sum"></div><button id="send" class="primary">Confirmar e enviar</button>`);
 document.querySelectorAll('[data-type]').forEach(b=>{b.classList.toggle('on',b.dataset.type===orderType);b.onclick=()=>{orderType=b.dataset.type;openCheckout()}});
 if(orderType==='delivery')$('#address').innerHTML=`<div class="field"><label>Rua</label><input id="street" class="input"></div><div class="field"><label>Número</label><input id="number" class="input"></div><div class="field"><label>Bairro</label><select id="hood" class="select"><option value="">Selecione</option>${h.map(n=>`<option value="${n.id}">${esc(n.name)} • ${money(n.fee)}</option>`).join('')}</select></div><div class="field"><label>Complemento / referência</label><input id="reference" class="input"></div>`;
 const draw=()=>$('#sum').innerHTML=`<div class="sumrow"><span>Produtos</span><b>${money(subtotal())}</b></div><div class="sumrow"><span>Entrega</span><b>${money(fee())}</b></div><div class="sumrow total"><span>Total</span><b>${money(subtotal()+fee())}</b></div>`;
 $('#hood')?.addEventListener('change',draw);draw();$('#send').onclick=sendOrder;
}
async function sendOrder(){
 const btn=$('#send');try{
  const name=$('#name').value.trim(),phone=$('#phone').value.trim();if(name.length<2)throw new Error('Informe seu nome.');if(phone.replace(/\D/g,'').length<10)throw new Error('Informe um WhatsApp válido.');
  const payload={client_request_id:crypto.randomUUID(),customer:{name,phone},type:orderType,payment:$('#payment').value,change_for:$('#change').value.trim(),notes:$('#notes').value.trim(),items:cart.map(x=>({product_id:x.product.id,qty:x.qty,addon_ids:x.addons.map(a=>a.id),note:x.note}))};
  if(orderType==='delivery'){payload.address={street:$('#street').value.trim(),number:$('#number').value.trim(),neighborhood_id:$('#hood').value,reference:$('#reference').value.trim()};if(!payload.address.street||!payload.address.number||!payload.address.neighborhood_id)throw new Error('Preencha rua, número e bairro.')}
  btn.disabled=true;btn.textContent='Enviando…';const j=await api('create-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  localStorage.setItem('caseirao_last_tracking',JSON.stringify({tracking_code:j.tracking_code,phone}));cart=[];updateCart();modal(`<div class="head"><h2>Pedido recebido ✅</h2><button class="x" data-close>×</button></div><div class="success">Pedido <b>#${j.order_number}</b><br>Total: <b>${money(j.total)}</b><br>Previsão: <b>${esc(j.eta_text||'a confirmar')}</b></div><button id="trackNow" class="primary">Acompanhar pedido</button>`);$('#trackNow').onclick=()=>openTracking(j.tracking_code,phone);
 }catch(e){alert(e.message||String(e));if(btn){btn.disabled=false;btn.textContent='Confirmar e enviar'}}
}
function openTracking(code='',phone=''){
 let saved={};try{saved=JSON.parse(localStorage.getItem('caseirao_last_tracking')||'{}')}catch{}
 modal(`<div class="head"><h2>Acompanhar pedido</h2><button class="x" data-close>×</button></div><div class="field"><label>Código</label><input id="tcode" class="input" value="${esc(code||saved.tracking_code||'')}"></div><div class="field"><label>Telefone</label><input id="tphone" class="input" value="${esc(phone||saved.phone||'')}"></div><button id="track" class="primary">Consultar</button><div id="trackResult"></div>`);
 $('#track').onclick=async()=>{try{const j=await api('track-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tracking_code:$('#tcode').value.trim(),phone:$('#tphone').value.trim()})});$('#trackResult').innerHTML=`<div class="success"><b>Pedido #${j.order.order_number}</b><br>Status: <b>${esc(j.order.status)}</b><br>Total: <b>${money(j.order.total)}</b></div>`}catch(e){$('#trackResult').innerHTML=`<div class="error">${esc(e.message)}</div>`}};
}
$('#search').oninput=e=>{search=e.target.value;render()};
$('#cartBtn').onclick=renderCart;$('#trackBtn').onclick=()=>openTracking();
loadCatalog();
})();