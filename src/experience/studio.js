import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

export function flowingBackdrop(palette){
  if(palette) return new THREE.ShaderMaterial({uniforms:{time:{value:0},base:{value:new THREE.Color(palette.base)},tint:{value:new THREE.Color(palette.tint)}},vertexShader:"varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:`varying vec3 p;uniform float time;uniform vec3 base;uniform vec3 tint;void main(){float wave=sin(p.x*.25+time*.12)*2.;float ribbon=exp(-pow((p.y-wave)*.15,2.));vec3 color=mix(base,tint,ribbon*.35);gl_FragColor=vec4(color,1.);}`});
  return new THREE.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 p;uniform float time;
    void main(){vec2 q=p.xy;float pool=exp(-dot(q,q)/240.);vec3 color=mix(vec3(.006,.012,.028),vec3(.012,.039,.078),pool);
    float bend=sin(q.x*.18-time*.19)*2.4+sin(q.x*.32+time*.13)*.7;
    float ribbon=exp(-pow((q.y-bend-4.)*.57,2.));float ribbon2=exp(-pow((q.y+sin(q.x*.15-time*.12)*3.+6.)*.45,2.));
    float strands=pow(.5+.5*sin((q.y-bend)*21.+q.x*.4-time*.35),18.);
    color+=vec3(.012,.055,.10)*ribbon*(.45+strands*.55)+vec3(.025,.022,.075)*ribbon2;
    float caustic=pow(max(0.,sin(q.x*.8+sin(q.y*.5+time*.24))*cos(q.y*.65+sin(q.x*.45-time*.17))),12.);
    color+=vec3(.006,.028,.044)*caustic*pool;gl_FragColor=vec4(color,1.);}`});
}

export function createExhibit(item){
  const group=new THREE.Group();
  const satin=new THREE.MeshPhysicalMaterial({color:0xd0dbe6,roughness:.23,metalness:.55,clearcoat:.7});
  const podium=new THREE.Mesh(new RoundedBoxGeometry(.48,.07,.35,2,.025),new THREE.MeshStandardMaterial({color:0x163d70,roughness:.28,metalness:.4}));podium.position.y=.045;group.add(podium);
  const frame=new THREE.Mesh(new RoundedBoxGeometry(.36,.28,.045,3,.027),satin);frame.position.set(0,.235,-.015);group.add(frame);
  if(item.cover){const texture=new THREE.TextureLoader().load(item.cover);texture.colorSpace=THREE.SRGBColorSpace;const image=new THREE.Mesh(new THREE.PlaneGeometry(.325,.235),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));image.position.set(0,.235,.010);group.add(image);}
  const accent=new THREE.Mesh(new THREE.BoxGeometry(.28,.009,.006),new THREE.MeshBasicMaterial({color:0x8dc9e8}));accent.position.set(0,.10,.17);group.add(accent);
  group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.userData.caseId=item.id;}});
  return group;
}
