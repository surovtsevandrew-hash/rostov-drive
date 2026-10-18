import * as THREE from 'three';
import {CENTER,type Point} from './geo';

export type TerrainData={bounds:[number,number,number,number];columns:number;rows:number;heights:number[];datum:number;source:string;zoom:number};
const LAT_SCALE=111320;
const LON_SCALE=LAT_SCALE*Math.cos(CENTER.lat*Math.PI/180);
export class TerrainModel {
 readonly west:number;
 readonly east:number;
 readonly north:number;
 readonly south:number;
 private readonly scaleX:number;
 private readonly scaleZ:number;
 constructor(readonly data:TerrainData){
  const [minLat,minLon,maxLat,maxLon]=data.bounds;
  this.west=(minLon-CENTER.lon)*LON_SCALE;
  this.east=(maxLon-CENTER.lon)*LON_SCALE;
  this.north=-(maxLat-CENTER.lat)*LAT_SCALE;
  this.south=-(minLat-CENTER.lat)*LAT_SCALE;
  this.scaleX=(data.columns-1)/(this.east-this.west);
  this.scaleZ=(data.rows-1)/(this.south-this.north);
  if(data.columns<3||data.rows<3||data.heights.length!==data.columns*data.rows)throw Error('Неверная высотная сетка Ростова');
 }
 height(x:number,z:number):number{
  const fx=THREE.MathUtils.clamp((x-this.west)*this.scaleX,0,this.data.columns-1);
  const fz=THREE.MathUtils.clamp((z-this.north)*this.scaleZ,0,this.data.rows-1);
  const i=Math.min(this.data.columns-2,Math.floor(fx));
  const j=Math.min(this.data.rows-2,Math.floor(fz));
  const tx=Math.min(1,fx-i),tz=Math.min(1,fz-j),c=this.data.columns,h=this.data.heights;
  const a=THREE.MathUtils.lerp(h[j*c+i],h[j*c+i+1],tx);
  const b=THREE.MathUtils.lerp(h[(j+1)*c+i],h[(j+1)*c+i+1],tx);
  return THREE.MathUtils.lerp(a,b,tz)-this.data.datum;
 }
 at(p:Point):number{return this.height(p.x,p.z);}
 average(points:Point[]):number{
  if(!points.length)return 0;
  return points.reduce((v,p)=>v+this.at(p),0)/points.length;
 }
 createSurface():THREE.Mesh {
  const segmentsX=Math.min(260,this.data.columns-1),segmentsZ=Math.min(180,this.data.rows-1);
  const geo=new THREE.PlaneGeometry(this.east-this.west,this.south-this.north,segmentsX,segmentsZ);
  geo.rotateX(-Math.PI/2);
  const pos=geo.getAttribute('position') as THREE.BufferAttribute;
  const cx=(this.west+this.east)/2,cz=(this.north+this.south)/2;
  for(let i=0;i<pos.count;i++){
   const x=pos.getX(i)+cx,z=pos.getZ(i)+cz;
   pos.setXYZ(i,x,this.height(x,z)-.11,z);
  }
  pos.needsUpdate=true;geo.computeVertexNormals();
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:0x749169,roughness:1,side:THREE.DoubleSide}));
  mesh.receiveShadow=true;return mesh;
 }
}
export async function loadTerrain(status:(s:string)=>void):Promise<TerrainModel>{
 status('Загружаю настоящие высоты Ростова...');
 let r:Response;
 try{r=await fetch('/world/terrain.json',{cache:'no-store'});}
 catch{throw Error('Недоступна цифровая модель рельефа. Запусти bash scripts/prepare_world.sh');}
 if(!r.ok)throw Error('Отсутствует terrain.json. Запусти bash scripts/prepare_world.sh');
 return new TerrainModel(await r.json() as TerrainData);
}
