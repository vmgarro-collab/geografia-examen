// Genera los iconos PNG de la app (sin dependencias): node tools/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
function crc(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}
  let x=0xffffffff;for(const b of buf)x=t[(x^b)&255]^(x>>>8);return(x^0xffffffff)>>>0;}
const chunk=(type,data)=>{const l=Buffer.alloc(4);l.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
function png(size){
  const raw=Buffer.alloc((size*4+1)*size);
  const c=size/2;
  for(let y=0;y<size;y++){raw[y*(size*4+1)]=0;
    for(let x=0;x<size;x++){
      let col=[59,110,168]; // fondo azul
      const dx=x-c,dy=y-c,d=Math.hypot(dx,dy);
      if(d<size*.36){col=[207,230,243]; // mar
        // "continente"
        const u=dx/size,v=dy/size;
        if((Math.hypot(u+.08,v+.02)<.17)||(Math.hypot(u-.1,v-.12)<.12)||(Math.hypot(u+.02,v+.18)<.09)) col=[243,234,210];
      }
      if(d>=size*.36&&d<size*.385) col=[255,255,255];
      // pin naranja
      if(Math.hypot(dx-size*.16,dy+size*.14)<size*.055) col=[245,166,35];
      const o=y*(size*4+1)+1+x*4;raw[o]=col[0];raw[o+1]=col[1];raw[o+2]=col[2];raw[o+3]=255;}}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
for(const s of [180,192,512]) fs.writeFileSync(`icons/icon-${s}.png`,png(s));
console.log('iconos listos');
