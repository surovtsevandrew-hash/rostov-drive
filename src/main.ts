import './style.css';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import {chooseSpawn,loadCity,location,type CityData,type Point} from './geo';
import {CityWorld} from './world';
import {human,vehicle} from './actors';
import {StreetTraffic} from './traffic';
import {TerrainModel,loadTerrain} from './terrain';
import {ASSET_LIBRARY,installAsset} from './assets';

const element=(id:string)=>document.getElementById(id)!;
const canvas=element('scene') as HTMLCanvasElement;
const mini=(element('mini') as HTMLCanvasElement).getContext('2d')!;
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.4));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.background=new THREE.Color(0xb7d3de);
scene.fog=new THREE.Fog(0xb7d3de,280,1200);
scene.add(new THREE.HemisphereLight(0xffffff,0x697668,1.9));
const sunlight=new THREE.DirectionalLight(0xffecd0,2.65);
sunlight.castShadow=true;
sunlight.position.set(-90,160,50);
sunlight.shadow.mapSize.set(1536,1536);
sunlight.shadow.camera.left=-120;
sunlight.shadow.camera.right=120;
sunlight.shadow.camera.top=120;
sunlight.shadow.camera.bottom=-120;
sunlight.shadow.camera.far=380;
sunlight.shadow.bias=-.0002;
scene.add(sunlight,sunlight.target);

const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.1,1600);
camera.position.set(0,8,16);
camera.lookAt(0,1.7,0);
const avatar=human(),car=vehicle();
avatar.visible=false;
car.visible=false;
scene.add(avatar,car);

let data:CityData|null=null;
let city:CityWorld|null=null;
let elevation:TerrainModel|null=null;
let traffic:StreetTraffic|null=null;
let rapier:RAPIER.World|null=null;
let loaded=false,driving=false,heading=0,yaw=0,zoom=10,vehicleSpeed=0;
let px=0,pz=0,cx=0,cz=0,walkPhase=0;
const animationMixers:THREE.AnimationMixer[]=[];
let last=0,frame=0,lastStatus='',lastSaved=0;
const keys=new Set<string>();
const status=(text:string)=>{if(text!==lastStatus){element('status').textContent=text;lastStatus=text;}};
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);

function moveToRoad(point:{x:number;z:number;heading:number}):void{
 heading=point.heading;yaw=point.heading;vehicleSpeed=0;driving=false;
 cx=point.x;cz=point.z;
 px=point.x+Math.cos(heading)*3;
 pz=point.z-Math.sin(heading)*3;
 if(city?.blocked(px,pz,.65)){px=point.x-Math.cos(heading)*3;pz=point.z+Math.sin(heading)*3;}
 const clearance=city?city.cameraClearance(px,pz,px+Math.sin(yaw)*zoom,pz+Math.cos(yaw)*zoom):zoom;
 camera.position.set(px+Math.sin(yaw)*clearance,(elevation?.height(px,pz)||0)+Math.max(3,clearance*.5),pz+Math.cos(yaw)*clearance);
 camera.lookAt(px,1.65,pz);
}

function nearestPointTo(points:Point[],x:number,z:number):{x:number;z:number;heading:number}|null{
 let best:null|{x:number;z:number;heading:number}=null,nearest=Infinity;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz;
  if(len<6)continue;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/len));
  const cx=a.x+dx*t,cz=a.z+dz*t,d=Math.hypot(cx-x,cz-z);
  if(d<nearest){nearest=d;best={x:cx,z:cz,heading:Math.atan2(-dx,-dz)};}
 }
 return best;
}

function teleportToEmbankment():void{
 if(!city||!data)return;
 const named=data.roads.filter(r=>/Береговая|Набережная/i.test(r.name));
 const candidates=named.length?named:data.roads.filter(r=>{
  const p=r.points[0];return p&&p.z>400;
 });
 const target={x:0,z:1050};
 let best:null|{x:number;z:number;heading:number}=null,dist=Infinity;
 for(const road of candidates){
  const point=nearestPointTo(road.points,target.x,target.z);
  if(!point)continue;
  const d=distance(point,target);
  if(d<dist){dist=d;best=point;}
 }
 if(!best){status('Маршрут к набережной в OSM не найден');return;}
 moveToRoad(best);
 status('Набережная Ростова · точка на настоящей улице');
}

function interact():void{
 if(!loaded)return;
 if(driving){
  if(Math.abs(vehicleSpeed)>1.3){status('Останови автомобиль, чтобы выйти');return;}
  driving=false;px=cx+Math.cos(heading)*3;pz=cz-Math.sin(heading)*3;
  if(city?.blocked(px,pz,.6)){px=cx-Math.cos(heading)*3;pz=cz+Math.sin(heading)*3;}
 }else if(Math.hypot(px-cx,pz-cz)<7){
  driving=true;vehicleSpeed=0;heading=yaw;
 }else{status('Подойди к машине ближе');}
}

addEventListener('keydown',event=>{
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code))event.preventDefault();
 if(!event.repeat&&event.code==='KeyE')interact();
 if(!event.repeat&&event.code==='Digit2')teleportToEmbankment();
 if(!event.repeat&&event.code==='Digit1'&&city&&data)moveToRoad(chooseSpawn(data));
 keys.add(event.code);
});
addEventListener('keyup',event=>keys.delete(event.code));
addEventListener('blur',()=>keys.clear());
let dragging=false,pointerX=0;
canvas.addEventListener('pointerdown',event=>{dragging=true;pointerX=event.clientX;canvas.setPointerCapture(event.pointerId);});
canvas.addEventListener('pointerup',()=>dragging=false);
canvas.addEventListener('pointercancel',()=>dragging=false);
canvas.addEventListener('pointermove',event=>{if(!dragging)return;yaw-=(event.clientX-pointerX)*.005;pointerX=event.clientX;});
canvas.addEventListener('wheel',event=>{zoom=Math.max(5.5,Math.min(25,zoom+event.deltaY*.012));},{passive:true});
addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();});

function drawMinimap(x:number,z:number):void{
 mini.fillStyle='#a2bc9c';mini.fillRect(0,0,220,220);
 if(!data)return;
 mini.save();mini.translate(110,110);mini.scale(.25,.25);mini.translate(-x,-z);
 for(const p of data.parks||[]){
  if(!p.points.some(v=>Math.abs(v.x-x)<480&&Math.abs(v.z-z)<480))continue;
  mini.fillStyle='#608850';mini.beginPath();p.points.forEach((v,i)=>i?mini.lineTo(v.x,v.z):mini.moveTo(v.x,v.z));mini.closePath();mini.fill();
 }
 mini.fillStyle='#5a9ab3';
 for(const p of data.water||[]){
  if(!p.points.some(v=>Math.abs(v.x-x)<480&&Math.abs(v.z-z)<480))continue;
  mini.beginPath();p.points.forEach((v,i)=>i?mini.lineTo(v.x,v.z):mini.moveTo(v.x,v.z));mini.closePath();mini.fill();
 }
 mini.strokeStyle='#5a9ab3';
 for(const p of data.waterways||[]){
  if(!p.points.some(v=>Math.abs(v.x-x)<600&&Math.abs(v.z-z)<600))continue;
  mini.beginPath();p.points.forEach((v,i)=>i?mini.lineTo(v.x,v.z):mini.moveTo(v.x,v.z));mini.lineWidth=p.width;mini.stroke();
 }
 mini.strokeStyle='#36444a';
 for(const r of data.roads){
  if(!r.points.some(p=>Math.abs(p.x-x)<500&&Math.abs(p.z-z)<500))continue;
  mini.beginPath();r.points.forEach((p,i)=>i?mini.lineTo(p.x,p.z):mini.moveTo(p.x,p.z));mini.lineWidth=r.width;mini.stroke();
 }
 if(traffic){
  mini.fillStyle='#ffe5c1';
  for(const npc of traffic.drivers){
   if(!npc.mesh.visible)continue;
   const p=npc.mesh.position;mini.fillRect(p.x-3,p.z-3,6,6);
  }
 }
 mini.restore();
 mini.fillStyle='#ffbd58';mini.beginPath();mini.arc(110,110,6,0,Math.PI*2);mini.fill();
}

function tick(now:number):void{
 requestAnimationFrame(tick);
 const dt=Math.min(.04,(now-last)/1000||0);last=now;frame++;
 for(const mixer of animationMixers)mixer.update(dt);
 if(city&&loaded){
  const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
  const side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
  if(driving){
   vehicleSpeed=Math.max(-13,Math.min(34,vehicleSpeed+forward*23*dt));
   if(!forward)vehicleSpeed*=Math.exp(-1.9*dt);
   if(Math.abs(vehicleSpeed)<.05)vehicleSpeed=0;
   if(side)heading-=side*dt*Math.min(1.5,Math.abs(vehicleSpeed)*.05)*Math.sign(vehicleSpeed);
   const x=cx-Math.sin(heading)*vehicleSpeed*dt,z=cz-Math.cos(heading)*vehicleSpeed*dt;
   if(!city.blocked(x,z,1.3)){cx=x;cz=z;}else vehicleSpeed=0;
   yaw+=Math.atan2(Math.sin(heading-yaw),Math.cos(heading-yaw))*Math.min(1,dt*1.8);
  }else if(forward||side){
   const speed=keys.has('ShiftLeft')?8.2:4.9,normal=Math.hypot(forward,side);
   const dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)/normal;
   const dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)/normal;
   if(!city.blocked(px+dx*speed*dt,pz+dz*speed*dt)){px+=dx*speed*dt;pz+=dz*speed*dt;}
   avatar.rotation.y=Math.atan2(-dx,-dz);walkPhase+=dt*speed*1.9;
  }
  avatar.visible=!driving;
  avatar.position.set(px,(elevation?.height(px,pz)||0)+.08,pz);
  car.position.set(cx,(elevation?.height(cx,cz)||0)+.12,cz);car.rotation.y=heading;
  const moving=!driving&&(forward!==0||side!==0),swing=moving?Math.sin(walkPhase)*.36:0;
  const legs=avatar.userData.legs as THREE.Mesh[]|undefined;
  const arms=avatar.userData.arms as THREE.Mesh[]|undefined;
  if(legs&&arms){legs[0].rotation.x=swing;legs[1].rotation.x=-swing;arms[0].rotation.x=-swing*.7;arms[1].rotation.x=swing*.7;}
  const x=driving?cx:px,z=driving?cz:pz,dist=driving?zoom+2:zoom;
  const limit=city.cameraClearance(x,z,x+Math.sin(yaw)*dist,z+Math.cos(yaw)*dist);
  const safe=Math.max(1.6,Math.min(dist,limit));
  camera.position.lerp(new THREE.Vector3(x+Math.sin(yaw)*safe,(elevation?.height(x,z)||0)+Math.max(2.6,safe*.48),z+Math.cos(yaw)*safe),Math.min(1,dt*7));
  camera.lookAt(x,(elevation?.height(x,z)||0)+(driving?1.35:1.65),z);
  traffic?.update(dt,x,z,driving?{x:cx,z:cz}:undefined);
  rapier?.step();
  if(frame%30===0){
   city.updateView(x,z);
   sunlight.position.set(x-90,160,z+50);
   sunlight.target.position.set(x,0,z);sunlight.target.updateMatrixWorld();
   const gps=location({x,z});
   status('РОСТОВ · '+gps.lat.toFixed(5)+', '+gps.lon.toFixed(5)+' · '+(driving?Math.round(Math.abs(vehicleSpeed)*3.6)+' км/ч':'ПЕШКОМ')+' · Трафик '+(traffic?.drivers.length||0));
   drawMinimap(x,z);
  }
 }
 renderer.render(scene,camera);
}

async function init():Promise<void>{
 try{
  data=await loadCity(status);
  status('Строю настоящий Ростов: дороги, Дон, набережную...');
  elevation=await loadTerrain(status);
  city=new CityWorld(data,elevation);scene.add(city.group);
  moveToRoad(chooseSpawn(data));
  city.updateView(px,pz);
  traffic=new StreetTraffic(data,elevation);scene.add(traffic.group,traffic.people);
  await RAPIER.init();
  rapier=new RAPIER.World({x:0,y:-9.81,z:0});
  const ground=rapier.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  rapier.createCollider(RAPIER.ColliderDesc.cuboid(2700,.2,2600),ground);
  avatar.visible=true;car.visible=true;loaded=true;
  void Promise.all([installAsset(avatar,ASSET_LIBRARY.character),installAsset(car,ASSET_LIBRARY.sedan)]).then(items=>{
   for(const item of items)if(item)animationMixers.push(item);
  });
  status('Ростов с реальным рельефом · '+data.roads.length+' улиц · '+data.buildings.length+' зданий · '+city.riverfrontCount+' деталей набережной · 1 центр / 2 набережная');
 }catch(error){avatar.visible=false;car.visible=false;status('Ошибка запуска: '+String(error));console.error(error);}
}
requestAnimationFrame(tick);
void init();
