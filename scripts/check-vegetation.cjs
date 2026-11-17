// Validate the bundled vegetation layer against the independent terrain tile assets.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const folder=path.resolve(__dirname,'../docs/aldeia-da-mata/data');
const context={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(folder,'vegetation-village.js'),'utf8'),context);
vm.runInNewContext(fs.readFileSync(path.join(folder,'max-detail-index.js'),'utf8'),context);
const data=context.window.ALDEIA_VEGETATION_DATA,tiles=context.window.ALDEIA_MAX_DETAIL.tiles,loaded=new Map();
function unpack(encoded){const b=zlib.gunzipSync(Buffer.from(encoded,'base64'));return new Float32Array(b.buffer,b.byteOffset,b.length/4);}
function ground(x,y){
  const id=`t${Math.floor(x/250)*250}_${Math.floor(y/250)*250}`;
  if(!loaded.has(id)){
    const tile=tiles[id];assert(tile,'Ground tile must exist');
    const source=fs.readFileSync(path.join(folder,tile.url.replace('data/','')),'utf8');
    const payload=JSON.parse(source.slice(source.indexOf('={"id"')+1).replace(/;\s*$/,''));
    const bytes=zlib.gunzipSync(Buffer.from(payload.heights,'base64'));
    loaded.set(id,{...tile,values:new Uint16Array(bytes.buffer,bytes.byteOffset,bytes.length/2)});
  }
  const tile=loaded.get(id),col=Math.floor((x-tile.bounds[0])*2),row=Math.floor((tile.bounds[3]-y)*2),value=tile.values[row*500+col];
  assert.notEqual(value,65535,'Measurement must have supported ground');
  return tile.zBase+value*.01;
}
const canopy=unpack(data.canopy),points=unpack(data.points),cells=new Map();
assert.equal(canopy.length/4,data.canopyCells);assert.equal(points.length/4,data.displayPoints);
assert.equal(data.sourceCount,data.validCount+data.unsupported+data.outliers);
for(let i=0;i<canopy.length;i+=4){
  const [x,y,z,h]=canopy.subarray(i,i+4);
  assert(x>=data.bounds[0]&&x<data.bounds[2]&&y>=data.bounds[1]&&y<data.bounds[3]);
  assert(h>=.1&&h<=60);
  const key=Math.floor(data.bounds[3]-y)*1000+Math.floor(x-data.bounds[0]);
  assert(!cells.has(key),'One canopy value per cell');cells.set(key,h);
  // Check every canopy height against the independently decoded ground asset.
  assert(Math.abs(z-ground(x,y)-h)<.001,'Canopy height must equal elevation minus ground');
}
for(let i=0;i<points.length;i+=4){
  const [x,y,z,h]=points.subarray(i,i+4),key=Math.floor(data.bounds[3]-y)*1000+Math.floor(x-data.bounds[0]);
  assert(h<=cells.get(key)+.0001,'Canopy must include the displayed return');
  assert(Math.abs(z-ground(x,y)-h)<.001,'Point height must equal elevation minus ground');
}
console.log(`Validated ${data.canopyCells} canopy cells and ${data.displayPoints} display points against the 0.5 m ground tiles.`);
