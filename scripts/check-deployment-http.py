"""Check a deployed static site against this machine's matching docs bundle."""
import argparse,gzip,hashlib,json,subprocess,urllib.request,urllib.error
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('base_url',help='For example https://host.ts.net/lidar/');parser.add_argument('--include-analysis',action='store_true');parser.add_argument('--code-ref',help='Compare tracked files with this Git revision instead of concurrent working-tree edits');args=parser.parse_args()
DOCS=Path(__file__).resolve().parents[1]/'docs';base=args.base_url.rstrip('/')+'/'
if args.code_ref:
 args.code_ref=subprocess.check_output(['git','rev-parse','--verify','--end-of-options',args.code_ref+'^{commit}'],cwd=DOCS.parent,text=True).strip()
def request(path,headers=None):return urllib.request.urlopen(urllib.request.Request(base+path,headers=headers or {}),timeout=30)
def expected(path):
 if args.code_ref:
  r=subprocess.run(['git','cat-file','blob',args.code_ref+':docs/'+path],cwd=DOCS.parent,capture_output=True)
  if r.returncode==0:return r.stdout
 return (DOCS/path).read_bytes()
paths=['index.html','aldeia-da-mata/surface.html','aldeia-da-mata/surface-viewer.js','aldeia-da-mata/data/metadata.js','aldeia-da-mata/data/terrain-parish.js','aldeia-da-mata/land-comparison.js','aldeia-da-mata/aerial-comparison.js','aldeia-da-mata/aerial-drape.js','aldeia-da-mata/archaeology-viewer.js','aldeia-da-mata/data/archaeology-parish.js']
for name in ['max-detail','vegetation-parish','buildings-parish','bridges-parish','water-parish','unclassified-parish','aerial-2025']:
 p=DOCS/'aldeia-da-mata/data'/(name+'-index.js');m=json.loads(p.read_text().split('=',1)[1].rstrip(';\n'));paths.append(str(p.relative_to(DOCS)));tiles=sorted(m['tiles'].values(),key=lambda t:t['url'])
 for i in {0,len(tiles)//2,len(tiles)-1}:paths.append('aldeia-da-mata/'+tiles[i]['url'])
if args.include_analysis:
 paths+=['aldeia-da-mata/analysis-parish/index.html','aldeia-da-mata/analysis-parish/gallery.js','aldeia-da-mata/analysis-parish/gallery.css','aldeia-da-mata/analysis-parish/gallery-index.js','aldeia-da-mata/analysis-parish/screening-rich-12-high/index.html','aldeia-da-mata/analysis-parish/screening-rich-12-high/comparison.js','aldeia-da-mata/analysis-parish/screening-rich-12/comparison.js','aldeia-da-mata/analysis-village/index.html']
 m=json.loads((DOCS/'aldeia-da-mata/analysis-parish/manifest.json').read_text());patches=m['patches']
 for i in [0,len(patches)//2,len(patches)-1]:paths.append('aldeia-da-mata/analysis-parish/'+patches[i]['images']['hillshade-315'])
 for i in range(1,13):paths.append(f'aldeia-da-mata/analysis-parish/screening-rich-12/packages/R{i:02}/aerial-patch.png')
checked=0
with request('healthz')as r:assert r.status==200 and r.read()==b'ok\n'
with request('')as r:assert r.status==200 and r.geturl().startswith(base),'Entry redirect changed scheme, host or prefix'
for path in dict.fromkeys(paths):
 with request(path,{'Accept-Encoding':'gzip'})as r:
  assert r.status==200,path;raw=r.read();raw=gzip.decompress(raw)if r.headers.get('Content-Encoding')=='gzip'else raw
  assert hashlib.sha256(raw).digest()==hashlib.sha256(expected(path)).digest(),path
  assert r.headers.get('X-Content-Type-Options')=='nosniff',path
  if path.endswith('.js'):assert 'javascript'in r.headers['Content-Type'],path
  checked+=1
path='aldeia-da-mata/data/points.bin'
with request(path,{'Range':'bytes=16-31'})as r:assert r.status==206 and r.read()==expected(path)[16:32]
for path in ['definitely-missing-lidar-file.js','.env']:
 try:request(path);raise AssertionError('Unexpected success: '+path)
 except urllib.error.HTTPError as e:assert e.code in [403,404]
print(json.dumps({'passed':True,'baseUrl':base,'byteIdenticalResources':checked,'health':True,'entryRedirect':True,'range206':True,'missingAndHiddenFiles':True,'analysisIncluded':args.include_analysis,'codeRef':args.code_ref},indent=2))
