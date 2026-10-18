import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const loader=new GLTFLoader();
export type InstalledAsset={name:string;url:string;height:number;forwardRotation?:number};
export const ASSET_LIBRARY={
 character:{name:'Персонаж',url:'/assets/characters/player.glb',height:2.05,forwardRotation:0},
 sedan:{name:'Автомобиль',url:'/assets/vehicles/sedan.glb',height:1.74,forwardRotation:0}
} satisfies Record<string,InstalledAsset>;

export async function installAsset(holder:THREE.Group,asset:InstalledAsset):Promise<THREE.AnimationMixer|null>{
 let response:Response;
 try{response=await fetch(asset.url,{method:'HEAD'});}
 catch{return null;}
 if(!response.ok)return null;
 try{
  const gltf=await loader.loadAsync(asset.url);
  const model=gltf.scene;
  const bounds=new THREE.Box3().setFromObject(model);
  const size=bounds.getSize(new THREE.Vector3());
  if(!Number.isFinite(size.y)||size.y<=.001)throw Error('INVALID_GLB_SIZE '+asset.url);
  const scale=asset.height/size.y;
  model.scale.setScalar(scale);
  model.position.y=-bounds.min.y*scale;
  model.rotation.y=asset.forwardRotation||0;
  model.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  for(const mesh of holder.children)mesh.visible=false;
  holder.add(model);
  if(gltf.animations.length){
   const mixer=new THREE.AnimationMixer(model);
   const action=mixer.clipAction(gltf.animations[0]);
   action.play();
   return mixer;
  }
  return null;
 }catch(error){
  console.warn('GLB asset not installed, using procedural model:',asset.url,error);
  return null;
 }
}
