import {createLocationMap} from '../web/customer-map.js';
import {config,copy,regions,regionById,summary,formatNumber,areaText,locationText} from './config.js';
import {state,update,subscribe,regionItems,load} from './store.js';
import {createAtlasScene} from './scene.js';
import {createGallery} from './gallery.js';
import {createEditor} from './editor.js';
import {$,escapeHtml as esc,photo,entityCard,button,toast,openModal} from './ui.js';
import credits from './credits.json';
let map,previousItems=null,previousRegion=undefined,summaryKey='';
const gallery=createGallery(()=>map.setEnabled(!document.getElementById('customer-map-dialog')?.open));
const editor=createEditor({onOpen:()=>{update({view:'editor'});map.setEnabled(false);},onClose:()=>{update({view:'atlas'});map.setEnabled(true);}});
function navigate(id){if(id && !regionById[id])return;update({region:id,hover:null});map.focus(id);}
function openCase(id){if(id.startsWith('cluster-')){document.dispatchEvent(new CustomEvent('atlas:location-city',{detail:id.slice(8)}));return;}const item=state.items.find(i=>i.id===id);if(!item)return;if(state.region!==item.continent)navigate(item.continent);gallery.open(item);map.setEnabled(false);}
function hover(id){if(state.region||state.hover===id)return;update({hover:id});map.highlight(id);}
function renderSummary(){const id=state.hover||state.region,r=regionById[id],items=regionItems(id),stats=summary(items);const key=[id,state.region,state.items].join('|')+JSON.stringify(stats);if(key===summaryKey)return;summaryKey=key;
  const next=regions.find(r=>state.items.some(i=>i.continent===r.id))||regions[0];
  $('#summary-card').innerHTML=`<div class="summary-top"><span class="eyebrow">${r?r.en+' / OVERVIEW':'GLOBAL / OVERVIEW'}</span><span class="summary-index">${r?'REGION':'WORLD'} 01</span></div><h2>${r?r.name:'Global footprint'}</h2><p class="summary-copy">${r?r.description:copy.overview}</p><div class="summary-metrics"><div><strong>${String(stats.count).padStart(2,'0')}</strong><span>${copy.itemPlural||'Projects'}</span></div><div><strong>${String(stats.countries).padStart(2,'0')}</strong><span>Countries</span></div></div><div class="summary-area"><span>${config.customerLibrary?'Active customers':'Recorded floor area'}</span><b>${config.customerLibrary?new Set(items.map(i=>i.customerId)).size:formatNumber(stats.area)+' m²'}</b></div><button class="summary-action" id="summary-action"><span>${state.region?'Back to world':r?'Explore '+r.name:'Explore '+next.name}</span><span aria-hidden="true">${state.region?'↖':'↗'}</span></button>`;
  $('#summary-action').onclick=()=>navigate(state.region?null:id||next.id);
}
function render(){
  $('#app').classList.toggle('has-hover',!!state.hover);$('#back-world').hidden=!state.region;
  const dataChanged=previousItems!==state.items,regionChanged=previousRegion!==state.region;
  if(dataChanged){previousItems=state.items;map.setData(state.items);summaryKey='';$('#region-nav').replaceChildren(...[{id:null,name:'World overview',en:'THE WORLD'},...regions].map(r=>{const count=regionItems(r.id).length;const b=document.createElement('button');b.className='region-tab';b.dataset.region=r.id||'';b.innerHTML=`<span><strong>${r.name}</strong><small>${r.en}</small></span><i>${String(count).padStart(2,'0')}</i>`;b.onclick=()=>navigate(r.id);b.onpointerenter=()=>hover(r.id);b.onpointerleave=()=>hover(null);b.onfocus=()=>hover(r.id);b.onblur=()=>hover(null);return b;}));
    const count=state.items.length,pending=state.items.filter(i=>i.lat==null||i.lon==null).length;$('#data-status').textContent=state.loading?'Loading project folder…':`${count} ${copy.itemPlural||'projects'} loaded${pending?' · '+pending+' pins needed':' · '+copy.library}`;$('#map-caption-count').textContent=`${summary(state.items).countries} countries / ${count} projects`;}
  if(dataChanged||regionChanged){previousRegion=state.region;const r=regionById[state.region];$('#app').classList.toggle('is-region',!!r);$('#app').classList.toggle('is-loading',state.loading);$('#view-eyebrow').textContent=r?`REGION / ${r.en}`:copy.eyebrow;$('#view-title').innerHTML=r?`${esc(r.name)}<br><span>${esc(copy.regionalHeadline)}</span>`:copy.headline;$('#view-caption').textContent=r?r.description:copy.caption;$('#view-step').textContent=r?'02 / 03  Regional projects':'01 / 03  World overview';$('#map-hint').textContent=r?'Select a project · Drag to pan · Scroll to zoom':'Hover to elevate · Click to explore';
    for(const b of $('#region-nav').children)b.setAttribute('aria-pressed',String((b.dataset.region||null)===state.region));
    const dock=$('#case-dock');dock.hidden=!r;if(r){const items=regionItems();dock.replaceChildren(...items.map(item=>entityCard({image:item.cover,title:item.title,subtitle:locationText(item),meta:item.industry||areaText(item.area),onClick:()=>openCase(item.id)})));if(!items.length){const empty=document.createElement('div');empty.className='empty-state';empty.textContent='No projects in this region yet.';if(!config.customerLibrary){const b=button('Add a project','text-button',()=>editor.open());empty.append(document.createElement('br'),b);}dock.append(empty);}}}
  renderSummary();
}
map=createAtlasScene($('#map-stage'),{onHover:hover,onRegion:navigate,onCase:openCase});$('#map-fallback').hidden=map.available;
$('#app').classList.toggle('map-unavailable',!map.available);
subscribe(render);render();
$('#home').onclick=()=>navigate(null);$('#open-editor').onclick=()=>editor.open();$('#zoom-in').onclick=()=>map.zoom(.8);$('#zoom-out').onclick=()=>map.zoom(1.25);$('#reset-camera').onclick=()=>map.reset();
$('#back-world').onclick=()=>navigate(null);
$('#open-credits').onclick=()=>openModal('credits');
$('#asset-credits').innerHTML=credits.map(item=>`<li><a href="${item.url}" target="_blank" rel="noopener">${esc(item.title)}</a><span>${esc(item.author)} · <a href="${item.licenseUrl}" target="_blank" rel="noopener">${item.license}</a></span></li>`).join('');
document.querySelector('.atlas-menu').addEventListener('click',event=>{if(event.target.closest('button'))event.currentTarget.open=false;});
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('Fullscreen unavailable. Try F11.');}};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')&&state.region)navigate(null);});
load().then(()=>{const id=new URL(location.href).searchParams.get('case');if(id)openCase(id);}).catch(error=>{update({loading:false,warnings:[error.message]});$('#data-status').textContent='Unable to load projects. Reload from the Case editor.';toast(error.message);});

document.addEventListener('atlas:open-case',event=>openCase(event.detail));
document.addEventListener('atlas:map-active',event=>map.setEnabled(!event.detail));

if(config.customerLibrary)createLocationMap({getItems:()=>state.items,onOpenCase:openCase,onActive:active=>map.setEnabled(!active)});
