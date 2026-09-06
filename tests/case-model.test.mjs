import test from 'node:test';
import assert from 'node:assert/strict';
import {caseErrors,newCase,parseGoogleMapsLink} from '../src/web/case-model.mjs';
import {authorize} from '../cloudflare/worker.mjs';
test('Google Maps reads the business coordinate, not the camera centre',()=>{
  const place=parseGoogleMapsLink('https://www.google.com/maps/place/Test/@1,2,14z/data=!3d-37.81!4d144.96');
  assert.equal(place.lat,-37.81);assert.equal(place.lon,144.96);
  assert.throws(()=>parseGoogleMapsLink('https://www.google.com/maps/place/Test/@1,2,14z'));
  assert.throws(()=>parseGoogleMapsLink('https://www.google.com/maps?ll=1,2'));
  assert.throws(()=>parseGoogleMapsLink('https://example.com/?q=1,2'));
  assert.throws(()=>parseGoogleMapsLink('https://maps.app.goo.gl/test'));
  assert.equal(parseGoogleMapsLink('https://www.google.com/maps/search/?api=1&query=0,0').lat,0);
});
test('new case requires a location, category, and valid cover',()=>{
  const item=newCase();assert.ok(caseErrors(item).lat);assert.ok(caseErrors(item).photos);
  Object.assign(item,{title:'Test',address:'1 Example Street',country:'Australia',city:'Melbourne',continent:'Oceania',type:'kidscafe',lat:0,lon:0,photos:['photo.jpg'],cover:'photo.jpg'});
  assert.deepEqual(caseErrors(item),{});item.cover='missing.jpg';assert.ok(caseErrors(item).photos);item.year=2026.5;assert.ok(caseErrors(item).year);
});
test('production management fails closed and cannot use a forged identity header',async()=>{
  await assert.rejects(authorize(new Request('https://cases.example.com/admin.html'),{LOCAL_DEV:'true'}),{status:503});
  await assert.rejects(authorize(new Request('https://cases.example.com/api/photos',{headers:{'Cf-Access-Authenticated-User-Email':'fake@example.com'}}),{ACCESS_TEAM_DOMAIN:'example.cloudflareaccess.com',ACCESS_AUD:'test'}),{status:401});
  await authorize(new Request('http://127.0.0.1:4192/admin.html'),{LOCAL_DEV:'true'});
});
