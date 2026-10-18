export type Point={x:number;z:number};
export type Geo={lat:number;lon:number};
export type Road={id:number;name:string;width:number;kind?:string;points:Point[]};
export type Building={id:number;height:number;points:Point[];kind?:string;material?:string;roof?:string;roof_colour?:string;name?:string};
export type Polygon={id:number;points:Point[];name?:string;kind?:string};
export type Path={id:number;points:Point[];name:string;width:number};
export type CityData={
 roads:Road[];buildings:Building[];source:string;area_bounds?:number[];
 parks?:Polygon[];water?:Polygon[];waterways?:Path[];footways?:Path[];waterfront?:Path[];
};
export const CENTER={lat:47.222586,lon:39.719441};
const A=111320,B=A*Math.cos(CENTER.lat*Math.PI/180);
export const project=(p:Geo):Point=>({x:(p.lon-CENTER.lon)*B,z:-(p.lat-CENTER.lat)*A});
export const location=(p:Point):Geo=>({lat:CENTER.lat-p.z/A,lon:CENTER.lon+p.x/B});
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
 status('Открываю локальные геоданные Ростова, Дона и набережной...');
 const response=await fetch('/world/center.json',{cache:'no-store'});
 if(!response.ok)throw Error('Геоданные не подготовлены. Выполни bash scripts/prepare_world.sh');
 const data=await response.json() as CityData;
 if(!Array.isArray(data.roads)||!Array.isArray(data.buildings)||data.roads.length<8||data.buildings.length<8)
  throw Error('Некорректные геоданные OSM');
 if(!data.area_bounds || !Array.isArray(data.waterfront))
  throw Error('Обнаружен старый center.json. Выполни bash scripts/prepare_world.sh для расширения города');
 return data;
}