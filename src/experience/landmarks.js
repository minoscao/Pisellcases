import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

// Display scale is intentionally symbolic; geographic anchors stay on their continent.
export const landmarkSpecs = [
  {region:'North America',id:'statue-of-liberty',name:'Statue of Liberty',point:[-74,40.7],height:1.30,yaw:.15,color:'#67bba8',motion:'torch'},
  {region:'Europe',id:'eiffel-tower',name:'Eiffel Tower',point:[2.35,48.86],height:1.35,yaw:.35,color:'#cdb395',motion:'illumination'},
  {region:'Asia',id:'pagoda',name:'Pagoda',point:[110,25],height:1.02,yaw:.2,color:'#b8c1c6',motion:'illumination'},
  {region:'Africa',id:'great-pyramid',name:'Giza Pyramids',point:[31.13,29.98],height:.65,yaw:.2,color:'#d6ad67',motion:'illumination'},
  {region:'South America',id:'toucan',name:'Toco Toucan',point:[-52,-10],height:.77,yaw:-.65,color:'#deb17c',motion:'perch'},
  {region:'Oceania',id:'kangaroo',name:'Red Kangaroo',point:[126,-24],height:.91,yaw:-.8,color:'#d6a17b',motion:'hop'}
];

const loader=new GLTFLoader();
export const landmarkDisplay={maxSizePx:110,mobileMaxSizePx:76,mobileBreakpoint:760};
const projectedCorner=new THREE.Vector3();
export function landmarkScaleForView(corners,camera,width,height,maxSizePx){
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const corner of corners){
    projectedCorner.copy(corner).project(camera);
    minX=Math.min(minX,projectedCorner.x);maxX=Math.max(maxX,projectedCorner.x);
    minY=Math.min(minY,projectedCorner.y);maxY=Math.max(maxY,projectedCorner.y);
  }
  const pixels=Math.max((maxX-minX)*width/2,(maxY-minY)*height/2);
  return Math.min(1,maxSizePx/Math.max(pixels,1e-6));
}
export function createLandmarks(continents,groundHeight,onMesh){
  const entries=[];
  const ready=Promise.all(landmarkSpecs.map(async(spec,index)=>{
    const gltf=await loader.loadAsync(`assets/landmarks/${spec.id}.glb`);
    const anchor=new THREE.Group(),moving=new THREE.Group(),model=gltf.scene;
    anchor.name=spec.name;anchor.userData.landmark=spec.id;
    const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const scale=spec.height/size.y;
    model.position.set(-center.x,-bounds.min.y,-center.z);model.updateMatrixWorld(true);
    const normalized=new THREE.Group();normalized.add(model);normalized.scale.setScalar(scale);moving.add(normalized);moving.rotation.y=spec.yaw;anchor.add(moving);
    const uniforms={time:{value:0}};
    const materials=[];
    model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.userData.region=spec.region;o.userData.landmark=spec.name;
      const replace=old=>{
        const color=new THREE.Color(spec.color);
        if(spec.motion==='hop'||spec.motion==='perch')color.lerp(old.color||color,.6);
        else color.lerp(old.color||color,.22).multiplyScalar(.45);
        const mat=new THREE.MeshStandardMaterial({color,map:old.map,vertexColors:old.vertexColors,roughness:.62,metalness:.28,envMapIntensity:.10,side:THREE.DoubleSide});
        if(spec.motion==='illumination'){
          mat.onBeforeCompile=s=>{s.uniforms.landmarkTime=uniforms.time;s.vertexShader=s.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 landmarkLocal;').replace('#include <begin_vertex>','#include <begin_vertex>\nlandmarkLocal=position;');s.fragmentShader=s.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 landmarkLocal;uniform float landmarkTime;').replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\nfloat glow=pow(.5+.5*sin(landmarkLocal.y*${(scale*8).toFixed(6)}-landmarkTime*.7),12.);totalEmissiveRadiance+=vec3(.18,.11,.035)*glow;`);};
          mat.customProgramCacheKey=()=>spec.id;
        }
        materials.push(mat);return mat;
      };o.material=Array.isArray(o.material)?o.material.map(replace):replace(o.material);onMesh(o);
    });
    let flame=null;
    if(spec.motion==='torch'){
      // Attach to the uppermost point of the imported statue, after normalization.
      let peak=new THREE.Vector3(0,-Infinity,0),v=new THREE.Vector3();
      model.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y>peak.y)peak.copy(v);}});
      flame=new THREE.Mesh(new THREE.SphereGeometry(.022,12,8),new THREE.MeshBasicMaterial({color:0xffda87}));flame.position.copy(peak.multiplyScalar(scale));flame.scale.set(.7,1.6,.7);moving.add(flame);
    }
    if(spec.id==='great-pyramid'){
      for(const [x,z,s]of [[-.55,.13,.68],[-.9,.27,.42]]){const copy=normalized.clone(true);copy.scale.multiplyScalar(s);copy.position.set(x,0,z);moving.add(copy);copy.traverse(o=>{if(o.isMesh)onMesh(o);});}
    }
    // Cache unit-scale bounds once. Measuring the scaled mesh each frame would oscillate.
    const displayBounds=new THREE.Box3().setFromObject(moving),corners=[];
    for(const x of [displayBounds.min.x,displayBounds.max.x])for(const y of [displayBounds.min.y,displayBounds.max.y])for(const z of [displayBounds.min.z,displayBounds.max.z])corners.push(new THREE.Vector3(x,y,z));
    anchor.position.set(spec.point[0]/18,groundHeight(...spec.point)+.007,-spec.point[1]/18);
    continents.get(spec.region).group.add(anchor);
    entries.push({spec,anchor,moving,flame,uniforms,index,corners});
    return {id:spec.id,height:spec.height,meshes:materials.length};
  }));
  return {ready,update(time,region,reducedMotion,camera,width,height){
    const maxSizePx=width<landmarkDisplay.mobileBreakpoint?landmarkDisplay.mobileMaxSizePx:landmarkDisplay.maxSizePx;
    for(const e of entries){
      e.anchor.visible=!region||region===e.spec.region;
      // The camera already eases its zoom; apply compensation immediately to avoid overshoot.
      e.anchor.scale.setScalar(landmarkScaleForView(e.corners,camera,width,height,e.spec.maxSizePx??maxSizePx));
      const t=reducedMotion?0:time+e.index*.83;e.uniforms.time.value=t;
      if(e.spec.motion==='hop'){
        const phase=(t%3.2)/3.2,air=phase>.16&&phase<.40?(phase-.16)/.24:0;
        const jump=4*air*(1-air),crouch=phase<.16?Math.sin(phase/.16*Math.PI):phase>.40&&phase<.46?Math.sin((phase-.40)/.06*Math.PI)*.5:0;
        e.moving.position.y=jump*.30;
        e.moving.scale.set(1+crouch*.035,1-crouch*.075,1+crouch*.025);
        e.moving.rotation.z=jump*.10;
      }else if(e.spec.motion==='perch'){
        e.moving.rotation.y=e.spec.yaw+Math.sin(t*.65)*.16;e.moving.rotation.z=Math.sin(t*1.3)*.035;
      }else if(e.flame){e.flame.scale.y=1.55+Math.sin(t*5)*.20+Math.sin(t*8.7)*.1;}
    }
  }};
}
