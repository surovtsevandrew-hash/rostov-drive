import argparse
import json
import math
from pathlib import Path
import osmium

ORIGIN_LAT=47.222586
ORIGIN_LON=39.719441
LON_SCALE=111320*math.cos(math.radians(ORIGIN_LAT))
WIDTH={'motorway':22,'trunk':18,'primary':15,'secondary':12,'tertiary':10,'residential':8,'living_street':6,'service':5,'unclassified':7,'pedestrian':6}
PEDESTRIAN={'footway','path','pedestrian','steps','cycleway'}
PARK_TYPES={'park','garden','recreation_ground','playground'}
LANDSCAPE={'grass','meadow','forest','recreation_ground','village_green'}
BOUNDS=[47.207,39.699,47.231,39.746]

def point(lat,lon):
    return {'x':round((lon-ORIGIN_LON)*LON_SCALE,3),'z':round(-(lat-ORIGIN_LAT)*111320,3)}

def is_closed(points):
    return len(points)>3 and math.hypot(points[0]['x']-points[-1]['x'],points[0]['z']-points[-1]['z'])<1.5

class Extractor(osmium.SimpleHandler):
    def __init__(self,bounds):
        super().__init__()
        self.bounds=bounds
        self.roads=[]
        self.buildings=[]
        self.parks=[]
        self.water=[]
        self.waterways=[]
        self.footways=[]
        self.waterfront=[]
        self.seen={key:set() for key in ('roads','buildings','parks','water','waterways','footways','waterfront')}

    def push(self,category,entry):
        if entry['id'] not in self.seen[category]:
            self.seen[category].add(entry['id'])
            getattr(self,category).append(entry)

    def way(self,way):
        tags=dict(way.tags)
        highway=tags.get('highway','')
        waters=tags.get('natural')=='water' or tags.get('waterway') in ('riverbank','dock') or tags.get('water') in ('river','canal','lake','pond','reservoir')
        river=tags.get('waterway') in ('river','stream','canal')
        park=tags.get('leisure') in PARK_TYPES or tags.get('landuse') in LANDSCAPE or tags.get('natural') in ('wood','grassland','scrub')
        building='building' in tags
        walkway=highway in PEDESTRIAN
        promenade=tags.get('embankment')=='yes' or tags.get('waterway')=='riverbank' or tags.get('man_made') in ('embankment','pier','quay') or 'набережн' in (tags.get('name','').lower()) or 'береговая' in tags.get('name','').lower()
        if not any((highway in WIDTH,walkway,waters,river,park,building,promenade)):
            return
        try:
            coords=[(node.location.lat,node.location.lon) for node in way.nodes]
        except osmium.InvalidLocationError:
            return
        if len(coords)<2 or not any(self.bounds[0]<=lat<=self.bounds[2] and self.bounds[1]<=lon<=self.bounds[3] for lat,lon in coords):
            return
        points=[point(lat,lon) for lat,lon in coords]
        polygon=is_closed(points)
        if polygon:
            points=points[:-1]
        if highway in WIDTH and len(points)>=2:
            self.push('roads',{'id':way.id,'name':tags.get('name',''),'kind':highway,'width':WIDTH[highway],'points':points})
        if building and polygon and len(points)>=3:
            try:
                height=float(tags['height'].replace(' m','')) if 'height' in tags else 3.2*float(tags.get('building:levels','4'))
            except ValueError:
                height=12
            self.push('buildings',{'id':way.id,'height':round(max(3,min(height,150)),2),'points':points})
        if park and polygon and len(points)>=3:
            self.push('parks',{'id':way.id,'points':points,'kind':tags.get('leisure',tags.get('natural',tags.get('landuse','grass')))})
        if waters and polygon and len(points)>=3:
            self.push('water',{'id':way.id,'points':points,'name':tags.get('name','')})
        if river and len(points)>=2:
            self.push('waterways',{'id':way.id,'points':points,'name':tags.get('name',''),'width':130 if tags.get('waterway')=='river' else 14})
        if walkway and len(points)>=2:
            self.push('footways',{'id':way.id,'points':points,'name':tags.get('name',''),'width':3 if highway!='pedestrian' else 7})
        if promenade and len(points)>=2:
            self.push('waterfront',{'id':way.id,'points':points,'name':tags.get('name',''),'width':6})

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--input',required=True)
    parser.add_argument('--output',default='public/world/center.json')
    parser.add_argument('--bounds',nargs=4,type=float,default=BOUNDS)
    args=parser.parse_args()
    parser=Extractor(args.bounds)
    parser.apply_file(args.input,locations=True)
    if len(parser.roads)<8 or len(parser.buildings)<8:
        raise SystemExit('OSM_DATA_INSUFFICIENT')
    payload={'source':'© OpenStreetMap contributors (ODbL)','area_bounds':args.bounds,
             'roads':parser.roads,'buildings':parser.buildings,'parks':parser.parks,
             'water':parser.water,'waterways':parser.waterways,'footways':parser.footways,'waterfront':parser.waterfront}
    destination=Path(args.output)
    destination.parent.mkdir(parents=True,exist_ok=True)
    temporary=destination.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    temporary.replace(destination)
    for name in ('roads','buildings','parks','water','waterways','footways','waterfront'):
        print(name.upper()+'='+str(len(payload[name])))
    print('REAL_ROSTOV=YES')
    print('SIZE_BYTES='+str(destination.stat().st_size))
    print('DONE=YES')

if __name__=='__main__':
    main()
