import argparse,json,math,datetime
from pathlib import Path
import osmium
P=(47.222586,39.719441)
LON=111320*math.cos(math.radians(P[0]))
WIDTH={'primary':15,'secondary':12,'tertiary':10,'residential':8,'living_street':6,'service':5,'unclassified':7,'pedestrian':5,'trunk':18}
class Extractor(osmium.SimpleHandler):
 def __init__(self,b):
  super().__init__();self.b=b;self.roads=[];self.buildings=[]
 def way(self,w):
  t=dict(w.tags)
  if 'building' not in t and t.get('highway') not in WIDTH:return
  try: coords=[(n.location.lat,n.location.lon) for n in w.nodes]
  except osmium.InvalidLocationError:return
  if len(coords)<2 or not any(self.b[0]<=lat<=self.b[2] and self.b[1]<=lon<=self.b[3] for lat,lon in coords):return
  p=[{'x':(lon-P[1])*LON,'z':-(lat-P[0])*111320} for lat,lon in coords]
  if t.get('highway') in WIDTH:self.roads.append({'id':w.id,'name':t.get('name',''),'width':WIDTH[t['highway']],'points':p})
  if 'building' in t and len(p)>3:
   if abs(p[0]['x']-p[-1]['x'])+abs(p[0]['z']-p[-1]['z'])<1:p.pop()
   try:h=float(t['height'].replace(' m','')) if 'height' in t else float(t.get('building:levels',4))*3.2
   except ValueError:h=12
   self.buildings.append({'id':w.id,'height':max(3,min(h,150)),'points':p})
def main():
 ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--output',default='public/world/center.json');ap.add_argument('--bounds',nargs=4,type=float,default=[47.2177,39.7118,47.2272,39.728]);a=ap.parse_args();e=Extractor(a.bounds);e.apply_file(a.input,locations=True)
 if len(e.roads)<8 or len(e.buildings)<8:raise SystemExit('OSM data insufficient')
 out=Path(a.output);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps({'source':'© OpenStreetMap contributors (ODbL)','roads':e.roads,'buildings':e.buildings},ensure_ascii=False,separators=(',',':')))
 print('OSM_IMPORTED=YES',len(e.roads),len(e.buildings))
if __name__=='__main__':main()
