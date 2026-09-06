import {createRemoteJWKSet,jwtVerify} from 'jose';
import seed from '../src/web/data/customers.json' with {type:'json'};
import {caseErrors,photoLimits,typeLabel} from '../src/web/case-model.mjs';
const keySets=new Map(),seedItems=new Map(seed.items.map(item=>[item.id,item]));
const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const error=(message,status=400)=>Object.assign(new Error(message),{status});
export async function authorize(request,env){
  if(env.LOCAL_DEV==='true'&&['127.0.0.1','localhost','[::1]'].includes(new URL(request.url).hostname))return;
  if(!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD)throw error('管理登录尚未配置，请先完成 Cloudflare Access 设置',503);
  const issuer='https://'+env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//,'').replace(/\/$/,'');
  const token=request.headers.get('Cf-Access-Jwt-Assertion')||request.headers.get('cookie')?.match(/(?:^|;\s*)CF_Authorization=([^;]+)/)?.[1];
  if(!token)throw error('请先登录案例管理页面',401);
  try{let keys=keySets.get(issuer);if(!keys){keys=createRemoteJWKSet(new URL(issuer+'/cdn-cgi/access/certs'));keySets.set(issuer,keys);}await jwtVerify(token,keys,{issuer,audience:env.ACCESS_AUD,algorithms:['RS256']});}
  catch{throw error('登录已过期，请重新打开案例管理页面',401);}
}
function sameOrigin(request){const origin=request.headers.get('origin');if(origin!==new URL(request.url).origin)throw error('请从案例管理页面提交',403);}
async function readBytes(request,limit){
  if(Number(request.headers.get('Content-Length'))>limit)throw error('上传内容过大',413);
  if(!request.body)throw error('未收到上传内容');
  const reader=request.body.getReader(),chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw error('上传内容过大',413);}chunks.push(value);}
  const result=new Uint8Array(size);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.byteLength;}return result;
}
function safeLink(value){if(!value)return '';try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
function cleanItem(raw,id){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw error('项目信息格式不正确');
  const item={id,customerId:String(raw.customerId||id).slice(0,160),status:'active'};
  for(const [field,limit]of Object.entries({title:160,address:500,country:100,city:100,continent:40,type:40,description:2000,locationNote:500,locationPrecision:100,googlePlaceId:300}))item[field]=typeof raw[field]==='string'?raw[field].trim().slice(0,limit):'';
  for(const field of ['year','area','lat','lon'])item[field]=typeof raw[field]==='number'?raw[field]:null;
  for(const field of ['sourceUrl','googleMapsUrl','coordinateSource'])item[field]=safeLink(raw[field]);
  const validPhoto=p=>typeof p==='string'&&(/^(?:\/)?media\/photos\/[a-f0-9-]+\.(jpg|png|webp)$/.test(p)||seed.items.some(s=>s.photos.includes(p)));
  if(!Array.isArray(raw.photos)||raw.photos.some(p=>!validPhoto(p)))throw error('请重新上传图片，不能使用浏览器临时图片或外部文件路径');
  item.photos=[...new Set(raw.photos)];item.cover=raw.cover;item.industry=typeLabel(item.type);
  item.photoCredits=Array.isArray(raw.photoCredits)?raw.photoCredits.slice(0,24).map(p=>({url:safeLink(p.url),source:safeLink(p.source),label:String(p.label||'').slice(0,200)})):[];
  const errors=caseErrors(item);if(Object.keys(errors).length)throw error(Object.values(errors).join('；'));
  return item;
}
async function cases(env){const {results}=await env.DB.prepare('SELECT id, data, revision FROM case_records ORDER BY updated_at DESC').all();const merged=new Map([...seedItems].map(([id,item])=>[id,{...item,revision:0}]));for(const row of results)merged.set(row.id,{...JSON.parse(row.data),revision:row.revision});return [...merged.values()];}
async function putCase(request,env,id){
  if(!/^[a-zA-Z0-9_-]{1,160}$/.test(id))throw error('项目编号不正确');
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw error('请使用项目表单保存');
  let body;try{body=JSON.parse(new TextDecoder().decode(await readBytes(request,100*1024)));}catch(e){if(e.status)throw e;throw error('项目信息读取失败');}
  const item=cleanItem(body.item,id),revision=body.revision;
  if(!Number.isInteger(revision)||revision<0)throw error('请刷新页面后重试');
  for(const photo of item.photos.filter(p=>/^\/?media\//.test(p))){if(!await env.PHOTOS.head(photo.replace(/^\/?media\//,'')))throw error('部分图片未上传成功，请重新上传');}
  // Atomic revision check prevents one editor from overwriting another editor's save.
  const result=await env.DB.prepare(`INSERT INTO case_records (id,data,revision,updated_at)
    SELECT ?1,?2,1,?3 WHERE ?4=0 OR EXISTS (SELECT 1 FROM case_records WHERE id=?1)
    ON CONFLICT(id) DO UPDATE SET data=excluded.data,revision=case_records.revision+1,updated_at=excluded.updated_at WHERE case_records.revision=?4`).bind(id,JSON.stringify(item),new Date().toISOString(),revision).run();
  if(result.meta.changes!==1)throw error('这个项目刚刚被其他人更新，请刷新后再编辑',409);
  return json({item:{...item,revision:revision+1}});
}
async function upload(request,env){
  const type=request.headers.get('Content-Type')?.split(';')[0];if(!photoLimits.types.includes(type))throw error('仅支持 JPG、PNG、WebP 图片',415);
  const bytes=await readBytes(request,photoLimits.bytes),ascii=(start,end)=>new TextDecoder().decode(bytes.slice(start,end));
  const matches=type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/png'?[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n):ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP';
  if(!matches)throw error('图片格式不正确，请重新选择图片',415);
  const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type],key=`photos/${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key,bytes,{httpMetadata:{contentType:type,cacheControl:'public, max-age=31536000, immutable'}});
  return json({url:'/media/'+key},201);
}
export default {async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  try{
    if(path==='/api/config'&&request.method==='GET')return json({storage:'cloudflare',googleMapsApiKey:env.GOOGLE_MAPS_API_KEY||'',googleMapsMapId:env.GOOGLE_MAPS_MAP_ID||''});
    if(path==='/api/cases'&&request.method==='GET')return json({items:await cases(env)});
    if(path.startsWith('/media/')&&['GET','HEAD'].includes(request.method)){
      const key=path.slice(7);if(!/^photos\/[a-f0-9-]+\.(jpg|png|webp)$/.test(key))return json({error:'图片不存在'},404);
      const object=await env.PHOTOS.get(key);if(!object)return json({error:'图片不存在'},404);
      const headers=new Headers({'X-Content-Type-Options':'nosniff'});object.writeHttpMetadata(headers);headers.set('ETag',object.httpEtag);return new Response(request.method==='HEAD'?null:object.body,{headers});
    }
    if(path.startsWith('/api/')||path.startsWith('/admin')){
      await authorize(request,env);
      if(!['GET','HEAD'].includes(request.method))sameOrigin(request);
      if(path==='/api/photos'&&request.method==='POST')return await upload(request,env);
      if(path.startsWith('/api/cases/')&&request.method==='PUT')return await putCase(request,env,path.slice('/api/cases/'.length));
      if(path.startsWith('/api/'))return json({error:'此操作不可用'},405);
    }
    const response=await env.ASSETS.fetch(request);
    const headers=new Headers(response.headers);headers.set('X-Content-Type-Options','nosniff');
    if(path.startsWith('/admin')){headers.set('Cache-Control','no-store');headers.set('Content-Security-Policy',"frame-ancestors 'self'");}
    return new Response(response.body,{status:response.status,headers});
  }catch(e){return json({error:e.status?e.message:'服务暂时不可用，请检查存储配置后重试'},e.status||503);}
}};
