import {caseTypes,continentOptions,photoLimits,typeLabel,newCase,caseErrors,parseGoogleMapsLink} from './case-model.mjs';
import {runtimeConfig,adminSession,adminLogin,loadLibrary,saveCase,uploadPhoto} from './library.mjs';
import {escapeHtml as esc,entityCard} from '../experience/ui.js';
import countryContinents from './country-continents.json';
const $=s=>document.querySelector(s),params=new URL(location.href).searchParams;
let items=[],item,dirty=false,busy=false,uploading=false,config={},googleMap,googlePin,googleSelection=0,placePhotos=[];
const pendingPhotos=new Map();
const maxPhotoWidth=1920,maxPhotoHeight=1080,maxSourcePhotoBytes=50*1024*1024,jpegQuality=.6;
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
function fillFields(){item.googlePhotoSelections ||= [];for(const f of fields)$('#'+f.name).value=item[f.name]??'';$('#google-link').value=item.googleMapsUrl||'';renderLocation();renderPhotos();renderPreview();}
function renderPreview(){const host=$('#project-preview');host.replaceChildren();
  if(!item.cover){const empty=document.createElement('div');empty.className='preview-placeholder';empty.textContent='上传图片后显示封面';host.append(empty);}
  host.append(entityCard({image:item.cover,title:item.title||'项目名称',subtitle:typeLabel(item.type)||'项目类型',meta:[item.address||'项目地址',item.area?item.area+' m²':'',item.year].filter(Boolean).join(' · '),onClick:()=>{if(item.cover)viewPhoto(item.cover);}}));
}
function renderLocation(){const valid=Number.isFinite(item.lat)&&Number.isFinite(item.lon)&&Math.abs(item.lat)<=90&&Math.abs(item.lon)<=180;
  $('#pin-status').textContent=valid?`已定位 · ${item.lat.toFixed(6)}, ${item.lon.toFixed(6)}`:'尚未定位';
  const link=new URL('https://www.google.com/maps/search/');link.searchParams.set('api','1');link.searchParams.set('query',valid?`${item.lat},${item.lon}`:item.address||item.title||'');if(item.googlePlaceId)link.searchParams.set('query_place_id',item.googlePlaceId);$('#google-open').href=link.href;
  if(googleMap){googlePin.map=valid?googleMap:null;if(valid){const position={lat:item.lat,lng:item.lon};googleMap.setCenter(position);googleMap.setZoom(16);googlePin.position=position;}}
}
function renderSelectedGooglePhotos(){const section=$('#selected-google-photos'),grid=$('#selected-google-photo-grid'),selected=item.googlePhotoSelections||[];section.hidden=!selected.length;grid.replaceChildren(...selected.map((index,position)=>{const photo=placePhotos[index],tile=document.createElement('article');tile.className='selected-google-photo';if(!photo){tile.textContent='正在刷新 Google Maps 图片…';return tile;}tile.innerHTML=`<img src="${esc(photo.url)}" alt="已选择的 Google Maps 图片 ${position+1}"><div><span>Google Maps · ${String(position+1).padStart(2,'0')}</span><button type="button" data-earlier ${position===0?'disabled':''}>前移</button><button type="button" data-remove>移除</button></div>`;tile.querySelector('[data-earlier]').onclick=()=>{[selected[position-1],selected[position]]=[selected[position],selected[position-1]];markDirty();renderSelectedGooglePhotos();};tile.querySelector('[data-remove]').onclick=()=>{item.googlePhotoSelections=selected.filter((_,i)=>i!==position);markDirty();renderSelectedGooglePhotos();renderPlacePhotos();};return tile;}));}
function renderPlacePhotos(){const grid=$('#place-photo-grid'),empty=$('#place-photo-empty'),selected=new Set(item.googlePhotoSelections||[]);empty.hidden=!!placePhotos.length;grid.replaceChildren(...placePhotos.map((photo,index)=>{const card=document.createElement('article');card.className='place-photo';const credits=photo.credits.length?photo.credits.map(credit=>`<a href="${esc(credit.url)}" target="_blank" rel="noopener noreferrer">${esc(credit.name)}</a>`).join(' · '):'Google Maps';card.innerHTML=`<img src="${esc(photo.url)}" alt="Google Maps 地点图片 ${index+1}"><div class="place-photo-copy"><span>${credits}</span><div><button type="button" data-add>${selected.has(index)?'已添加':'＋ 添加'}</button><a href="${esc(photo.source)}" target="_blank" rel="noopener noreferrer">在 Google Maps 中查看 ↗</a></div></div>`;card.querySelector('[data-add]').onclick=()=>{if(selected.has(index))return;item.googlePhotoSelections=[...(item.googlePhotoSelections||[]),index];markDirty();renderPlacePhotos();renderSelectedGooglePhotos();};return card;}));}
function setPlacePhotos(place){placePhotos=(place.photos||[]).slice(0,10).flatMap((photo,index)=>{try{const url=photo.getURI({maxWidth:900,maxHeight:600});return url?[{index,url,source:photo.googleMapsURI||place.googleMapsURI||url,credits:(photo.authorAttributions||[]).map(author=>({name:author.displayName||'Google Maps',url:author.uri||photo.googleMapsURI||place.googleMapsURI||url}))}]:[]}catch{return[];}});renderPlacePhotos();renderSelectedGooglePhotos();}
async function loadStoredPlacePhotos(Place){if(!item?.googlePlaceId||placePhotos.length)return;const placeId=item.googlePlaceId;try{const place=new Place({id:placeId});await place.fetchFields({fields:['photos','googleMapsURI']});if(item?.googlePlaceId===placeId)setPlacePhotos(place);}catch{placePhotos=[];renderPlacePhotos();}}
function renderPhotos(){const grid=$('#photo-grid');grid.replaceChildren();$('#photo-count').textContent=`${item.photos.length} / ${photoLimits.count}`;renderSelectedGooglePhotos();const sync=$('#sync-photos');sync.hidden=!pendingPhotos.size;sync.disabled=busy||uploading;
  item.photos.forEach((src,index)=>{const tile=document.createElement('div');tile.className='photo-tile';tile.innerHTML=`<button class="photo-thumb" type="button" aria-label="查看图片 ${index+1}"><img src="${esc(src)}" alt="项目图片 ${index+1}"></button><div class="photo-tools"><button type="button" data-cover aria-pressed="${src===item.cover}">${src===item.cover?'✓ 封面':'设为封面'}</button><button type="button" data-earlier aria-label="将图片 ${index+1} 前移" ${index===0?'disabled':''}>前移</button><button class="remove-photo" type="button" data-remove aria-label="移除图片 ${index+1}">×</button></div>`;
    tile.querySelector('.photo-thumb').onclick=()=>viewPhoto(src);
    tile.querySelector('[data-cover]').onclick=()=>{if(busy||uploading)return;item.cover=src;markDirty();renderPhotos();renderPreview();};
    tile.querySelector('[data-earlier]').onclick=()=>{if(busy||uploading)return;[item.photos[index-1],item.photos[index]]=[item.photos[index],item.photos[index-1]];markDirty();renderPhotos();};
    tile.querySelector('[data-remove]').onclick=()=>{if(busy||uploading)return;item.photos.splice(index,1);if(pendingPhotos.has(src)){pendingPhotos.delete(src);URL.revokeObjectURL(src);}if(item.cover===src)item.cover=item.photos[0]||null;markDirty();renderPhotos();renderPreview();};grid.append(tile);
  });
}
function viewPhoto(src){const img=$('#viewer-image');img.style.animation='none';img.src=src;img.alt=item?.title||'项目图片';$('#photo-viewer').showModal();requestAnimationFrame(()=>{img.style.animation='';});}
$('#close-photo').onclick=()=>$('#photo-viewer').close();
$('#toggle-password').onclick=()=>{const input=$('#admin-password'),shown=input.type==='text';input.type=shown?'password':'text';$('#toggle-password').textContent=shown?'显示':'隐藏';$('#toggle-password').setAttribute('aria-label',shown?'显示密码':'隐藏密码');$('#toggle-password').setAttribute('aria-pressed',String(!shown));input.focus();};
$('#login-form').onsubmit=async event=>{event.preventDefault();const input=$('#admin-password'),summary=$('#login-error'),button=$('#login-submit');summary.hidden=true;input.setAttribute('aria-invalid','false');if(!input.value){input.setAttribute('aria-invalid','true');summary.textContent='请输入管理密码';summary.hidden=false;summary.focus();return;}
  button.disabled=true;button.textContent='正在验证…';try{await adminLogin(input.value);input.value='';$('#login-view').hidden=true;await openAdmin();}catch(error){input.setAttribute('aria-invalid','true');summary.textContent=error.message;summary.hidden=false;summary.focus();}finally{button.disabled=false;button.textContent='进入管理';}
};
function showErrors(errors,focus=false){for(const f of fields){const message=errors[f.name];$('#'+f.name).setAttribute('aria-invalid',String(!!message));$('#error-'+f.name).hidden=!message;$('#error-'+f.name).textContent=message||'';}
  $('#error-photos').hidden=!errors.photos;$('#error-photos').textContent=errors.photos||'';
  const summary=$('#form-errors');summary.hidden=!Object.keys(errors).length;summary.innerHTML='<strong>请完善以下信息</strong><ul>'+Object.entries(errors).map(([key,value])=>`<li><a href="#${key==='photos'?'photo-upload':key}">${esc(value)}</a></li>`).join('')+'</ul>';
  if(errors.lat||errors.lon)$('.form-help').open=true;if(focus&&!summary.hidden)summary.focus();
}
async function normalizePhoto(file){
  if(!photoLimits.types.includes(file.type))throw new Error('仅支持 JPG、PNG、WebP');if(file.size>maxSourcePhotoBytes)throw new Error('原图超过 50 MB');
  const bitmap=await createImageBitmap(file),scale=Math.min(1,maxPhotoWidth/bitmap.width,maxPhotoHeight/bitmap.height),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{alpha:false});if(!context){bitmap.close();throw new Error('无法处理这张图片');}context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);bitmap.close();const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('图片压缩失败')),'image/jpeg',jpegQuality));return new File([blob],file.name.replace(/\.[^.]+$/,'.jpg'),{type:'image/jpeg',lastModified:file.lastModified});
}
function setPhotoControls(disabled){for(const selector of ['#save-project','#save-and-exit'])$(selector).disabled=disabled||config.storage!=='cloudflare';$('#photo-upload').disabled=disabled;$('#camera-upload').disabled=disabled;$('#sync-photos').disabled=disabled||!pendingPhotos.size;}
function setOptimizeButtons(disabled){for(const button of document.querySelectorAll('#optimize-library-photos,#optimize-library-photos-form'))button.disabled=disabled;}
async function syncPendingPhotos(){
  if(!pendingPhotos.size||uploading)return;uploading=true;setPhotoControls(true);let uploaded=0,total=pendingPhotos.size;
  try{for(const [preview,file]of pendingPhotos){$('#upload-progress').hidden=false;$('#upload-message').textContent=`正在同步 ${++uploaded} / ${total}：${file.name}`;const url=await uploadPhoto(file,progress=>{$('#upload-progress').value=progress;});item.photos=item.photos.map(src=>src===preview?url:src);if(item.cover===preview)item.cover=url;pendingPhotos.delete(preview);URL.revokeObjectURL(preview);renderPhotos();renderPreview();}$('#upload-message').textContent='图片已同步到存储，保存项目后即可在地图展示。';}
  finally{uploading=false;$('#upload-progress').hidden=true;setPhotoControls(false);renderPhotos();}
}
async function optimizeStoredPhotos(){
  if(busy||uploading)return;if(dirty){$('#action-status').textContent='请先保存当前项目，再统一优化已上传图片。';return;}const records=items.filter(record=>record.photos?.some(photo=>/^\/?media\/photos\//.test(photo)));if(!records.length){$('#action-status').textContent='没有需要优化的已上传图片。';return;}
  busy=true;setOptimizeButtons(true);setPhotoControls(true);let completed=0,total=[...new Set(records.flatMap(record=>record.photos.filter(photo=>/^\/?media\/photos\//.test(photo))))].length;
  try{for(const record of records){const replacements=new Map();for(const source of record.photos.filter(photo=>/^\/?media\/photos\//.test(photo))){if(replacements.has(source))continue;$('#action-status').textContent=`正在优化 ${++completed} / ${total} 张已上传图片…`;const response=await fetch(new URL(source,location.href));if(!response.ok)throw new Error('读取已上传图片失败');const blob=await response.blob(),optimized=await normalizePhoto(new File([blob],'project-image.jpg',{type:blob.type||'image/jpeg'})),uploaded=await uploadPhoto(optimized);replacements.set(source,uploaded);}const saved=await saveCase({...record,photos:record.photos.map(photo=>replacements.get(photo)||photo),cover:replacements.get(record.cover)||record.cover});items=items.map(current=>current.id===saved.id?saved:current);if(item?.id===saved.id){item=structuredClone(saved);fillFields();}}
    renderList();$('#action-status').textContent=`已优化 ${completed} 张图片：1920×1080 内，JPG 60%。`;
  }catch(error){$('#action-status').textContent=error.message;}finally{busy=false;setOptimizeButtons(false);setPhotoControls(false);}
}
async function addPhotos(files){
  if(busy||uploading)return;
  if(item.photos.length+files.length>photoLimits.count){$('#upload-message').textContent=`最多上传 ${photoLimits.count} 张图片`;return;}
  uploading=true;setPhotoControls(true);
  let completed=0;const failures=[];
  for(const file of files){try{
    $('#upload-message').textContent=`正在处理 ${completed+1} / ${files.length}：${file.name}`;
    const optimized=await normalizePhoto(file),url=URL.createObjectURL(optimized);pendingPhotos.set(url,optimized);item.photos.push(url);item.cover ||=url;markDirty();renderPhotos();renderPreview();
  }catch(error){failures.push(`${file.name}：${error.message}`);}completed++;}
  uploading=false;setPhotoControls(false);$('#photo-upload').value='';$('#camera-upload').value='';
  $('#upload-message').textContent=failures.length?failures.join('；'):`已处理 ${files.length} 张图片 · 1920×1080 内 · JPG 60% · 可立即同步到存储`;
}
$('#photo-upload').onchange=e=>addPhotos([...e.target.files]);
$('#camera-upload').onchange=e=>addPhotos([...e.target.files]);
$('#add-social-photo').onclick=async()=>{const input=$('#social-photo-url'),message=$('#social-photo-message'),value=input.value.trim();message.textContent='';let url;try{url=new URL(value);if(!/^https?:$/.test(url.protocol))throw new Error();if(/(^|\.)(google\.com|googleusercontent\.com|ggpht\.com)$/i.test(url.hostname))throw new Error('Google Maps 地点图片会显示在上方来源区，不能转存到项目图片。');}catch(error){message.textContent=error.message||'请粘贴公开图片的完整链接';return;}const button=$('#add-social-photo');button.disabled=true;button.textContent='正在读取…';try{const response=await fetch(url,{mode:'cors'});if(!response.ok)throw new Error('无法读取这张社交媒体图片');const blob=await response.blob();if(!photoLimits.types.includes(blob.type))throw new Error('仅支持 JPG、PNG、WebP 图片');const name=(url.pathname.split('/').pop()||'social-image').replace(/[^a-zA-Z0-9._-]/g,'-');await addPhotos([new File([blob],name,{type:blob.type})]);input.value='';message.textContent='已加入下方的已选择图片。';}catch(error){message.textContent=error.message==='Failed to fetch'?'这个链接不允许直接读取，请先保存图片后用下方上传。':error.message;}finally{button.disabled=false;button.textContent='加入已选择图片';}};
$('#sync-photos').onclick=()=>syncPendingPhotos().catch(error=>{$('#upload-message').textContent=error.message;});
for(const button of document.querySelectorAll('#optimize-library-photos,#optimize-library-photos-form'))button.onclick=()=>optimizeStoredPhotos();
for(const name of ['dragenter','dragover'])$('#drop-zone').addEventListener(name,e=>{e.preventDefault();$('#drop-zone').classList.add('dragging');});
for(const name of ['dragleave','drop'])$('#drop-zone').addEventListener(name,e=>{e.preventDefault();$('#drop-zone').classList.remove('dragging');if(name==='drop')addPhotos([...e.dataTransfer.files]);});
$('#read-location').onclick=()=>{try{placePhotos=[];item.googlePhotoSelections=[];Object.assign(item,parseGoogleMapsLink($('#google-link').value));item.coordinateSource=item.googleMapsUrl;item.locationNote='位置由 Google Maps 链接确认';markDirty();fillFields();renderPlacePhotos();$('#location-message').textContent='已读取地点坐标，请核对地址';}catch(error){$('#location-message').textContent=error.message;$('.form-help').open=true;}};
async function initGoogle(){
  if(!config.googleMapsApiKey){$('#location-message').textContent='Google Maps 搜索尚未配置，可先粘贴地点链接或填写经纬度。';return;}
  try{await new Promise((resolve,reject)=>{const callback='pisellMapsReady';let done=false;const finish=fn=>{if(done)return;done=true;clearTimeout(timer);fn();};const timer=setTimeout(()=>finish(()=>reject(new Error('地图加载超时，可先使用地点链接录入'))),15000);window[callback]=()=>finish(resolve);window.gm_authFailure=()=>{$('#location-message').textContent='Google Maps 验证失败，请检查地图配置；仍可手动录入位置';};const script=document.createElement('script');const url=new URL('https://maps.googleapis.com/maps/api/js');for(const [k,v] of Object.entries({key:config.googleMapsApiKey,loading:'async',callback,libraries:'places,maps,marker',v:'weekly',language:'zh-CN'}))url.searchParams.set(k,v);script.src=url;script.onerror=()=>finish(()=>reject(new Error('Google Maps 加载失败，可先使用地点链接录入')));document.head.append(script);});
    const {PlaceAutocompleteElement}=await google.maps.importLibrary('places');const autocomplete=new PlaceAutocompleteElement({});autocomplete.placeholder='搜索门店名称或地址';autocomplete.setAttribute('aria-label','搜索 Google Maps 门店或地址');$('#google-autocomplete').append(autocomplete);$('#google-search').hidden=false;
    autocomplete.addEventListener('gmp-error',()=>{$('#location-message').textContent='地点搜索失败，请重试或粘贴地点链接';});
    autocomplete.addEventListener('gmp-select',async({placePrediction})=>{const selection=++googleSelection;try{const place=placePrediction.toPlace();$('#location-message').textContent='正在读取地点…';await place.fetchFields({fields:['displayName','formattedAddress','location','addressComponents','googleMapsURI','photos']});if(selection!==googleSelection)return;if(!place.location)throw new Error('这个地点没有可用坐标，请选择其他结果');
      const component=type=>place.addressComponents?.find(c=>c.types.includes(type))?.longText||'';
      Object.assign(item,{address:place.formattedAddress||'',country:component('country'),city:component('locality')||component('postal_town')||component('administrative_area_level_2')||component('administrative_area_level_1'),lat:place.location.lat(),lon:place.location.lng(),googlePlaceId:place.id,googleMapsUrl:place.googleMapsURI||'',coordinateSource:place.googleMapsURI||'',locationNote:'位置由 Google Maps 确认',googlePhotoSelections:[]});
      const code=place.addressComponents?.find(c=>c.types.includes('country'))?.shortText;if(countryContinents[code])item.continent=countryContinents[code];if(!item.title)item.title=place.displayName||'';setPlacePhotos(place);markDirty();fillFields();$('#location-message').textContent='地址、项目名称和坐标已填入，请核对门店信息';
    }catch(error){$('#location-message').textContent=error.message;}});
    const {Place}=await google.maps.importLibrary('places'),{Map}=await google.maps.importLibrary('maps'),{AdvancedMarkerElement}=await google.maps.importLibrary('marker');$('#google-map').hidden=false;
    googleMap=new Map($('#google-map'),{center:{lat:20,lng:110},zoom:3,mapId:config.googleMapsMapId||'DEMO_MAP_ID',streetViewControl:false,mapTypeControl:false});googlePin=new AdvancedMarkerElement({map:googleMap,gmpDraggable:true,title:'项目位置'});
    googlePin.addListener('dragend',()=>{const pos=googlePin.position;placePhotos=[];Object.assign(item,{lat:typeof pos.lat==='function'?pos.lat():pos.lat,lon:typeof pos.lng==='function'?pos.lng():pos.lng,googlePlaceId:'',googleMapsUrl:'',coordinateSource:'',locationNote:'位置已手动调整',googlePhotoSelections:[]});markDirty();fillFields();renderPlacePhotos();});renderLocation();await loadStoredPlacePhotos(Place);
  }catch(error){$('#location-message').textContent=error.message;}
}
function renderList(){const query=$('#project-search').value.trim().toLowerCase(),type=$('#type-filter').value;const visible=items.filter(i=>(!type||i.type===type)&&(!query||[i.title,i.address,i.city,i.country].some(v=>v?.toLowerCase().includes(query))));$('#case-count').textContent=items.length;$('#list-empty').hidden=visible.length>0;$('#project-list').replaceChildren(...visible.map(i=>entityCard({image:i.cover,title:i.title,subtitle:typeLabel(i.type)||i.industry||'项目',meta:[i.city,i.country].filter(Boolean).join(' · '),onClick:()=>{location.href='admin.html?id='+encodeURIComponent(i.id);}})));}
$('#project-search').oninput=renderList;$('#type-filter').onchange=renderList;
$('#cancel-project').onclick=()=>{location.href='admin.html';};
$('#case-form').onsubmit=async event=>{event.preventDefault();if(busy||uploading)return;const saveAndExit=event.submitter?.dataset.saveAndExit==='true';if(config.storage!=='cloudflare'){$('#action-status').textContent='保存服务尚未连接，请完成 Cloudflare 配置';return;}const errors=caseErrors(item);showErrors(errors,true);if(Object.keys(errors).length)return;
  busy=true;setPhotoControls(true);$('.form-sections').inert=true;$('#save-project').textContent='Saving…';$('#save-and-exit').textContent='Saving…';
  try{
    await syncPendingPhotos();
    item=await saveCase({...item,industry:typeLabel(item.type),status:'active'});dirty=false;if(saveAndExit){location.href='admin.html';return;}history.replaceState(null,'','admin.html?id='+encodeURIComponent(item.id));$('#form-title').textContent='编辑项目';$('#save-state').textContent='已保存';$('#save-state').classList.add('saved');$('#upload-message').textContent='图片已保存';$('#action-status').replaceChildren(document.createTextNode('已保存，网站地图已更新。 '));const link=document.createElement('a');link.href='atlas.html?case='+encodeURIComponent(item.id);link.textContent='查看项目 ↗';$('#action-status').append(link);}
  catch(error){$('#action-status').textContent=error.message;$('#save-state').textContent='保存失败';}
  finally{busy=false;setPhotoControls(false);$('#upload-progress').hidden=true;$('.form-sections').inert=false;$('#save-project').textContent='Save';$('#save-and-exit').textContent='Save and exit';}
};
window.addEventListener('beforeunload',event=>{if(dirty||uploading||busy){event.preventDefault();event.returnValue='';}});
async function openAdmin(){
  config=await runtimeConfig();items=(await loadLibrary({editable:true})).filter(i=>!i.archived);
  $('#page-message').textContent='';$('#type-filter').insertAdjacentHTML('beforeend',caseTypes.map(t=>`<option value="${t.value}">${t.label}</option>`).join(''));
  if(!params.has('new')&&!params.has('id')){$('#library-view').hidden=false;renderList();return;}
  const found=items.find(i=>i.id===params.get('id'));if(params.has('id')&&!found)throw new Error('未找到这个项目，请返回项目合集重新选择');item=found?structuredClone(found):newCase();item.type ||= '';item.revision ||=0;item.area ??=null;item.year ??=null;
  $('#form-view').hidden=false;$('#form-title').textContent=found?'编辑项目':'新增项目';$('#save-state').textContent=found?'已保存':'尚未保存';
  for(const [group,host] of [['basic','#basic-fields'],['location','#location-fields'],['coordinate','#coordinate-fields']])$(host).innerHTML=fields.filter(f=>f.group===group).map(fieldHTML).join('');
  for(const f of fields){const input=$('#'+f.name);input.addEventListener('input',()=>{item[f.name]=numbers.has(f.name)?(input.value===''?null:Number(input.value)):input.value;
    if(['address','country','city'].includes(f.name)){placePhotos=[];item.googlePhotoSelections=[];item.lat=null;item.lon=null;item.googlePlaceId='';item.googleMapsUrl='';item.coordinateSource='';$('#lat').value='';$('#lon').value='';$('#google-link').value='';}
    if(['lat','lon'].includes(f.name)){placePhotos=[];item.googlePhotoSelections=[];item.googlePlaceId='';item.googleMapsUrl='';item.coordinateSource='';$('#google-link').value='';}
    markDirty();renderPreview();renderLocation();renderPlacePhotos();});input.addEventListener('blur',()=>{const error=caseErrors(item)[f.name];$('#error-'+f.name).textContent=error||'';$('#error-'+f.name).hidden=!error;input.setAttribute('aria-invalid',String(!!error));});}
  $('#save-project').textContent='Save';$('#save-project').disabled=config.storage!=='cloudflare';$('#save-and-exit').disabled=config.storage!=='cloudflare';$('#storage-note').textContent=config.storage==='cloudflare'?'保存后，独立地图及网站中嵌入的地图会在刷新时显示更新。':'保存服务尚未连接。完成 Cloudflare 配置后即可保存项目与图片。';if(config.storage!=='cloudflare')$('#action-status').textContent='保存服务尚未连接';fillFields();initGoogle();
}
async function start(){
  const session=await adminSession();$('#page-message').textContent='';
  if(!session.authenticated){$('#login-view').hidden=false;$('#admin-password').focus();return;}
  await openAdmin();
}
start().catch(error=>{$('#page-message').classList.add('error');$('#page-message').textContent=error.message;});
