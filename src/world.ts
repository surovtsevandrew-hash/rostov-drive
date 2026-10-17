import * as T from 'three';
import type {CityData,Point} from './geo';
import {buildRiverfront} from './riverfront';

type Footprint={polygon:Point[];minX:number;maxX:number;minZ:number;maxZ:number;height:number};
const rand=(s:number)=>{const n=Math.sin(s*12.9898+17.23)*43758.5453;return n-Math.floor(n);};
function patterned(base:string,fleck:string,grid=false):T.CanvasTexture{
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
 const c=canvas.getContext('2d')!;c.fillStyle=base;c.fillRect(0,0,256,256);
 for(let i=0;i<2300;i++){c.globalAlpha=.03+rand(i*9+2)*.14;c.fillStyle=i%3?fleck:'#ffffff';c.fillRect(rand(i*17+1)*256,rand(i*29+8)*256,1+rand(i*6)*3,1+rand(i*4)*3);}
 if(grid){c.globalAlpha=.15;c.strokeStyle=fleck;c.lineWidth=1;for(let n=0;n<256;n+=32){c.beginPath();c.moveTo(n,0);c.lineTo(n,256);c.moveTo(0,n);c.lineTo(256,n);c.stroke();}}
 c.globalAlpha=1;const tex=new T.CanvasTexture(canvas);tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;return tex;
}
const asphalt=new T.MeshStandardMaterial({map:patterned('#363d40','#142128'),roughness:.97,side:T.DoubleSide});
const walkway=new T.MeshStandardMaterial({map:patterned('#a5a297','#626960',true),roughness:.97,side:T.DoubleSide});
const ground=new T.MeshStandardMaterial({map:patterned('#75936a','#466346'),roughness:1});
const paint=new T.MeshStandardMaterial({color:0xe7d9b5,roughness:.9,side:T.DoubleSide});
const glass=new T.MeshStandardMaterial({color:0x385462,metalness:.42,roughness:.29});
const framing=new T.MeshStandardMaterial({color:0xd8d1c2,roughness:.8});
const trunk=new T.MeshStandardMaterial({color:0x66503e,roughness:1});
const leaves=new T.MeshStandardMaterial({color:0x4e7650,roughness:1});
const pole=new T.MeshStandardMaterial({color:0x505b61,metalness:.7,roughness:.5});
const light=new T.MeshStandardMaterial({color:0xffe7bd,emissive:0xffd990,emissiveIntensity:.5});
function strip(v:number[],a:Point,b:Point,w:number,h:number):void{
 const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<.1||len>1200)return;
 const nx=-dz/len*w/2,nz=dx/len*w/2;
 const A=[a.x-nx,h,a.z-nz],B=[b.x-nx,h,b.z-nz],C=[b.x+nx,h,b.z+nz],D=[a.x+nx,h,a.z+nz];
 v.push(...A,...B,...C,...A,...C,...D);
}
function join(v:number[],p:Point,r:number,h:number):void{
 for(let j=0;j<12;j++){const a=j*Math.PI/6,b=(j+1)*Math.PI/6;v.push(p.x,h,p.z,p.x+Math.cos(a)*r,h,p.z+Math.sin(a)*r,p.x+Math.cos(b)*r,h,p.z+Math.sin(b)*r);}
}
function surface(v:number[],material:T.Material):T.Mesh|null{
 if(!v.length)return null;
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));
 const uv:number[]=[];for(let i=0;i<v.length;i+=3)uv.push(v[i]/7,v[i+2]/7);
 g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();return new T.Mesh(g,material);
}
function inside(x:number,z:number,points:Point[]):boolean{
 let yes=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)yes=!yes;}
 return yes;
}
function instance(parent:T.Group,geometry:T.BufferGeometry,material:T.Material,mats:T.Matrix4[]):void{
 if(!mats.length)return;const mesh=new T.InstancedMesh(geometry,material,mats.length);mats.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();parent.add(mesh);
}
function matrix(x:number,y:number,z:number,angle=0,sx=1,sy=1,sz=1):T.Matrix4{
 return new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),angle),new T.Vector3(sx,sy,sz));
}
export class CityWorld{
 readonly group=new T.Group();
 readonly boxes:Footprint[]=[];
 readonly buildingCount:number;
 readonly riverfrontCount:number;
 private readonly buildingChunks=new Map<string,T.Group>();
 private visibleCell='';
 private getBuildingChunk(x:number,z:number):T.Group{
  const key=Math.floor(x/256)+':'+Math.floor(z/256);
  let group=this.buildingChunks.get(key);
  if(!group){group=new T.Group();this.group.add(group);this.buildingChunks.set(key,group);}
  return group;
 }
 updateView(x:number,z:number):void{
  const key=Math.floor(x/140)+':'+Math.floor(z/140);
  if(key===this.visibleCell)return;
  this.visibleCell=key;
  for(const [name,group] of this.buildingChunks){
   const [a,b]=name.split(':').map(Number);
   group.visible=Math.abs((a+.5)*256-x)<1050&&Math.abs((b+.5)*256-z)<1050;
  }
 }
 constructor(readonly data:CityData){
  ground.map?.repeat.set(320,300);const earth=new T.Mesh(new T.PlaneGeometry(5200,5000),ground);earth.rotation.x=-Math.PI/2;earth.position.y=-.13;earth.receiveShadow=true;this.group.add(earth);
  const pavementVertices:number[]=[],roadVertices:number[]=[],stripeVertices:number[]=[],edgeVertices:number[]=[];
  const treeSites:{x:number;z:number;seed:number}[]=[],lampSites:{x:number;z:number}[]=[];
  for(const r of data.roads)for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1||len>700)continue;
   strip(pavementVertices,a,b,r.width+4,.028);strip(roadVertices,a,b,r.width,.065);
   if(i>1){join(pavementVertices,a,r.width/2+2,.029);join(roadVertices,a,r.width/2,.068);}
   const ux=dx/len,uz=dz/len,nx=-uz,nz=ux;
   if(r.width>=9)for(let d=4;d+3<len;d+=11)strip(stripeVertices,{x:a.x+ux*d,z:a.z+uz*d},{x:a.x+ux*(d+3),z:a.z+uz*(d+3)},.18,.083);
   for(const side of [-1,1])strip(edgeVertices,{x:a.x+nx*side*r.width/2,z:a.z+nz*side*r.width/2},{x:b.x+nx*side*r.width/2,z:b.z+nz*side*r.width/2},.12,.078);
   if(r.width>=7)for(let d=14;d<len-7;d+=31)for(const side of [-1,1]){
    const x=a.x+ux*d+nx*(r.width/2+6)*side,z=a.z+uz*d+nz*(r.width/2+6)*side;
    treeSites.push({x,z,seed:Math.floor(x*3+z*7+side*271)});
   }
   if(r.width>=10)for(let d=22;d<len-5;d+=52)lampSites.push({x:a.x+ux*d+nx*(r.width/2+2.6),z:a.z+uz*d+nz*(r.width/2+2.6)});
  }
  for(const [v,mat] of [[pavementVertices,walkway],[roadVertices,asphalt],[edgeVertices,paint],[stripeVertices,paint]] as [number[],T.Material][]){
   const mesh=surface(v,mat);if(mesh){mesh.receiveShadow=true;this.group.add(mesh);}
  }
  const facades=[0xc7b8a6,0xd3c2ae,0xb9b3a8,0xaaa89e,0xd0baac,0x9eaaa8,0xd4bda4].map(color=>new T.MeshStandardMaterial({color,roughness:.91}));
  const windowBuckets=new Map<string,{panes:T.Matrix4[];frames:T.Matrix4[]}>();let count=0,windowCount=0;
  for(const building of data.buildings){
   const p=building.points;if(p.length<3)continue;
   const xs=p.map(q=>q.x),zs=p.map(q=>q.z);
   const box:Footprint={polygon:p,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs),height:building.height};
   const w=box.maxX-box.minX,d=box.maxZ-box.minZ;
   if(w*d<15||w>170||d>170)continue;
   const chunkKey=Math.floor(((box.minX+box.maxX)*.5)/256)+':'+Math.floor(((box.minZ+box.maxZ)*.5)/256);
   let windows=windowBuckets.get(chunkKey);
   if(!windows){windows={panes:[],frames:[]};windowBuckets.set(chunkKey,windows);}
   const shape=new T.Shape();shape.moveTo(p[0].x,-p[0].z);for(const q of p.slice(1))shape.lineTo(q.x,-q.z);shape.closePath();
   const g=new T.ExtrudeGeometry(shape,{depth:Math.max(3,Math.min(145,building.height)),bevelEnabled:false,steps:1,curveSegments:1});g.rotateX(-Math.PI/2);
   const mesh=new T.Mesh(g,facades[Math.abs(building.id)%facades.length]);mesh.castShadow=true;mesh.receiveShadow=true;this.getBuildingChunk((box.minX+box.maxX)*.5,(box.minZ+box.maxZ)*.5).add(mesh);this.boxes.push(box);count++;
   const levels=Math.min(24,Math.floor(building.height/3.15));
   for(let i=0;i<p.length;i++){
    const a=p[i],b=p[(i+1)%p.length],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<5||len>140)continue;
    const nx=-dz/len,nz=dx/len,cols=Math.min(35,Math.floor(len/3)),angle=-Math.atan2(dz,dx);
    for(let level=0;level<levels;level++)for(let n=0;n<cols;n++){
     if(windowCount>=125000)break;
     const t=(n+.5)/cols,x=a.x+dx*t,z=a.z+dz*t,y=2.15+level*3.15;
     windows.panes.push(matrix(x+nx*.11,y,z+nz*.11,angle));
     windows.frames.push(matrix(x+nx*.075,y,z+nz*.075,angle,1.38,1.3,1));windowCount++;
    }
   }
  }
  this.buildingCount=count;
  const glassShape=new T.BoxGeometry(1.12,1.36,.09),frameShape=new T.BoxGeometry(1.12,1.36,.08);
  for(const [key,mats] of windowBuckets){
   const chunk=this.buildingChunks.get(key);
   if(chunk){instance(chunk,glassShape,glass,mats.panes);instance(chunk,frameShape,framing,mats.frames);}
  }
  const scenery=new Map<string,{trunks:T.Matrix4[];crowns:T.Matrix4[];poles:T.Matrix4[];bulbs:T.Matrix4[]}>();
  const sceneryFor=(x:number,z:number)=>{
   const key=Math.floor(x/256)+':'+Math.floor(z/256);
   let matrices=scenery.get(key);
   if(!matrices){matrices={trunks:[],crowns:[],poles:[],bulbs:[]};scenery.set(key,matrices);}
   this.getBuildingChunk(x,z);
   return matrices;
  };
  let treeCount=0;
  for(const t of treeSites){if(treeCount>=1600)break;if(this.blocked(t.x,t.z,2.1)||rand(t.seed)<.35)continue;
   const scale=.82+rand(t.seed*2)*.6;
   const out=sceneryFor(t.x,t.z);
   out.trunks.push(matrix(t.x,2.2*scale,t.z,0,scale,scale,scale));
   out.crowns.push(matrix(t.x,5.15*scale,t.z,0,scale,scale,scale));treeCount++;
  }
  for(const t of lampSites.slice(0,800)){if(this.blocked(t.x,t.z,1.3))continue;
   const out=sceneryFor(t.x,t.z);out.poles.push(matrix(t.x,3.3,t.z));out.bulbs.push(matrix(t.x,6.62,t.z));
  }
  const trunkShape=new T.CylinderGeometry(.18,.28,4.4,7),crownShape=new T.IcosahedronGeometry(2.5,1);
  const poleShape=new T.CylinderGeometry(.055,.09,6.6,6),bulbShape=new T.SphereGeometry(.34,8,6);
  for(const [key,s] of scenery){const chunk=this.buildingChunks.get(key);
   if(!chunk)continue;
   instance(chunk,trunkShape,trunk,s.trunks);instance(chunk,crownShape,leaves,s.crowns);
   instance(chunk,poleShape,pole,s.poles);instance(chunk,bulbShape,light,s.bulbs);
  }
  const shoreline=buildRiverfront(data);this.group.add(shoreline.group);this.riverfrontCount=shoreline.promenadeCount;
  this.updateView(0,0);
 }
 blocked(x:number,z:number,r=.5):boolean{
  for(const b of this.boxes){if(x+r<b.minX||x-r>b.maxX||z+r<b.minZ||z-r>b.maxZ)continue;
   if(inside(x,z,b.polygon)||inside(x+r,z,b.polygon)||inside(x-r,z,b.polygon)||inside(x,z+r,b.polygon)||inside(x,z-r,b.polygon))return true;
  }return false;
 }
 cameraClearance(x:number,z:number,tx:number,tz:number):number{
  const distance=Math.hypot(tx-x,tz-z);if(distance<.1)return 0;
  const steps=Math.ceil(distance/.6);
  for(let i=2;i<=steps;i++){const t=i/steps;if(this.blocked(x+(tx-x)*t,z+(tz-z)*t,.35))return Math.max(1.7,distance*t-1);}
  return distance;
 }
}