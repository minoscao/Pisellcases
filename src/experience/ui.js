export const $=selector=>document.querySelector(selector);
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function button(label,className,action){const b=document.createElement('button');b.className=className;b.textContent=label;b.addEventListener('click',action);return b;}
export function entityCard({image,title,subtitle,meta,onClick}){const card=button('','entity-card',onClick);card.setAttribute('aria-label',`Open ${title}`);if(image)card.append(photo(image,title));const copy=document.createElement('span');copy.className='card-copy';for(const [tag,text,cls] of [['small',subtitle,''],['strong',title,''],['span',meta,'card-area']]){const node=document.createElement(tag);node.className=cls;node.textContent=text||'';copy.append(node);}card.append(copy);return card;}
export function photo(src,alt='',className=''){const image=new Image();image.src=src;image.alt=alt;image.className=className;image.draggable=false;image.addEventListener('error',()=>{image.hidden=true;const text=document.createElement('span');text.className='no-photo';text.textContent='Photo unavailable';image.after(text);},{once:true});return image;}
let toastTimer;
export function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('visible'),3300);}
export function openModal(id){const modal=$('#'+id);if(!modal.open)modal.showModal();}
export function closeModal(id){$('#'+id).close();}
document.addEventListener('click',event=>{const target=event.target.closest('[data-close]');if(target)closeModal(target.dataset.close);});
