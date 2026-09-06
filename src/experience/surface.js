import * as THREE from 'three';

// Shared equirectangular geography textures; no oversized individual vegetation props.
const loader=new THREE.TextureLoader();
const surface=loader.load('assets/maps-surface.jpg');surface.colorSpace=THREE.SRGBColorSpace;surface.anisotropy=8;
const relief=loader.load('assets/maps-elevation.jpg');relief.anisotropy=8;
export function terrainMaterial(theme){
  const uniforms={selection:{value:0},landSurface:{value:surface}};
  const material=new THREE.MeshPhysicalMaterial({color:theme.color,bumpMap:relief,bumpScale:.025,roughness:.82,metalness:.04,clearcoat:.03,specularIntensity:.3,clearcoatRoughness:.6,envMapIntensity:.04});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 terrainPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nterrainPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 terrainPosition;uniform float selection;uniform sampler2D landSurface;
    `).replace('#include <color_fragment>',`#include <color_fragment>
      vec2 geographyUv=vec2((terrainPosition.x*18.+180.)/360.,(-terrainPosition.z*18.+90.)/180.);
      vec3 land=texture2D(landSurface,geographyUv).rgb;
      float lightness=dot(land,vec3(.2126,.7152,.0722));
      diffuseColor.rgb*=.32+clamp(lightness*2.8,0.,.85);
      diffuseColor.rgb=mix(diffuseColor.rgb,land*.65,.40);
      float vegetation=smoothstep(.0,.045,land.g-land.r)*(1.-smoothstep(.22,.50,lightness));
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.45,.75,.55),vegetation*.65);
      float snow=smoothstep(.50,.82,lightness);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.69,.76,.81),snow*.7);
      diffuseColor.rgb*=1.+selection*.17;`);
  };
  return {material,uniforms};
}
