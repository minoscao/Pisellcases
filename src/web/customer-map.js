import L from 'leaflet';
import {button,entityCard,escapeHtml as esc} from '../experience/ui.js';

export function createLocationMap({getItems,onOpenCase,onActive}){
 const options={clusterRadius:48,maxZoom:19,focusZoom:16};
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const dialog=document.createElement('dialog');dialog.id='customer-map-dialog';dialog.className='modal customer-map-dialog';dialog.setAttribute('aria-labelledby','customer-map-title');
 dialog.innerHTML=`<header class="modal-header"><div><p class="eyebrow">PISELL / CUSTOMER COMMUNITY</p><h2 id="customer-map-title">Find a business</h2></div><button class="button" data-close="customer-map-dialog">← 3D overview</button></header><div class="location-toolbar"><label>Search<input id="location-search" type="search" placeholder="Business, city or address"></label><label>Country<select id="location-country"><option value="">All countries</option></select></label><button class="button" id="location-fit">Show all results</button><span id="location-count" role="status"></span></div><div class="location-content"><aside id="location-list" aria-label="Business locations"></aside><div class="street-map-wrap"><div id="street-map" aria-label="Customer street map"></div><p id="tile-state" class="map-loading" role="status">Loading map…</p><p id="tile-error" role="status" hidden>Map tiles are unavailable. Addresses and photos are still available.</p></div></div>`;
 document.body.append(dialog);
 const open=button('Street map ↗','button',show);open.id='open-customer-map';document.querySelector('.top-actions').prepend(open);
 const q=dialog.querySelector('#location-search'),country=dialog.querySelector('#location-country'),list=dialog.querySelector('#location-list'),count=dialog.querySelector('#location-count');
 let map,layer,items=[],visible=[],initialized=false;
 function matching(){const query=q.value.trim().toLocaleLowerCase();return items.filter(i=>(!country.value||i.country===country.value)&&(!query||[i.title,i.city,i.country,i.address,i.industry].join(' ').toLocaleLowerCase().includes(query)));}
 function popup(group){const content=document.createElement('div');content.className='location-popup';for(const item of group){const card=entityCard({image:item.cover,title:item.title,subtitle:item.address,meta:`${item.locationPrecision} · View photos ↗`,onClick:()=>onOpenCase(item.id)});content.append(card);}return content;}
 function redraw(){
  if(!map)return;layer.clearLayers();const groups=[];
  for(const item of visible){const point=map.latLngToContainerPoint([item.lat,item.lon]);let group=groups.find(g=>g.point.distanceTo(point)<options.clusterRadius);if(group)group.items.push(item);else groups.push({point,items:[item]});}
  for(const group of groups){const rows=group.items,first=rows[0],bounds=L.latLngBounds(rows.map(i=>[i.lat,i.lon]));const center=rows.length===1?[first.lat,first.lon]:bounds.getCenter();const marker=L.marker(center,{icon:L.divIcon({className:'customer-marker',html:`<span>${rows.length>1?rows.length:'<i></i>'}</span>`,iconSize:[36,36],iconAnchor:[18,18]}),title:rows.length>1?`${rows.length} business locations`:first.title,keyboard:true}).addTo(layer);
   marker.on('click',()=>{if(rows.length>1&&map.getZoom()<17&&bounds.getNorthEast().distanceTo(bounds.getSouthWest())>12){map.fitBounds(bounds,{padding:[60,60],maxZoom:17,animate:!reduced});}else marker.bindPopup(popup(rows),{maxWidth:330,maxHeight:340}).openPopup();});
  }
 }
 function fit(){const points=visible.filter(i=>i.lat!=null&&i.lon!=null).map(i=>[i.lat,i.lon]);if(points.length)map.fitBounds(points,{padding:[50,50],maxZoom:options.focusZoom,animate:!reduced});}
 function select(item,card){for(const el of list.children)el.setAttribute('aria-pressed',String(el===card));map.setView([item.lat,item.lon],options.focusZoom,{animate:!reduced});L.popup({maxWidth:330}).setLatLng([item.lat,item.lon]).setContent(popup([item])).openOn(map);}
 function render(shouldFit=true){visible=matching();count.textContent=`${visible.length} ${visible.length===1?'location':'locations'} · ${new Set(visible.map(i=>i.customerId)).size} ${new Set(visible.map(i=>i.customerId)).size===1?'customer':'customers'}`;list.replaceChildren(...visible.map(item=>{let card=entityCard({image:item.cover,title:item.title,subtitle:`${item.city} · ${item.country}`,meta:item.industry,onClick:()=>select(item,card)});return card;}));if(!visible.length){const empty=document.createElement('p');empty.className='empty-state';empty.textContent='No matching businesses';list.append(empty);}redraw();if(shouldFit)fit();}
 function show(){
  items=getItems().filter(i=>i.lat!=null&&i.lon!=null);dialog.showModal();onActive(true);
  if(!initialized){country.replaceChildren(new Option('All countries',''),...[...new Set(items.map(i=>i.country))].sort().map(c=>new Option(c,c)));map=L.map('street-map',{maxZoom:options.maxZoom,minZoom:2,zoomControl:true,zoomAnimation:!reduced,fadeAnimation:!reduced}).setView([-24,135],4);layer=L.layerGroup().addTo(map);L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).on('loading',()=>dialog.querySelector('#tile-state').hidden=false).on('tileerror',()=>{dialog.querySelector('#tile-error').hidden=false;dialog.querySelector('#tile-state').hidden=true;}).on('load',()=>{dialog.querySelector('#tile-state').hidden=true;}).addTo(map);map.on('zoomend moveend',redraw);new ResizeObserver(()=>{if(dialog.open)map.invalidateSize();}).observe(dialog.querySelector('#street-map'));initialized=true;}
  requestAnimationFrame(()=>{map.invalidateSize();render();});
 }
 q.addEventListener('input',()=>render());country.addEventListener('change',()=>render());dialog.querySelector('#location-fit').onclick=fit;dialog.addEventListener('close',()=>onActive(false));
 document.addEventListener('atlas:location-city',event=>{q.value=event.detail;country.value='';show();});
 return {show};
}
