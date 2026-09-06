import {geoMercator,geoPath,geoGraticule10,geoArea} from 'd3-geo';
import geography from './world.json';
import {regionById} from './config.js';
import {$,openModal,closeModal} from './ui.js';
const ns='http://www.w3.org/2000/svg';
const svgNode=(tag,attrs)=>{const node=document.createElementNS(ns,tag);for(const [key,val] of Object.entries(attrs))node.setAttribute(key,val);return node;};
// Normalize only spherical polygons whose winding describes the complementary hemisphere.
const mapData=structuredClone(geography);
const shortNames={'United States of America':'United States'};
for(const f of mapData.features)if(shortNames[f.properties.name])f.properties.name=shortNames[f.properties.name];
for(const f of mapData.features){const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;for(const polygon of polygons)if(geoArea({type:'Polygon',coordinates:polygon})>2*Math.PI)for(const ring of polygon)ring.reverse();}
export const countries=mapData.features.map(f=>({name:f.properties.name,en:f.properties.name,continent:f.properties.continent}));
export function createLocationPicker(onConfirm){
  const svg=$('#picker-map');let projection,baseScale,baseTranslate,selected=null,zoom=1,pan=[0,0],point=null,drag=null;
  const layers=svgNode('g',{}),marker=svgNode('g',{'pointer-events':'none'});svg.append(layers,marker);
  function render(){projection.scale(baseScale*zoom).translate([baseTranslate[0]+pan[0],baseTranslate[1]+pan[1]]);const path=geoPath(projection);layers.replaceChildren();
    layers.append(svgNode('path',{d:path(geoGraticule10()),fill:'none',stroke:'#4789b5','stroke-opacity':'.14','stroke-width':'.7'}));
    const currentCountry=selected.country?.toLowerCase();
    for(const f of mapData.features){const isCountry=[f.properties.name,f.properties.nameZh].some(n=>n?.toLowerCase()===currentCountry);const p=svgNode('path',{d:path(f)||'',class:`picker-country${isCountry?' selected':''}`});const title=svgNode('title',{});title.textContent=f.properties.name;p.append(title);layers.append(p);
      const pos=path.centroid(f);if(pos.every(Number.isFinite)&&pos[0]>20&&pos[0]<940&&pos[1]>20&&pos[1]<480 && (isCountry || path.area(f)>1000)){const label=svgNode('text',{x:pos[0],y:pos[1],class:'picker-label'});label.textContent=f.properties.name;layers.append(label);}}
    renderMarker();
  }
  function renderMarker(){marker.replaceChildren();if(!point)return;const pos=projection(point);if(!pos?.every(Number.isFinite))return;marker.append(svgNode('circle',{cx:pos[0],cy:pos[1],r:17,fill:'#52d6ff','fill-opacity':'.15',stroke:'#52d6ff','stroke-width':1}),svgNode('circle',{cx:pos[0],cy:pos[1],r:5,fill:'#c4f5ff',stroke:'#05264e','stroke-width':2}));}
  function setPoint(p){point=[Number(p[0].toFixed(5)),Number(p[1].toFixed(5))];$('#longitude').value=point[0];$('#latitude').value=point[1];renderMarker();}
  function local(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const transformed=p.matrixTransform(svg.getScreenCTM().inverse());return[transformed.x,transformed.y];}
  svg.addEventListener('pointerdown',e=>{if(e.button!==0)return;const p=local(e);drag={start:p,last:p,moved:false};svg.setPointerCapture(e.pointerId);});
  svg.addEventListener('pointermove',e=>{if(!drag)return;const p=local(e);if(Math.hypot(p[0]-drag.start[0],p[1]-drag.start[1])>5)drag.moved=true;if(drag.moved){pan[0]+=p[0]-drag.last[0];pan[1]+=p[1]-drag.last[1];render();}drag.last=p;});
  svg.addEventListener('pointerup',e=>{if(!drag)return;if(!drag.moved){const p=projection.invert(local(e));if(p?.every(Number.isFinite)&&Math.abs(p[1])<=85){p[0]=((p[0]+540)%360)-180;setPoint(p);$('#coordinate-note').textContent='Pin placed. Confirm to use this location.';}}drag=null;});
  svg.addEventListener('pointercancel',()=>{drag=null;});
  function scaleBy(factor,anchor=[480,250]){const old=zoom;zoom=Math.min(32,Math.max(.4,zoom*factor));const ratio=zoom/old;pan=[anchor[0]-baseTranslate[0]-(anchor[0]-baseTranslate[0]-pan[0])*ratio,anchor[1]-baseTranslate[1]-(anchor[1]-baseTranslate[1]-pan[1])*ratio];render();}
  svg.addEventListener('wheel',e=>{e.preventDefault();scaleBy(Math.exp(-e.deltaY*.0015),local(e));},{passive:false});
  $('#picker-zoom-in').onclick=()=>scaleBy(1.5);$('#picker-zoom-out').onclick=()=>scaleBy(1/1.5);$('#picker-reset').onclick=()=>{zoom=1;pan=[0,0];render();};
  for(const id of ['longitude','latitude'])$('#'+id).addEventListener('input',()=>{const lon=$('#longitude'),lat=$('#latitude');if(lon.value!==''&&lat.value!==''&&lon.checkValidity()&&lat.checkValidity()){point=[Number(lon.value),Number(lat.value)];renderMarker();}});
  $('#location-form').addEventListener('submit',e=>{e.preventDefault();onConfirm(selected.id,Number($('#latitude').value),Number($('#longitude').value));closeModal('location-dialog');});
  return {open(item){selected=item;point=item.lat!=null&&item.lon!=null?[item.lon,item.lat]:null;zoom=1;pan=[0,0];
    const country=mapData.features.find(f=>[f.properties.name,f.properties.nameZh].some(n=>n?.toLowerCase()===item.country.toLowerCase()));
    const features=country?[country]:mapData.features.filter(f=>f.properties.continent===item.continent);
    projection=geoMercator().fitExtent([[55,40],[905,460]],{type:'FeatureCollection',features:features.length?features:mapData.features});baseScale=projection.scale();baseTranslate=projection.translate();
    $('#location-context').textContent=`${regionById[item.continent]?.name||''} / ${item.country||'Country not set'} · ${item.title}`;$('#longitude').value=point?.[0]??'';$('#latitude').value=point?.[1]??'';$('#coordinate-note').textContent=item.locationNote || 'Click the map or enter precise coordinates.';render();openModal('location-dialog');
  }};
}
