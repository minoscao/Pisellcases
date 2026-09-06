// One shared source: published JSON before setup, Cloudflare D1 after deployment.
const root=new URL('./',location.href);
let configPromise;
export async function runtimeConfig(){
  return configPromise ||= (async()=>{
    const response=await fetch(new URL('api/config',root));
    if(response.status===404||response.headers.get('content-type')?.includes('text/html'))return {storage:'static'};
    if(!response.ok)throw new Error('暂时无法连接案例库，请刷新重试');
    const config=await response.json();return config.storage==='cloudflare'?config:{storage:'static'};
  })();
}
async function request(path,options={}){
  const response=await fetch(new URL(path,root),{credentials:'same-origin',...options});
  const data=await response.json().catch(()=>({error:'请先登录管理页面，再重试'}));
  if(!response.ok)throw new Error(data.error||'操作未完成，请重试');return data;
}
export async function loadLibrary(){return (await request((await runtimeConfig()).storage==='cloudflare'?'api/cases':'cases.json')).items;}
export async function saveCase(item){
  if((await runtimeConfig()).storage!=='cloudflare')throw new Error('保存服务尚未连接，请完成 Cloudflare 配置后重试');
  return (await request('api/cases/'+encodeURIComponent(item.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({item,revision:item.revision||0})})).item;
}
export async function saveLibrary(){throw new Error('请点击项目下方的「编辑详情」，在录入页面保存项目');}
export async function uploadPhoto(file,onProgress=()=>{}){
  if((await runtimeConfig()).storage!=='cloudflare')throw new Error('图片保存服务尚未连接，请完成 Cloudflare 配置后重试');
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',new URL('api/photos',root));xhr.withCredentials=true;xhr.setRequestHeader('Content-Type',file.type);
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{let data;try{data=JSON.parse(xhr.responseText);}catch{return reject(new Error('请先登录管理页面，再上传图片'));}xhr.status===201?resolve(data.url):reject(new Error(data.error||'上传失败，请重试'));};
    xhr.onerror=()=>reject(new Error('网络中断，图片未上传，请重试'));xhr.ontimeout=()=>reject(new Error('上传超时，请重试'));xhr.timeout=120000;xhr.send(file);
  });
}
