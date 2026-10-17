export type Point={x:number;z:number};export type Geo={lat:number;lon:number};export type Road={id:number;name:string;width:number;points:Point[]};export type Building={id:number;height:number;points:Point[]};export type CityData={roads:Road[];buildings:Building[];source:string};export const CENTER={lat:47.222586,lon:39.719441};const A=111320,B=A*Math.cos(CENTER.lat*Math.PI/180);export const project=(p:Geo):Point=>({x:(p.lon-CENTER.lon)*B,z:-(p.lat-CENTER.lat)*A});export const location=(p:Point):Geo=>({lat:CENTER.lat-p.z/A,lon:CENTER.lon+p.x/B});const WIDTH:Record<string,number>={primary:15,secondary:12,tertiary:10,residential:8,living_street:6,service:5,unclassified:7,pedestrian:5,trunk:18};type Element={id:number;type:string;geometry?:Geo[];tags?:Record<string,string>};export function parseOSM(elements:Element[]):CityData{const roads:Road[]=[],buildings:Building[]=[];for(const el of elements){const tags=el.tags||{},p=el.geometry?.map(project);if(!p||el.type!=='way')continue;if(tags.highway&&WIDTH[tags.highway]&&p.length>1)roads.push({id:el.id,name:tags.name||'',width:WIDTH[tags.highway],points:p});if(tags.building&&p.length>=4){if(Math.hypot(p[0].x-p[p.length-1].x,p[0].z-p[p.length-1].z)<1)p.pop();const h=Number(tags.height),l=Number(tags['building:levels']);buildings.push({id:el.id,points:p,height:Number.isFinite(h)&&h>2?Math.min(h,150):Number.isFinite(l)&&l>0?Math.min(3.2*l,150):12});}}if(roads.length<8||buildings.length<8)throw Error('Недостаточно OSM-данных: '+roads.length+' дорог, '+buildings.length+' зданий');return{roads,buildings,source:'© OpenStreetMap contributors (ODbL)'};}
export function chooseSpawn(city:CityData):{x:number;z:number;heading:number}{
 let result:{x:number;z:number;heading:number}|null=null;
 let min=Infinity;
 for(const road of city.roads){
  if(road.width<7)continue;
  for(let i=1;i<road.points.length;i++){
   const a=road.points[i-1],b=road.points[i],dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
   if(den<36)continue;
   const t=Math.max(0,Math.min(1,-(a.x*dx+a.z*dz)/den));
   const x=a.x+dx*t,z=a.z+dz*t,d=Math.hypot(x,z);
   if(d<min){min=d;result={x,z,heading:Math.atan2(-dx,-dz)};}
  }
 }
 if(!result)throw Error('Не найдена автомобильная улица в реальном центре Ростова');
 return result;
}
export async function loadCity(status:(s:string)=>void):Promise<CityData>{
 status('Открываю локальные геоданные настоящего Ростова...');
 let response:Response;
 try{response=await fetch('/world/center.json',{cache:'no-store'});}
 catch{throw Error('Не удаётся открыть center.json. Выполни bash scripts/prepare_world.sh');}
 if(!response.ok)throw Error('Геоданные не подготовлены. Выполни bash scripts/prepare_world.sh в терминале Mac');
 const data=await response.json() as CityData;
 if(!Array.isArray(data.roads)||!Array.isArray(data.buildings)||data.roads.length<8||data.buildings.length<8)throw Error('Неверный или неполный center.json');
 return data;
}
