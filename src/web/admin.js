import {caseTypes,continentOptions,photoLimits,typeLabel,newCase,caseErrors,parseGoogleMapsLink} from './case-model.mjs';
import {runtimeConfig,loadLibrary,saveCase,uploadPhoto} from './library.mjs';
import {escapeHtml as esc,entityCard} from '../experience/ui.js';
import countryContinents from './country-continents.json';
const $=s=>document.querySelector(s),params=new URL(location.href).searchParams;
let items=[],item,dirty=false,busy=false,uploading=false,config={},googleMap,googlePin,googleSelection=0;
const pendingPhotos=new Map();
const numbers=new Set(['year','area','lat','lon']);
const fields=[
  {name:'title',label:'项目名称',group:'basic',required:true,full:true,max:160,placeholder:'例如：Minoland Melbourne'},
  {name:'type',label:'项目类型',group:'basic',required:true,options:caseTypes},
  {name:'year',label:'上线年份',group:'basic',kind:'number',min:1900,max:2100,step:1,placeholder:'例如：2026'},
  {name:'area',label:'面积（m²）',group:'basic',kind:'number',min:0.01,step:'any',placeholder:'例如：350'},
  {name:'description',label:'项目介绍',group:'basic',kind:'textarea',full:true,max:2000,placeholder:'填写门店特色或项目简介（选填）'},
  {name:'address',label:'完整地址',group:'location',required:true,full:true,max:500,placeholder:'街道、门牌号、邮编'},
  {name:'country',label:'国家 / 地区',group:'location',required:true,max:100},
  {name:'city',label:'城市',group:'location',required:true,max:100},
  {name:'continent',label:'所属大洲',group:'location',required:true,options:continentOptions.map((value,i)=>({value,label:['亚洲','欧洲','北美洲','南美洲','非洲','大洋洲'][i]}))},
  {name:'lat',label:'纬度',group:'coordinate',kind:'number',min:-90,max:90,step:'any',required:true},
  {name:'lon',label:'经度',group:'coordinate',kind:'number',min:-180,max:180,step:'any',required:true}
];
function fieldHTML(f){const attrs=`id="${f.name}" name="${f.name}" ${f.required?'required':''} aria-describedby="error-${f.name}" ${f.max?'maxlength="'+f.max+'"':''}`;
  const input=f.options?`<select ${attrs}>${f.name==='type'?'<option value="">选择类型</option>':''}${f.options.map(o=>`<option value="${o.value}">${o.label}</option>`).join('')}</select>`:f.kind==='textarea'?`<textarea ${attrs} placeholder="${f.placeholder||''}"></textarea>`:`<input ${attrs} type="${f.kind||'text'}" ${f.min!=null?'min="'+f.min+'"':''} ${f.kind==='number'?'max="'+(f.max??'')+'" step="'+f.step+'"':''} placeholder="${f.placeholder||''}">`;
  return `<div class="field ${f.full?'full':''}"><label for="${f.name}">${f.label}${f.required?'<span class="required-mark">*</span>':''}</label>${input}<p id="error-${f.name}" class="field-error" hidden></p></div>`;
}
function markDirty(){dirty=true;$('#save-state').textContent='未保存';$('#save-state').classList.remove('saved');$('#action-status').textContent='有修改尚未保存';}
function fillFields(){for(const f of fields)$('#'+f.name).value=item[f.name]??'';$('#google-link').value=item.googleMapsUrl||'';renderLocation();renderPhotos();renderPreview();}
function renderPreview(){const host=$('#project-preview');host.replaceChildren();
  if(!item.cover){const empty=document.createElement('div');empty.className='preview-placeholder';empty.textContent='上传图片后显示封面';host.append(empty);}
  host.append(entityCard({image:item.cover,title:item.title||'项目名称',subtitle:typeLabel(item.type)||'项目类型',meta:[item.address||'项目地址',item.area?item.area+' m²':'',item.year].filter(Boolean).join(' · '),onClick:()=>{if(item.cover)viewPhoto(item.cover);}}));
}
function renderLocation(){const valid=Number.isFinite(item.lat)&&Number.isFinite(item.lon)&&Math.abs(item.lat)<=90&&Math.abs(item.lon)<=180;
  $('#pin-status').textContent=valid?`已定位 · ${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}`:'尚未定位';
  const link=new URL('https://www.google.com/maps/search/');link.searchParams.set('api','1');link.searchParams.set('query',valid?`${item.lat},${item.lon}`:item.address||item.title||'');if(item.googlePlaceId)link.searchParams.set('query_place_id',item.googlePlaceId);$('#google-open').href=link.href;
  if(googleMap){googlePin.map=valid?googleMap:null;if(valid){const position={lat:item.lat,lng:item.lon};googleMap.setCenter(position);googleMap.setZoom(16);googlePin.position=position;}}
}
function renderPhotos(){const grid=$('#photo-grid');grid.replaceChildren();$('#photo-count').textContent=`${item.photos.length} / ${photoLimits.count}`;
  item.photos.forEach((src,index)=>{const tile=document.createElement('div');tile.className='photo-tile';tile.innerHTML=`<button class="photo-thumb" type="button" aria-label="查看图片 ${index+1}"><img src="${esc(src)}" alt="项目图片 ${index+1}"></button><div class="photo-tools"><button type="button" data-cover aria-pressed="${src===item.cover}">${src===item.cover?'✓ 封面':'设为封面'}</button><button type="button" data-earlier aria-label="将图片 ${index+1} 前移" ${index===0?'disabled':''}>前移</button><button class="remove-photo" type="button" data-remove aria-label="移除图片 ${index+1}">×</button></div>`;
    tile.querySelector('.photo-thumb').onclick=()=>viewPhoto(src);
    tile.querySelector('[data-cover]').onclick=()=>{if(busy||uploading)return;item.cover=src;markDirty();renderPhotos();renderPreview();};
    tile.querySelector('[data-earlier]').onclick=()=>{if(busy||uploading)return;[item.photos[index-1],item.photos[index]]=[item.photos[index],item.photos[index-1]];markDirty();renderPhotos();};
    tile.querySelector('[data-remove]').onclick=()=>{if(busy||uploading)return;item.photos.splice(index,1);if(pendingPhotos.has(src)){pendingPhotos.delete(src);URL.revokeObjectURL(src);}if(item.cover===src)item.cover=item.photos[0]||null;markDirty();renderPhotos();renderPreview();};grid.append(tile);
  });
}
function viewPhoto(src){const img=$('#viewer-image');img.style.animation='none';img.src=src;img.alt=item?.title||'项目图片';$('#photo-viewer').showModal();requestAnimationFrame(()=>{img.style.animation='';});}
$('#close-photo').onclick=()=>$('#photo-viewer').close();
function showErrors(errors,focus=false){for(const f of fields){const message=errors[f.name];$('#'+f.name).setAttribute('aria-invalid',String(!!message));$('#error-'+f.name).hidden=!message;$('#error-'+f.name).textContent=message||'';}
  $('#error-photos').hidden=!errors.photos;$('#error-photos').textContent=errors.photos||'';
  const summary=$('#form-errors');summary.hidden=!Object.keys(errors).length;summary.innerHTML='<strong>请完善以下信息</strong><ul>'+Object.entries(errors).map(([key,value])=>`<li><a href="#${key==='photos'?'photo-upload':key}">${esc(value)}</a></li>`).join('')+'</ul>';
  if(errors.lat||errors.lon)$('.form-help').open=true;if(focus&&!summary.hidden)summary.focus();
}
async function addPhotos(files){
  if(busy||uploading)return;
  if(item.photos.length+files.length>photoLimits.count){$('#upload-message').textContent=`最多上传 ${photoLimits.count} 张图片`;return;}
  uploading=true;$('#save-project').disabled=true;$('#photo-upload').disabled=true;$('#camera-upload').disabled=true;
  let completed=0;const failures=[];
  for(const file of files){try{
    if(!photoLimits.types.includes(file.type))throw new Error('仅支持 JPG、PNG、WebP');if(file.size>photoLimits.bytes)throw new Error('超过 10 MB');
    const bitmap=await createImageBitmap(file);bitmap.close();
    $('#upload-message').textContent=`正在读取 ${completed+1} / ${files.length}：${file.name}`;
    const url=URL.createObjectURL(file);pendingPhotos.set(url,file);item.photos.push(url);item.cover ||=url;markDirty();renderPhotos();renderPreview();
  }catch(error){failures.push(`${file.name}：${error.message}`);}completed++;}
  uploading=false;$('#save-project').disabled=config.storage!=='cloudflare';$('#photo-upload').disabled=false;$('#camera-upload').disabled=false;$('#photo-upload').value='';$('#camera-upload').value='';
  $('#upload-message').textContent=failures.length?failures.join('；'):`已选择 ${files.length} 张图片，保存项目时上传`;
}
$('#photo-upload').onchange=e=>addPhotos([...e.target.files]);
$('#camera-upload').onchange=e=>addPhotos([...e.target.files]);
for(const name of ['dragenter','dragover'])$('#drop-zone').addEventListener(name,e=>{e.preventDefault();$('#drop-zone').classList.add('dragging');});
for(const name of ['dragleave','drop'])$('#drop-zone').addEventListener(name,e=>{e.preventDefault();$('#drop-zone').classList.remove('dragging');if(name==='drop')addPhotos([...e.dataTransfer.files]);});
$('#read-location').onclick=()=>{try{Object.assign(item,parseGoogleMapsLink($('#google-link').value));item.coordinateSource=item.googleMapsUrl;item.locationNote='位置由 Google Maps 链接确认';markDirty();fillFields();$('#location-message').textContent='已读取地点坐标，请核对地址';}catch(error){$('#location-message').textContent=error.message;$('.form-help').open=true;}};
async function initGoogle(){
  if(!config.googleMapsApiKey){$('#location-message').textContent='Google Maps 搜索尚未配置，可先粘贴地点链接或填写经纬度。';return;}
  try{await new Promise((resolve,reject)=>{const callback='pisellMapsReady';let done=false;const finish=fn=>{if(done)return;done=true;clearTimeout(timer);fn();};const timer=setTimeout(()=>finish(()=>reject(new Error('地图加载超时，可先使用地点链接录入'))),15000);window[callback]=()=>finish(resolve);window.gm_authFailure=()=>{$('#location-message').textContent='Google Maps 验证失败，请检查地图配置；仍可手动录入位置';};const script=document.createElement('script');const url=new URL('https://maps.googleapis.com/maps/api/js');for(const [k,v] of Object.entries({key:config.googleMapsApiKey,loading:'async',callback,libraries:'places,maps,marker',v:'weekly',language:'zh-CN'}))url.searchParams.set(k,v);script.src=url;script.onerror=()=>finish(()=>reject(new Error('Google Maps 加载失败，可先使用地点链接录入')));document.head.append(script);});
    const {PlaceAutocompleteElement}=await google.maps.importLibrary('places');const autocomplete=new PlaceAutocompleteElement({});autocomplete.placeholder='搜索门店名称或地址';autocomplete.setAttribute('aria-label','搜索 Google Maps 门店或地址');$('#google-autocomplete').append(autocomplete);$('#google-search').hidden=false;
    autocomplete.addEventListener('gmp-error',()=>{$('#location-message').textContent='地点搜索失败，请重试或粘贴地点链接';});
    autocomplete.addEventListener('gmp-select',async({placePrediction})=>{const selection=++googleSelection;try{const place=placePrediction.toPlace();$('#location-message').textContent='正在读取地点…';await place.fetchFields({fields:['displayName','formattedAddress','location','addressComponents','googleMapsURI']});if(selection!==googleSelection)return;if(!place.location)throw new Error('这个地点没有可用坐标，请选择其他结果');
      const component=type=>place.addressComponents?.find(c=>c.types.includes(type))?.longText||'';
      Object.assign(item,{address:place.formattedAddress||'',country:component('country'),city:component('locality')||component('postal_town')||component('administrative_area_level_2')||component('administrative_area_level_1'),lat:place.location.lat(),lon:place.location.lng(),googlePlaceId:place.id,googleMapsUrl:place.googleMapsURI||'',coordinateSource:place.googleMapsURI||'',locationNote:'位置由 Google Maps 确认'});
      const code=place.addressComponents?.find(c=>c.types.includes('country'))?.shortText;if(countryContinents[code])item.continent=countryContinents[code];if(!item.title)item.title=place.displayName||'';markDirty();fillFields();$('#location-message').textContent='地址和坐标已填入，请核对门店信息';
    }catch(error){$('#location-message').textContent=error.message;}});
    const {Map}=await google.maps.importLibrary('maps'),{AdvancedMarkerElement}=await google.maps.importLibrary('marker');$('#google-map').hidden=false;
    googleMap=new Map($('#google-map'),{center:{lat:20,lng:110},zoom:3,mapId:config.googleMapsMapId||'DEMO_MAP_ID',streetViewControl:false,mapTypeControl:false});googlePin=new AdvancedMarkerElement({map:googleMap,gmpDraggable:true,title:'项目位置'});
    googlePin.addListener('dragend',()=>{const pos=googlePin.position;Object.assign(item,{lat:typeof pos.lat==='function'?pos.lat():pos.lat,lon:typeof pos.lng==='function'?pos.lng():pos.lng,googlePlaceId:'',googleMapsUrl:'',coordinateSource:'',locationNote:'位置已手动调整'});markDirty();fillFields();});renderLocation();
  }catch(error){$('#location-message').textContent=error.message;}
}
function renderList(){const query=$('#project-search').value.trim().toLowerCase(),type=$('#type-filter').value;const visible=items.filter(i=>(!type||i.type===type)&&(!query||[i.title,i.address,i.city,i.country].some(v=>v?.toLowerCase().includes(query))));$('#case-count').textContent=items.length;$('#list-empty').hidden=visible.length>0;$('#project-list').replaceChildren(...visible.map(i=>entityCard({image:i.cover,title:i.title,subtitle:typeLabel(i.type)||i.industry||'项目',meta:[i.city,i.country].filter(Boolean).join(' · '),onClick:()=>{location.href='admin.html?id='+encodeURIComponent(i.id);}})));}
$('#project-search').oninput=renderList;$('#type-filter').onchange=renderList;
$('#case-form').onsubmit=async event=>{event.preventDefault();if(busy||uploading)return;if(config.storage!=='cloudflare'){$('#action-status').textContent='保存服务尚未连接，请完成 Cloudflare 配置';return;}const errors=caseErrors(item);showErrors(errors,true);if(Object.keys(errors).length)return;
  busy=true;$('#save-project').disabled=true;$('#photo-upload').disabled=true;$('#camera-upload').disabled=true;$('.form-sections').inert=true;$('#save-project').textContent='正在保存…';
  try{
    let uploaded=0,total=pendingPhotos.size;
    for(const [preview,file]of pendingPhotos){$('#upload-progress').hidden=false;$('#upload-message').textContent=`正在上传 ${++uploaded} / ${total}：${file.name}`;const url=await uploadPhoto(file,p=>{$('#upload-progress').value=p;});item.photos=item.photos.map(src=>src===preview?url:src);if(item.cover===preview)item.cover=url;pendingPhotos.delete(preview);URL.revokeObjectURL(preview);renderPhotos();renderPreview();}
    item=await saveCase({...item,industry:typeLabel(item.type),status:'active'});dirty=false;history.replaceState(null,'','admin.html?id='+encodeURIComponent(item.id));$('#form-title').textContent='编辑项目';$('#save-state').textContent='已保存';$('#save-state').classList.add('saved');$('#upload-message').textContent='图片已保存';$('#action-status').replaceChildren(document.createTextNode('已保存，网站地图已更新。 '));const link=document.createElement('a');link.href='atlas.html?case='+encodeURIComponent(item.id);link.textContent='查看项目 ↗';$('#action-status').append(link);}
  catch(error){$('#action-status').textContent=error.message;$('#save-state').textContent='保存失败';}
  finally{busy=false;$('#save-project').disabled=config.storage!=='cloudflare';$('#photo-upload').disabled=false;$('#camera-upload').disabled=false;$('#upload-progress').hidden=true;$('.form-sections').inert=false;$('#save-project').textContent='保存项目';}
};
window.addEventListener('beforeunload',event=>{if(dirty||uploading||busy){event.preventDefault();event.returnValue='';}});
async function start(){
  config=await runtimeConfig();items=(await loadLibrary({editable:true})).filter(i=>!i.archived);
  $('#page-message').textContent='';$('#type-filter').insertAdjacentHTML('beforeend',caseTypes.map(t=>`<option value="${t.value}">${t.label}</option>`).join(''));
  if(!params.has('new')&&!params.has('id')){$('#library-view').hidden=false;renderList();return;}
  const found=items.find(i=>i.id===params.get('id'));if(params.has('id')&&!found)throw new Error('未找到这个项目，请返回项目合集重新选择');item=found?structuredClone(found):newCase();item.type ||= '';item.revision ||=0;item.area ??=null;item.year ??=null;
  $('#form-view').hidden=false;$('#form-title').textContent=found?'编辑项目':'新增项目';$('#save-state').textContent=found?'已保存':'尚未保存';
  for(const [group,host] of [['basic','#basic-fields'],['location','#location-fields'],['coordinate','#coordinate-fields']])$(host).innerHTML=fields.filter(f=>f.group===group).map(fieldHTML).join('');
  for(const f of fields){const input=$('#'+f.name);input.addEventListener('input',()=>{item[f.name]=numbers.has(f.name)?(input.value===''?null:Number(input.value)):input.value;
    if(['address','country','city'].includes(f.name)){item.lat=null;item.lon=null;item.googlePlaceId='';item.googleMapsUrl='';item.coordinateSource='';$('#lat').value='';$('#lon').value='';$('#google-link').value='';}
    if(['lat','lon'].includes(f.name)){item.googlePlaceId='';item.googleMapsUrl='';item.coordinateSource='';$('#google-link').value='';}
    markDirty();renderPreview();renderLocation();});input.addEventListener('blur',()=>{const error=caseErrors(item)[f.name];$('#error-'+f.name).textContent=error||'';$('#error-'+f.name).hidden=!error;input.setAttribute('aria-invalid',String(!!error));});}
  $('#save-project').textContent='保存项目';$('#save-project').disabled=config.storage!=='cloudflare';$('#storage-note').textContent=config.storage==='cloudflare'?'保存后，独立地图及网站中嵌入的地图会在刷新时显示更新。':'保存服务尚未连接。完成 Cloudflare 配置后即可保存项目与图片。';if(config.storage!=='cloudflare')$('#action-status').textContent='保存服务尚未连接';fillFields();initGoogle();
}
start().catch(error=>{$('#page-message').classList.add('error');$('#page-message').textContent=error.message;});
