// Run against an isolated local Wrangler instance, never a production URL.
import assert from 'node:assert/strict';
const base=process.env.PISELL_TEST_URL||'http://127.0.0.1:4192';
assert.equal(new URL(base).hostname,'127.0.0.1');
const call=async(path,method='GET',body,type='application/json')=>fetch(base+path,{method,headers:{Origin:base,'Content-Type':type},body:body==null?undefined:type==='application/json'?JSON.stringify(body):body});
const initial=await (await call('/api/cases')).json();assert.ok(initial.items.some(i=>i.id==='gotcha'));assert.equal((await call('/admin.html')).status,200);
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7xkAAAAASUVORK5CYII=','base64');
const uploaded=await call('/api/photos','POST',image,'image/png');assert.equal(uploaded.status,201);const {url}=await uploaded.json();assert.equal((await call(url)).status,200);
const id='qa-'+crypto.randomUUID(),item={id,title:'Local integration test',address:'1 Test Street',country:'Australia',city:'Melbourne',continent:'Oceania',type:'kidscafe',year:2026,area:350,lat:-37.8,lon:144.9,photos:[url],cover:url};
const saved=await call('/api/cases/'+id,'PUT',{item,revision:0});assert.equal(saved.status,200,await saved.clone().text());assert.equal((await saved.json()).item.revision,1);
const writers=await Promise.all([call('/api/cases/'+id,'PUT',{item:{...item,title:'Writer A'},revision:1}),call('/api/cases/'+id,'PUT',{item:{...item,title:'Writer B'},revision:1})]);assert.deepEqual(writers.map(r=>r.status).sort(),[200,409]);
assert.equal((await call('/api/photos','POST','not a png','image/png')).status,415);
assert.equal((await fetch(base+'/api/photos',{method:'POST',headers:{Origin:'https://other.example','Content-Type':'image/png'},body:image})).status,403);
assert.equal((await call('/api/cases/'+id,'PUT',{item:{...item,lat:1000},revision:2})).status,400);
const loaded=await (await call('/api/cases')).json();assert.equal(loaded.items.find(i=>i.id===id).revision,2);
console.log('PASS: D1 save/read, R2 upload/read, concurrent-write protection, invalid coordinates, file format, and request origin.');
