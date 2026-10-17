import * as THREE from 'three';
import type {CityData,Point,Road,Path} from './geo';
import {vehicle,human} from './actors';

type Route={points:Point[];cumulative:number[];total:number;};
type Driver={mesh:THREE.Group;route:Route;distance:number;speed:number;direction:number;seed:number;heading:number;};
type Walker={mesh:THREE.Group;route:Route;distance:number;speed:number;direction:number;seed:number;heading:number;phase:number;};
const random=(n:number)=>{const a=Math.sin(n*127.1+83.43)*43758.5453;return a-Math.floor(a);};
const separation=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.z-b.z);
function routeOf(points:Point[]):Route|null{
 if(points.length<2)return null;
 const cumulative=[0];let total=0;
 for(let i=1;i<points.length;i++){total+=separation(points[i],points[i-1]);cumulative.push(total);}
 return total>18?{points,cumulative,total}:null;
}
function evaluate(route:Route,at:number,direction:number):{x:number;z:number;heading:number}{
 const d=Math.max(0,Math.min(route.total,at));let lo=0,hi=route.cumulative.length-1;
 while(lo+1<hi){const m=(lo+hi)>>1;if(route.cumulative[m]<d)lo=m;else hi=m;}
 const a=route.points[lo],b=route.points[hi],from=route.cumulative[lo],to=route.cumulative[hi];
 const t=(d-from)/Math.max(.001,to-from),dx=(b.x-a.x)*direction,dz=(b.z-a.z)*direction;
 return{x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,heading:Math.atan2(-dx,-dz)};
}
function near(route:Route,x:number,z:number,distance:number):boolean{
 return route.points.some(p=>Math.abs(p.x-x)<distance&&Math.abs(p.z-z)<distance);
}
export class StreetTraffic{
 readonly group=new THREE.Group();
 readonly people=new THREE.Group();
 readonly drivers:Driver[]=[];
 readonly walkers:Walker[]=[];
 private readonly roadRoutes:Route[];
 private readonly pedestrianRoutes:Route[];
 private sinceRefresh=100;
 private lastX=Infinity;
 private lastZ=Infinity;
 constructor(city:CityData){
  this.roadRoutes=city.roads.filter((r:Road)=>r.width>=7&&r.kind!=='service'&&r.kind!=='pedestrian').map(r=>routeOf(r.points)).filter((r):r is Route=>r!==null&&r.total>65);
  this.pedestrianRoutes=[...(city.footways||[]),...(city.waterfront||[])].map((r:Path)=>routeOf(r.points)).filter((r):r is Route=>r!==null&&r.total>40);
 }
 private placeDrivers(x:number,z:number):void{
  const nearby=this.roadRoutes.filter(r=>near(r,x,z,700));
  if(nearby.length===0)return;
  const desired=24;
  while(this.drivers.length<desired){
   const index=this.drivers.length;
   const mesh=vehicle();mesh.scale.setScalar(.83+random(index*7)*.14);
   mesh.traverse(n=>{if(n instanceof THREE.Mesh)n.castShadow=false;});
   this.group.add(mesh);
   this.drivers.push({mesh,route:nearby[index%nearby.length],distance:0,speed:8+random(index*23)*5,direction:index%2===0?1:-1,seed:index,heading:0});
  }
  for(let i=0;i<this.drivers.length;i++){
   const driver=this.drivers[i];
   driver.route=nearby[Math.floor(random(i*31+Math.floor(x/280)*7+Math.floor(z/280)*11)*nearby.length)];
   driver.distance=random(i*53+Math.floor(x/130))*driver.route.total;
   driver.direction=i%2===0?1:-1;
   driver.speed=7+random(i*9)*7;
   driver.mesh.visible=true;
  }
 }
 private placeWalkers(x:number,z:number):void{
  const nearby=this.pedestrianRoutes.filter(r=>near(r,x,z,540));
  for(const old of this.walkers)this.people.remove(old.mesh);
  this.walkers.length=0;
  if(!nearby.length)return;
  for(let i=0;i<14;i++){
   const mesh=human();
   mesh.scale.setScalar(.88+random(i*8)*.16);
   mesh.traverse(n=>{if(n instanceof THREE.Mesh)n.castShadow=false;});
   this.people.add(mesh);
   const route=nearby[Math.floor(random(i*43+Math.floor(x/260))*nearby.length)];
   this.walkers.push({mesh,route,distance:random(i*47)*route.total,speed:.95+random(i*32)*.7,direction:i%2?1:-1,seed:i,heading:0,phase:0});
  }
 }
 update(dt:number,x:number,z:number,playerCar?:Point):void{
  this.sinceRefresh+=dt;
  if(this.sinceRefresh>7&&(Math.hypot(x-this.lastX,z-this.lastZ)>220||this.lastX===Infinity)){
   this.placeDrivers(x,z);this.placeWalkers(x,z);this.lastX=x;this.lastZ=z;this.sinceRefresh=0;
  }
  for(const v of this.drivers){
   if(!v.mesh.visible)continue;
   const here=evaluate(v.route,v.distance,v.direction);
   const distance=Math.hypot(here.x-x,here.z-z);
   if(distance>800){v.mesh.visible=false;continue;}
   if(distance<800&&distance>10)v.mesh.visible=true;
   const closeToPlayer=playerCar&&separation(here,playerCar)<7;
   const rate=closeToPlayer?0:v.speed;
   v.distance+=rate*v.direction*dt;
   if(v.distance>=v.route.total){v.distance=v.route.total;v.direction=-1;}
   if(v.distance<=0){v.distance=0;v.direction=1;}
   const next=evaluate(v.route,v.distance,v.direction);
   v.mesh.position.set(next.x,.04,next.z);v.mesh.rotation.y=next.heading;
   v.heading=next.heading;
  }
  for(const w of this.walkers){
   const distance=Math.hypot(w.mesh.position.x-x,w.mesh.position.z-z);
   if(distance>600&&w.phase>0){w.mesh.visible=false;continue;}
   w.mesh.visible=true;w.distance+=w.speed*w.direction*dt;
   if(w.distance>=w.route.total){w.distance=w.route.total;w.direction=-1;}
   if(w.distance<=0){w.distance=0;w.direction=1;}
   const p=evaluate(w.route,w.distance,w.direction);
   w.mesh.position.set(p.x,.04,p.z);w.mesh.rotation.y=p.heading;
   w.phase+=dt*9;
   const arms=w.mesh.userData.arms as THREE.Mesh[]|undefined;
   const legs=w.mesh.userData.legs as THREE.Mesh[]|undefined;
   if(arms&&legs){const t=Math.sin(w.phase)*.33;legs[0].rotation.x=t;legs[1].rotation.x=-t;arms[0].rotation.x=-t;arms[1].rotation.x=t;}
  }
 }
}