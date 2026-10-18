import argparse
import io
import json
import math
import time
from pathlib import Path
from urllib.request import Request,urlopen
from PIL import Image

CENTER=(47.222586,39.719441)
BOUNDS=(47.207,39.699,47.231,39.746)
URLS=('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      'https://elevation-tiles-prod-eu.s3.eu-central-1.amazonaws.com/terrarium/{z}/{x}/{y}.png')

def mercator(lon,lat,zoom):
 n=2**zoom
 latitude=math.radians(max(-85.05112878,min(85.05112878,lat)))
 return (lon+180)/360*n,(1-math.asinh(math.tan(latitude))/math.pi)/2*n

class Tiles:
 def __init__(self,zoom,cache):
  self.zoom=zoom
  self.cache=Path(cache)
  self.images={}
 def tile(self,x,y):
  key=x,y
  if key in self.images:return self.images[key]
  path=self.cache/str(self.zoom)/str(x)/(str(y)+'.png')
  if not path.exists():
   path.parent.mkdir(parents=True,exist_ok=True)
   for attempt in range(6):
    url=URLS[attempt%len(URLS)].format(z=self.zoom,x=x,y=y)
    try:
     with urlopen(Request(url,headers={'User-Agent':'RostovDrive/0.3 terrain importer'}),timeout=25) as response:
      content=response.read()
     with Image.open(io.BytesIO(content)) as image:image.verify()
     path.write_bytes(content)
     break
    except Exception as error:
     print('TERRAIN_RETRY',url,str(error),flush=True)
     if attempt==5:raise
     time.sleep(1+attempt*2)
  with Image.open(path) as im:
   image=im.convert('RGB')
   if image.size!=(256,256):raise ValueError('INVALID_DEM_TILE')
   self.images[key]=image
   return image
 def pixel(self,gx,gy):
  x=math.floor(gx/256);y=math.floor(gy/256)
  r,g,b=self.tile(x,y).getpixel((int(gx-x*256),int(gy-y*256)))
  return r*256+g+b/256-32768
 def sample(self,lat,lon):
  x,y=mercator(lon,lat,self.zoom)
  px=x*256-.5;py=y*256-.5
  a=math.floor(px);b=math.floor(py)
  tx=px-a;ty=py-b
  top=self.pixel(a,b)*(1-tx)+self.pixel(a+1,b)*tx
  bottom=self.pixel(a,b+1)*(1-tx)+self.pixel(a+1,b+1)*tx
  return top*(1-ty)+bottom*ty

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--output',default='public/world/terrain.json')
 ap.add_argument('--cache',default='.data/terrarium')
 ap.add_argument('--bounds',nargs=4,type=float,default=BOUNDS)
 ap.add_argument('--zoom',type=int,default=13)
 ap.add_argument('--columns',type=int,default=225)
 ap.add_argument('--rows',type=int,default=161)
 args=ap.parse_args()
 if args.zoom<6 or args.zoom>14 or args.columns<3 or args.rows<3:
  raise ValueError('INVALID_TERRAIN_GRID')
 south,west,north,east=args.bounds
 source=Tiles(args.zoom,args.cache)
 datum=source.sample(*CENTER)
 heights=[]
 for j in range(args.rows):
  lat=north-(north-south)*j/(args.rows-1)
  for i in range(args.columns):
   lon=west+(east-west)*i/(args.columns-1)
   heights.append(round(source.sample(lat,lon),2))
  if j%25==0:print('DEM_ROWS='+str(j)+'/'+str(args.rows),flush=True)
 if max(heights)-min(heights)<2:raise RuntimeError('DEM_SUSPICIOUSLY_FLAT')
 payload={'bounds':[south,west,north,east],'columns':args.columns,'rows':args.rows,
          'heights':heights,'datum':round(datum,3),
          'source':'Mapzen/AWS Terrain Tiles Terrarium, bare-earth digital elevation',
          'zoom':args.zoom}
 output=Path(args.output);output.parent.mkdir(parents=True,exist_ok=True)
 temp=output.with_suffix('.json.tmp')
 temp.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
 temp.replace(output)
 print('TERRAIN=REAL_DEM')
 print('DEM_MIN_M='+str(min(heights)))
 print('DEM_MAX_M='+str(max(heights)))
 print('DEM_DATUM_M='+str(round(datum,2)))
 print('DEM_TILES='+str(len(source.images)))
 print('DONE=YES')

if __name__=='__main__':main()
