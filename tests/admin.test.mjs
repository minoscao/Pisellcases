import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await fs.readFile(new URL('../src/web/admin.html',import.meta.url),'utf8');
const script=await fs.readFile(new URL('../pisell-web/build/admin.js',import.meta.url),'utf8');
const seed=JSON.parse(await fs.readFile(new URL('../src/web/data/customers.json',import.meta.url),'utf8'));
const waitFor=async check=>{for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,10));}throw new Error('Timed out waiting for the form');};
function page(path,database,storage='cloudflare',authenticated=true){
  const dom=new JSDOM(html,{url:'https://test.example/'+path,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window;
  w.fetch=async(url,options={})=>{
    const pathname=new URL(url).pathname;
    if(pathname==='/api/config')return Response.json({storage});
    if(pathname==='/api/admin/session')return Response.json({authenticated});
    if(pathname==='/api/admin/login'){if(JSON.parse(options.body).password==='Pisellpisell1'){authenticated=true;return Response.json({ok:true});}return Response.json({error:'密码不正确，请重试'},{status:401});}
    if(options.method==='PUT'){const {item,revision}=JSON.parse(options.body);assert.ok(item.photos.every(p=>p.startsWith('/media/')));database.set(item.id,{...item,revision:revision+1});return Response.json({item:database.get(item.id)});}
    return Response.json({items:[...seed.items,...database.values()]});
  };
  w.XMLHttpRequest=class{upload={};open(method,url){assert.equal(method,'POST');assert.match(String(url),/api\/photos/);}setRequestHeader(name,value){if(name==='Content-Type')assert.equal(value,'image/jpeg');}send(){this.status=201;this.responseText=JSON.stringify({url:'/media/photos/'+crypto.randomUUID()+'.png'});queueMicrotask(()=>this.onload());}};
  w.structuredClone=structuredClone;w.createImageBitmap=async()=>({width:2400,height:1200,close(){}});w.HTMLCanvasElement.prototype.getContext=()=>({fillStyle:'',fillRect(){},drawImage(){}});w.HTMLCanvasElement.prototype.toBlob=function(callback,type,quality){assert.equal(type,'image/jpeg');assert.equal(quality,.6);queueMicrotask(()=>callback(new w.Blob([new Uint8Array([1,2,3])],{type})));};w.URL.createObjectURL=()=> 'blob:https://test.example/'+crypto.randomUUID();w.URL.revokeObjectURL=()=>{};w.eval(script);return dom;
}
test('full-page form saves uploaded photos through the service and reloads shared records',async()=>{
  const database=new Map(),dom=page('admin.html?new=1',database),w=dom.window,$=s=>w.document.querySelector(s);
  await waitFor(()=>!$('#form-view').hidden);assert.equal($('#library-view').hidden,true);
  assert.equal($('#camera-upload').getAttribute('capture'),'environment');assert.equal($('#camera-upload').accept,'image/*');assert.equal($('#photo-upload').hasAttribute('capture'),false);assert.equal($('#photo-upload').multiple,true);
  $('#case-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal($('#form-errors').hidden,false);assert.match($('#form-errors').textContent,/项目名称/);
  for(const [key,value]of Object.entries({title:'New test cafe',type:'kidscafe',year:'2026',area:'350',address:'1 Test Street',country:'Australia',city:'Melbourne',continent:'Oceania',lat:'-37.8',lon:'144.9'})){$('#'+key).value=value;$('#'+key).dispatchEvent(new w.Event('input',{bubbles:true}));}
  const file=new w.File([new Uint8Array([1,2,3])],'test.png',{type:'image/png'});
  for(const input of ['#photo-upload','#camera-upload']){Object.defineProperty($(input),'files',{value:[file],configurable:true});$(input).dispatchEvent(new w.Event('change'));await waitFor(()=>!$('#camera-upload').disabled);}
  assert.equal($('#photo-grid').children.length,2);assert.match($('#project-preview').textContent,/New test cafe/);assert.match($('#photo-count').textContent,/2 \/ 24/);
  $('#case-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>$('#save-state').textContent==='已保存');assert.match(w.location.search,/id=/);assert.match($('#action-status').textContent,/地图已更新/);
  const id=new URL(w.location.href).searchParams.get('id');assert.equal(database.get(id).photos.length,2);dom.window.close();
  const reopened=page('admin.html?id='+id,database);await waitFor(()=>reopened.window.document.querySelector('#title')?.value==='New test cafe');assert.equal(reopened.window.document.querySelector('#area').value,'350');assert.equal(reopened.window.document.querySelector('#photo-grid').children.length,2);reopened.window.close();
});
test('without the database service, the page cannot claim a local save',async()=>{
  const dom=page('admin.html?new=1',new Map(),'static');await waitFor(()=>!dom.window.document.querySelector('#form-view').hidden);
  assert.equal(dom.window.document.querySelector('#save-project').disabled,true);assert.match(dom.window.document.querySelector('#storage-note').textContent,/尚未连接/);assert.doesNotMatch(dom.window.document.body.textContent,/保存到此浏览器/);dom.window.close();
});
test('management page requires the page password before loading projects',async()=>{
  const dom=page('admin.html',new Map(),'cloudflare',false),w=dom.window,$=s=>w.document.querySelector(s);
  await waitFor(()=>!$('#login-view').hidden);assert.equal($('#library-view').hidden,true);
  $('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.match($('#login-error').textContent,/请输入/);
  $('#admin-password').value='Pisellpisell1';$('#login-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await waitFor(()=>!$('#library-view').hidden);assert.equal($('#login-view').hidden,true);dom.window.close();
});
