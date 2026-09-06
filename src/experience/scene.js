import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createExhibit,flowingBackdrop} from './studio.js';
import {terrainMaterial} from './surface.js';
import {createLandmarks} from './landmarks.js';
import model from './world-model.json';
import {config,regions,regionById,landscapes,summary,formatNumber} from './config.js';
const motion=matchMedia('(prefers-reduced-motion: reduce)').matches;
export const geoPoint=(lon,lat,y=0)=>new THREE.Vector3(lon/18,y,-lat/18);
function groundHeight(lon,lat){const f=model.heightfield,x=THREE.MathUtils.clamp(Math.round((lon+180)/360*359),0,359),y=THREE.MathUtils.clamp(Math.round((90-lat)/180*179),0,179);return .12+Math.pow(Math.max(0,(f.data[y*360+x]-24)/231),1.25)*.42;}
export function createAtlasScene(container,{onHover,onRegion,onCase}){
  const canvas=container.querySelector('canvas'),labels=container.querySelector('.map-labels');let renderer;
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch{return {setData(){},focus(){},highlight(){},reset(){},zoom(){},setEnabled(){},available:false};}
  renderer.setPixelRatio(Math.min(devicePixelRatio,config.render.dpr));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=config.scene?.exposure ?? .78;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(config.scene?.background ?? 0x091523);scene.fog=new THREE.Fog(config.scene?.background ?? 0x091523,30,65);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.03).texture;room.dispose();pmrem.dispose();
  const camera=new THREE.OrthographicCamera(-10,10,7,-7,.1,140);
  const look=new THREE.Vector3(0,0,-.4),targetLook=look.clone();let span=8,targetSpan=8,region=null,hover=null,enabled=true,width=1,height=1;
  camera.position.set(1,16,13);camera.lookAt(look);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(1200,700),.12,.2,1.1));composer.addPass(new OutputPass());const antialias=new ShaderPass(FXAAShader);composer.addPass(antialias);
  const light=new THREE.DirectionalLight(0xe1eeff,2.1);light.position.set(-8,16,-3);light.castShadow=true;light.shadow.mapSize.set(2048,2048);Object.assign(light.shadow.camera,{left:-15,right:15,top:12,bottom:-12,near:.1,far:50});light.shadow.bias=-.0002;light.shadow.normalBias=.015;light.shadow.radius=3;scene.add(light);
  scene.add(new THREE.HemisphereLight(0xb0cee8,0x070e1b,config.scene?.ambient ?? .4));
  const fill=new THREE.DirectionalLight(0x457ef2,.65);fill.position.set(8,5,5);scene.add(fill);
  const backdrop=flowingBackdrop(config.scene?.backdrop);const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),backdrop);floor.rotation.x=-Math.PI/2;floor.position.y=-.075;scene.add(floor);
  const shadowFloor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({color:0x00030a,opacity:.48,depthWrite:false}));shadowFloor.rotation.x=-Math.PI/2;shadowFloor.position.y=-.07;shadowFloor.receiveShadow=true;scene.add(shadowFloor);
  const continental=new Map(),meshes=[],exhibits=[];
  for(const [index,r]of regions.entries()){
    const data=model[r.id],group=new THREE.Group(),theme=landscapes[r.id];
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(data.positions.map((v,i)=>i%3===1?v-.13:v),3));const uv=[];for(let i=0;i<data.positions.length;i+=3)uv.push((data.positions[i]*18+180)/360,(-data.positions[i+2]*18+90)/180);geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(data.indices);geometry.computeVertexNormals();
    const {material,uniforms}=terrainMaterial(theme,r.id);const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.region=r.id;group.add(mesh);meshes.push(mesh);
    const walls=new THREE.BufferGeometry();walls.setAttribute('position',new THREE.Float32BufferAttribute(data.walls.map((v,i)=>i%3===1?(v<0?-.03:v-.13):v),3));walls.computeVertexNormals();const wall=new THREE.Mesh(walls,new THREE.MeshPhysicalMaterial({color:0x143357,roughness:.42,metalness:.3,clearcoat:.3,envMapIntensity:.1,side:THREE.DoubleSide}));wall.castShadow=true;wall.receiveShadow=true;wall.userData.region=r.id;group.add(wall);meshes.push(wall);
    wall.material.color.set(theme.color).multiplyScalar(.35);
    const line=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(data.rim.map((v,i)=>i%3===1?v-.13:v),3)),new THREE.LineBasicMaterial({color:theme.edge,transparent:true,opacity:.32}));line.position.y=.003;group.add(line);
    const base=geometry.clone();const pos=base.attributes.position;for(let i=0;i<pos.count;i++)pos.setY(i,-.029);base.computeVertexNormals();const bottom=new THREE.Mesh(base,new THREE.MeshStandardMaterial({color:0x102745,roughness:.35,metalness:.4,side:THREE.DoubleSide}));group.add(bottom);
    const button=document.createElement('button');button.className='continent-label region-overview';button.dataset.region=r.id;button.style.setProperty('--region-accent',theme.edge);button.setAttribute('aria-label',`Explore ${r.name}`);button.addEventListener('pointerenter',()=>onHover(r.id));button.addEventListener('pointerleave',()=>onHover(null));button.addEventListener('focus',()=>onHover(r.id));button.addEventListener('blur',()=>onHover(null));button.addEventListener('click',()=>onRegion(r.id));labels.append(button);
    scene.add(group);continental.set(r.id,{group,material,uniforms,line,label:button,index,point:geoPoint(...r.label,.85)});
  }
  const landmarks=createLandmarks(continental,groundHeight,mesh=>meshes.push(mesh));
  landmarks.ready.then(items=>{container.dataset.landmarks=String(items.length);}).catch(error=>{container.dataset.landmarks='error';console.error('Landmark loading failed',error);});
  const pinGroup=new THREE.Group();scene.add(pinGroup);let pins=[];
  function setData(items){
    for(const child of [...pinGroup.children]){child.traverse(o=>{o.geometry?.dispose();o.material?.map?.dispose();o.material?.dispose();});pinGroup.remove(child);}pins.forEach(p=>p.label.remove());pins=[];exhibits.length=0;
    for(const r of regions){const stats=summary(items.filter(i=>i.continent===r.id));continental.get(r.id).label.innerHTML=`<div class="overview-heading"><strong>${r.name}</strong><span aria-hidden="true">↗</span></div><div class="overview-landscape">${landscapes[r.id].terrain}</div><div class="overview-stats"><div><b>${String(stats.count).padStart(2,'0')}</b><small>${config.customerLibrary?'Locations':'Projects'}</small></div><div><b>${String(stats.countries).padStart(2,'0')}</b><small>Countries</small></div></div><div class="overview-area"><span>${config.customerLibrary?'Customers':'Recorded area'}</span><b>${config.customerLibrary?new Set(items.filter(i=>i.continent===r.id).map(i=>i.customerId)).size:stats.count?formatNumber(stats.area)+' m²':'—'}</b></div>`;}
    const mapItems=items.filter(i=>i.lat!=null&&i.lon!=null);
    const displayItems=config.customerLibrary?Object.values(mapItems.reduce((groups,i)=>{(groups[i.continent+'|'+i.city]??=[]).push(i);return groups;},{})).map(group=>group.length>1?{...group[0],id:'cluster-'+group[0].city,title:group[0].city+' · '+group.length+' locations',lat:group.reduce((n,i)=>n+i.lat,0)/group.length,lon:group.reduce((n,i)=>n+i.lon,0)/group.length,clusterCity:group[0].city}:group[0]):mapItems;
    for(const item of displayItems){
      const group=createExhibit(item),elevation=groundHeight(item.lon,item.lat);group.visible=false;group.position.copy(geoPoint(item.lon,item.lat,elevation));pinGroup.add(group);group.traverse(o=>{if(o.isMesh)exhibits.push(o);});
      const label=document.createElement('button');label.className='project-pin';label.textContent=item.title;label.setAttribute('aria-label',`View project ${item.title}`);label.onclick=()=>item.clusterCity?document.dispatchEvent(new CustomEvent('atlas:location-city',{detail:item.clusterCity})):onCase(item.id);label.hidden=true;labels.append(label);pins.push({item,group,label,elevation});
    }
  }
  function worldSpan(){return Math.max(4.65,10.65/(width/height));}
  function focus(id){region=id;hover=null;const r=regionById[id];targetLook.copy(r?geoPoint(...r.center):new THREE.Vector3(0,0,-.4));targetSpan=r?Math.max(r.span*.235,r.span/(width/height)*.52):worldSpan();}
  function resize(){width=container.clientWidth;height=container.clientHeight;if(!width||!height)return;renderer.setSize(width,height,false);composer.setSize(width,height);antialias.uniforms.resolution.value.set(1/(width*renderer.getPixelRatio()),1/(height*renderer.getPixelRatio()));focus(region);}
  const observer=new ResizeObserver(resize);observer.observe(container);
  const pointer=new THREE.Vector2(),raycaster=new THREE.Raycaster();let down=null;
  function hit(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObjects(meshes).find(h=>{for(let o=h.object;o;o=o.parent)if(!o.visible)return false;return true;})?.object.userData.region || null;}
  canvas.addEventListener('pointermove',event=>{if(!enabled)return;const id=hit(event);canvas.style.cursor=id?'pointer':'grab';if(!down)onHover(id);else {const dx=(event.clientX-down.x)/width*span*2*(width/height),dz=(event.clientY-down.y)/height*span*2;targetLook.x-=dx;targetLook.z-=dz;down.x=event.clientX;down.y=event.clientY;}});
  canvas.addEventListener('pointerleave',()=>onHover(null));
  canvas.addEventListener('pointerdown',event=>{if(event.button!==0)return;down={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};canvas.setPointerCapture(event.pointerId);});
  canvas.addEventListener('pointerup',event=>{if(!down)return;const distance=Math.hypot(event.clientX-down.startX,event.clientY-down.startY);down=null;if(distance<6&&enabled){const id=hit(event);if(region){const exhibit=raycaster.intersectObjects(exhibits).find(h=>h.object.visible&&h.object.parent.visible);if(exhibit){onCase(exhibit.object.userData.caseId);return;}}if(id)onRegion(id);}});
  canvas.addEventListener('pointercancel',()=>{down=null;});
  canvas.addEventListener('wheel',event=>{event.preventDefault();targetSpan=THREE.MathUtils.clamp(targetSpan*Math.exp(event.deltaY*.001),1.5,Math.max(14,worldSpan()*1.6));},{passive:false});
  const projected=new THREE.Vector3();
  function place(element,point,occupied){projected.copy(point).project(camera);let x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height;
    if(element.classList.contains('region-overview')){if(width<760){const offsets={'Asia':[14,-20],'Europe':[-24,-65],'North America':[-13,-28],'South America':[-15,35],'Africa':[0,18],'Oceania':[9,35]};const offset=offsets[element.dataset.region];x+=offset[0];y+=offset[1];}const half=element.offsetWidth/2;x=THREE.MathUtils.clamp(x,half+12,width-half-12);}
    if(occupied){const w=element.offsetWidth||130,h=element.offsetHeight||44;for(let attempt=0;attempt<20;attempt++){if(!occupied.some(p=>Math.abs(p.x-x)<(p.w+w)/2+8&&Math.abs(p.y-y)<(p.h+h)/2+8))break;y-=h+10;}occupied.push({x,y,w,h});}
    element.style.transform=`translate(${Math.round(x*2)/2}px,${Math.round(y*2)/2}px) translate(-50%,-50%)`;element.classList.toggle('offscreen',x<0||x>width||y<0||y>height);}
  let previous=0,startTime=null;const drift=new THREE.Vector2(),targetDrift=new THREE.Vector2();
  canvas.addEventListener('pointermove',event=>{const rect=canvas.getBoundingClientRect();targetDrift.set((event.clientX-rect.left)/rect.width-.5,(event.clientY-rect.top)/rect.height-.5);});
  canvas.addEventListener('pointerleave',()=>targetDrift.set(0,0));
  function animate(time){requestAnimationFrame(animate);if(document.hidden||!enabled)return;if(startTime===null)startTime=time;const elapsed=Math.min(time-previous,1000);previous=time;const amount=motion?1:1-Math.exp(-elapsed/230);
    look.lerp(targetLook,amount);span=THREE.MathUtils.lerp(span,targetSpan,amount);drift.lerp(motion?new THREE.Vector2():targetDrift,amount*.35);const reveal=motion?1:THREE.MathUtils.smoothstep((time-startTime)/2000,0,1);camera.position.copy(look).add(new THREE.Vector3(1+drift.x*1.25+(1-reveal)*3,16+drift.y*.7-(1-reveal)*4,13+(1-reveal)*5));camera.lookAt(look);camera.left=-span*width/height;camera.right=span*width/height;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();
    backdrop.uniforms.time.value=motion?0:(time-startTime)*.001;
    camera.updateMatrixWorld(true);
    landmarks.update((time-startTime)*.001,region,motion,camera,width,height);
    for(const [id,c]of continental){const active=id===(region||hover);const entry=motion?1:THREE.MathUtils.smoothstep((time-startTime-c.index*65)/1250,0,1);const target=(active?.32:0)-(1-entry)*.8;c.group.position.y=THREE.MathUtils.lerp(c.group.position.y,target,amount);c.uniforms.selection.value=THREE.MathUtils.lerp(c.uniforms.selection.value,active?1:0,amount);c.line.material.opacity=active?.48:.2;c.label.hidden=!!region;c.label.classList.toggle('highlighted',active);place(c.label,c.point);}
    const occupied=[];
    for(const pin of pins){const c=continental.get(pin.item.continent);pin.group.position.y=pin.elevation+(c?.group.position.y||0);pin.group.visible=!!region&&pin.item.continent===region;pin.label.hidden=!region||pin.item.continent!==region;if(!pin.label.hidden)place(pin.label,pin.group.position.clone().add(new THREE.Vector3(0,.76,0)),occupied);}
    composer.render();
  }
  resize();requestAnimationFrame(animate);
  return {available:true,setData,focus,highlight(id){hover=id;},reset(){focus(region);},zoom(factor){targetSpan=THREE.MathUtils.clamp(targetSpan*factor,1.5,Math.max(14,worldSpan()*1.6));},setEnabled(value){enabled=value;}};
}


