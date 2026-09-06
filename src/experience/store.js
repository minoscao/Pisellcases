const listeners = new Set();
export const state = {items:[],region:null,hover:null,caseId:null,photo:0,view:'atlas',folder:'',warnings:[],loading:true};
export function update(values){Object.assign(state,values);for(const listener of listeners) listener(state);}
export function subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);}
export function regionItems(region=state.region){return state.items.filter(item=>!region || item.continent===region);}
async function request(method,items){
  if(window.atlasHost) return method==='GET'?window.atlasHost.load():window.atlasHost.save(items);
  const response=await fetch('/api/cases',{method,headers:items?{'Content-Type':'application/json'}:undefined,body:items?JSON.stringify({items}):undefined});
  if(!response.ok) {let message='Unable to read the project folder.';try{message=(await response.json()).error || message;}catch{}throw new Error(message);}
  return response.json();
}
export async function load(){const data=await request('GET');update({...data,loading:false});return data;}
export async function save(items){const data=await request('PUT',items);update({...data,loading:false});return data;}
