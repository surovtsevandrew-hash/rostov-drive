import * as T from 'three';
function part(p:T.Group,g:T.BufferGeometry,m:T.Material,x:number,y:number,z:number):T.Mesh{
 const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;p.add(mesh);return mesh;
}
export function vehicle():T.Group{
 const root=new T.Group();
 const paint=new T.MeshStandardMaterial({color:0xc54330,metalness:.38,roughness:.33});
 const glass=new T.MeshStandardMaterial({color:0x273f53,metalness:.3,roughness:.2});
 const chrome=new T.MeshStandardMaterial({color:0xb5c1c5,metalness:.75,roughness:.25});
 const rubber=new T.MeshStandardMaterial({color:0x202227,roughness:.98});
 const lit=new T.MeshStandardMaterial({color:0xfff0d4,emissive:0xffddb0,emissiveIntensity:.75});
 const brake=new T.MeshStandardMaterial({color:0x9f1b1b,emissive:0xb31e23,emissiveIntensity:.45});
 const box=(w:number,h:number,d:number)=>new T.BoxGeometry(w,h,d);
 part(root,box(2.04,.64,4.24),paint,0,.82,0);
 part(root,box(1.93,.12,1.2),paint,0,1.13,-1.51);
 part(root,box(1.85,.1,.88),paint,0,1.13,1.6);
 part(root,box(1.78,.7,2.08),glass,0,1.37,.03);
 part(root,box(1.83,.08,1.87),paint,0,1.76,.02);
 part(root,box(1.9,.12,.17),chrome,0,.56,-2.12);
 part(root,box(1.9,.12,.17),chrome,0,.56,2.12);
 part(root,box(1.35,.17,.055),glass,0,.81,-2.15);
 for(const s of [-1,1]){
  for(const z of [-1.34,1.34]){
   const wheel=part(root,new T.CylinderGeometry(.44,.44,.27,24),rubber,s*1.05,.44,z);wheel.rotation.z=Math.PI/2;
   const hub=part(root,new T.CylinderGeometry(.25,.25,.29,12),chrome,s*1.055,.44,z);hub.rotation.z=Math.PI/2;
  }
  part(root,box(.43,.21,.08),lit,s*.72,1.04,-2.13);
  part(root,box(.39,.18,.07),brake,s*.72,.99,2.13);
  part(root,box(.2,.12,.26),paint,s*1.01,1.35,-.46);
 }
 return root;
}
export function human():T.Group{
 const root=new T.Group();
 const coat=new T.MeshStandardMaterial({color:0x365473,roughness:.9});
 const pants=new T.MeshStandardMaterial({color:0x2b3340,roughness:1});
 const skin=new T.MeshStandardMaterial({color:0xd8a785,roughness:.82});
 const hair=new T.MeshStandardMaterial({color:0x2b2423});
 const boot=new T.MeshStandardMaterial({color:0x161b23});
 part(root,new T.CapsuleGeometry(.35,.55,5,10),coat,0,1.45,0);
 const legs:T.Mesh[]=[],arms:T.Mesh[]=[];
 for(const s of [-1,1]){
  legs.push(part(root,new T.CapsuleGeometry(.12,.55,4,8),pants,s*.18,.53,0));
  part(root,new T.BoxGeometry(.28,.15,.42),boot,s*.19,.11,-.07);
  arms.push(part(root,new T.CapsuleGeometry(.10,.45,4,8),coat,s*.48,1.35,0));
 }
 part(root,new T.CylinderGeometry(.12,.12,.16,10),skin,0,2.03,0);
 part(root,new T.SphereGeometry(.29,14,12),skin,0,2.28,0);
 part(root,new T.SphereGeometry(.295,14,10,0,Math.PI*2,0,Math.PI*.48),hair,0,2.33,0);
 root.userData.legs=legs;
 root.userData.arms=arms;
 return root;
}