import * as THREE from 'three';
import type {CityData,Point,Path,Polygon} from './geo';

const waterMaterial=new THREE.MeshStandardMaterial({color:0x35687d,metalness:.22,roughness:.37,transparent:true,opacity:.91,side:THREE.DoubleSide});
const parkMaterial=new THREE.MeshStandardMaterial({color:0x608451,roughness:1,side:THREE.DoubleSide});
const walkMaterial=new THREE.MeshStandardMaterial({color:0xb7afa0,roughness:.92,side:THREE.DoubleSide});
const metalMaterial=new THREE.MeshStandardMaterial({color:0x5c727c,metalness:.68,roughness:.45});
const benchMaterial=new THREE.MeshStandardMaterial({color:0x795745,roughness:.9});
const concrete=new THREE.MeshStandardMaterial({color:0xa6a7a1,roughness:1});
const shrubs=new THREE.MeshStandardMaterial({color:0x476c46,roughness:1});
const hash=(x:number)=>{const r=Math.sin(x*71.712+8)*10549.47;return r-Math.floor(r);};
function ribbon(vertex:number[],a:Point,b:Point,width:number,y:number):void{
 const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.2)return;
 const nx=-dz/len*width*.5,nz=dx/len*width*.5;
 vertex.push(a.x-nx,y,a.z-nz,b.x-nx,y,b.z-nz,b.x+nx,y,b.z+nz,a.x-nx,y,a.z-nz,b.x+nx,y,b.z+nz,a.x+nx,y,a.z+nz);
}
function ribbonMesh(vertices:number[],material:THREE.Material):THREE.Mesh|null{
 if(vertices.length===0)return null;
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
 return new THREE.Mesh(geo,material);
}
function polygonMesh(area:Polygon,y:number,material:THREE.Material):THREE.Mesh|null{
 if(area.points.length<3)return null;
 const poly=area.points;
 const contour=poly.map(p=>new THREE.Vector2(p.x,-p.z));
 const faces=THREE.ShapeUtils.triangulateShape(contour,[]);
 if(!faces.length)return null;
 const verts:number[]=[];
 for(const tri of faces)for(const index of tri){const p=poly[index];verts.push(p.x,y,p.z);}
 const mesh=ribbonMesh(verts,material);if(mesh)mesh.receiveShadow=true;return mesh;
}
function beam(group:THREE.Group,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material):THREE.Mesh{
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);group.add(mesh);return mesh;
}
function waterDistance(p:Point,water:Path[]):number{
 let distance=Infinity;
 for(const path of water)for(let i=1;i<path.points.length;i++){
  const a=path.points[i-1],b=path.points[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.z-a.z)*dz)/Math.max(.01,dx*dx+dz*dz)));
  distance=Math.min(distance,Math.hypot(p.x-a.x-dx*t,p.z-a.z-dz*t));
 }
 return distance;
}
function lamp(group:THREE.Group,x:number,z:number):void{
 beam(group,x,2.9,z,.12,5.8,.12,metalMaterial);
 const globe=new THREE.Mesh(new THREE.SphereGeometry(.31,9,7),new THREE.MeshStandardMaterial({color:0xfff1d0,emissive:0xf0c18b,emissiveIntensity:.46}));
 globe.position.set(x,6,z);group.add(globe);
}
function bench(group:THREE.Group,x:number,z:number,angle:number):void{
 const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=angle;group.add(g);
 beam(g,0,.49,0,1.9,.16,.58,benchMaterial);
 beam(g,0,.95,.25,1.9,.85,.14,benchMaterial);
 for(const s of [-1,1])for(const k of [-1,1])beam(g,s*.71,.25,k*.19,.09,.48,.09,metalMaterial);
}
export function buildRiverfront(data:CityData):{group:THREE.Group;waterCount:number;promenadeCount:number}{
 const group=new THREE.Group();
 const water=data.water||[],parks=data.parks||[],rivers=data.waterways||[];
 let count=0;
 for(const polygon of water){const mesh=polygonMesh(polygon,.008,waterMaterial);if(mesh){group.add(mesh);count++;}}
 for(const p of parks){const mesh=polygonMesh(p,.022,parkMaterial);if(mesh)group.add(mesh);}
 const ripples:number[]=[];
 for(const river of rivers){
  for(let i=1;i<river.points.length;i++){
   if(water.length===0)ribbon(ripples,river.points[i-1],river.points[i],river.width,.014);
  }
 }
 const body=ribbonMesh(ripples,waterMaterial);if(body)group.add(body);
 const walks:number[]=[];
 for(const footway of data.footways||[])for(let i=1;i<footway.points.length;i++)ribbon(walks,footway.points[i-1],footway.points[i],footway.width,.07);
 const pathMesh=ribbonMesh(walks,walkMaterial);if(pathMesh)group.add(pathMesh);
 let decorations=0;
 const paths=[...(data.waterfront||[]),...(data.footways||[])];
 const used=new Set<string>();
 for(const path of paths){
  const label=path.name.toLowerCase();
  const explicitlyNamed=/набережн|берегов|river|embankment/i.test(label);
  for(let i=1;i<path.points.length;i++){
   const a=path.points[i-1],b=path.points[i];
   const distance=waterDistance({x:(a.x+b.x)/2,z:(a.z+b.z)/2},rivers);
   if(!explicitlyNamed&&distance>145)continue;
   const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
   if(len<7||len>700)continue;
   const angle=Math.atan2(dz,dx),nx=-dz/len,nz=dx/len;
   for(let d=8;d<len-3;d+=28){
    const cx=a.x+dx*d/len,cz=a.z+dz*d/len;
    const key=Math.round(cx/12)+':'+Math.round(cz/12);
    if(used.has(key)||decorations>220)continue;
    used.add(key);decorations++;
    const side=hash(cx+cz)>.5?1:-1;
    if(decorations%2===0)bench(group,cx+nx*3*side,cz+nz*3*side,angle);
    if(decorations%3===0)lamp(group,cx+nx*4.2*side,cz+nz*4.2*side);
    if(decorations%4===0){
     const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),shrubs);
     shrub.position.set(cx+nx*6*side,.68,cz+nz*6*side);shrub.scale.set(.95,.65,.95);group.add(shrub);
    }
   }
  }
 }
 return{group,waterCount:count+rivers.length,promenadeCount:decorations};
}