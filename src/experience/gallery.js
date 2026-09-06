import {state,update} from './store.js';
import {regionById,areaText,locationText} from './config.js';
import {$,photo,button,openModal,closeModal} from './ui.js';
export function createGallery(onClose){
  let current=null,cards=[],thumbs=[],start=null,swiped=false;
  function paint(){const total=cards.length;
    cards.forEach((card,i)=>{let delta=(i-state.photo+total)%total;if(delta>total/2)delta-=total;const cls=delta===0?'is-current':delta===-1?'is-prev':delta===1?'is-next':delta<0?'is-hidden-left':'is-hidden-right';card.className='gallery-card '+cls;card.tabIndex=delta===0?0:-1;card.setAttribute('aria-hidden',Math.abs(delta)>1?'true':'false');thumbs[i].setAttribute('aria-pressed',String(i===state.photo));});
    $('#photo-count').textContent=total?`${String(state.photo+1).padStart(2,'0')} / ${String(total).padStart(2,'0')}`:'00 / 00';$('#photo-prev').disabled=total<2;$('#photo-next').disabled=total<2;
  }
  function shift(direction){if(!current?.photos.length)return;update({photo:(state.photo+direction+current.photos.length)%current.photos.length});paint();}
  function open(item){current=item;update({caseId:item.id,photo:0,view:'gallery'});$('#gallery-title').textContent=item.title;$('#gallery-location').textContent=`${regionById[item.continent]?.en} / ${locationText(item)}`;$('#gallery-description').textContent=item.description||'';
    const facts=item.address?[['Address',item.address],['Location',item.locationPrecision]]:[['Country',item.country],['Year',item.year||'Not provided'],['Floor area',areaText(item.area)]];$('#gallery-facts').replaceChildren(...facts.map(([label,value])=>{const div=document.createElement('div'),small=document.createElement('small');small.textContent=label;div.append(small,document.createTextNode(value));return div;}));
    document.getElementById('gallery-links')?.remove();if(item.sourceUrl){const links=document.createElement('nav');links.id='gallery-links';links.setAttribute('aria-label','Business sources');for(const [label,url] of [['Directions ↗',`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.address+' '+item.country)}`],['Business source ↗',item.sourceUrl],['Image source ↗',item.photoCredits?.[0]?.source]]){if(!url)continue;const a=document.createElement('a');a.textContent=label;a.href=url;a.target='_blank';a.rel='noopener';links.append(a);}document.querySelector('.gallery-heading').append(links);}
    cards=item.photos.map((src,i)=>{const card=button('','gallery-card',()=>{if(!swiped){update({photo:i});paint();}});card.setAttribute('aria-label',`${item.title} · Photos ${i+1}`);card.append(photo(src,`${item.title} Photos ${i+1}`));const label=document.createElement('span');label.className='photo-label';const title=document.createElement('span'),count=document.createElement('span');title.textContent=item.title.toUpperCase();count.textContent=String(i+1).padStart(2,'0');label.append(title,count);card.append(label);return card;});
    thumbs=item.photos.map((src,i)=>{const b=button('','',()=>{update({photo:i});paint();});b.setAttribute('aria-label',`Go to photo ${i+1}`);b.append(photo(src));return b;});$('#gallery-stage').replaceChildren(...cards);$('#gallery-thumbs').replaceChildren(...thumbs);
    if(!cards.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No photos yet. Add photos in the Case editor.';$('#gallery-stage').append(empty);}paint();openModal('gallery');
  }
  $('#photo-prev').onclick=()=>shift(-1);$('#photo-next').onclick=()=>shift(1);$('#close-gallery').onclick=()=>closeModal('gallery');
  $('#gallery').addEventListener('close',()=>{update({view:'atlas',caseId:null});onClose();});
  $('#gallery').addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();shift(e.key==='ArrowLeft'?-1:1);}});
  $('#gallery-stage').addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};swiped=false;$('#gallery-stage').setPointerCapture(e.pointerId);});
  $('#gallery-stage').addEventListener('pointerup',e=>{if(start){const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){swiped=true;shift(dx<0?1:-1);}start=null;}});
  $('#gallery-stage').addEventListener('pointercancel',()=>{start=null;});return{open};
}
