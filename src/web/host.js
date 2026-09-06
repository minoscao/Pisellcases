import {loadLibrary,saveLibrary,runtimeConfig} from './library.mjs';
const root=new URL('./',location.href),editable=new URL(location.href).searchParams.get('editor')==='1';
const result=async items=>({items,folder:(await runtimeConfig()).storage==='cloudflare'?'Cloud library':'Published customer library',warnings:[]});
window.atlasHost={
  load:async()=>{window.atlasHost.remote=true;return result(await loadLibrary());},
  async save(items){if(!editable)throw new Error('Open the case editor to make changes.');const clean=items.filter(i=>!i.archived).map(({uploads,...item})=>item);if(clean.some(i=>!i.title?.trim()||!i.country?.trim()))throw new Error('请先填写项目名称和国家，再打开录入页');return result(await saveLibrary(clean));},
  openProject(id){location.href=new URL('admin.html?'+(id?'id='+encodeURIComponent(id):'new=1'),root).href;}
};
document.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('open-editor').hidden=!editable;
  const exportButton=document.getElementById('export-data');
  exportButton.addEventListener('click',async event=>{event.stopImmediatePropagation();try{const {items}=await window.atlasHost.load();const url=URL.createObjectURL(new Blob([JSON.stringify({items},null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='cases.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(error){document.getElementById('editor-message').textContent=error.message;}},true);
  exportButton.textContent='Export saved cases';
  document.getElementById('add-case').textContent='+ Add new';
  document.querySelector('.footer-tag').textContent='PISELL CUSTOMER COMMUNITY';
});
