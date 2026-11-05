// 压缩重复的关系位置并复制静态资源，不改变原始索引证据。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function pack(manifest, out) {
  const files = new Map(manifest.files.map((f,i)=>[f.id,i]));
  const symbols = new Map(manifest.symbols.map((s,i)=>[s.id,i]));
  const wire = {
    ...manifest,
    packed: true,
    refs: manifest.refs.map(r=>[files.get(r.file),r.line,r.col,r.length,r.targets.map(id=>symbols.get(id)),symbols.get(r.owner)??-1]),
    calls: manifest.calls.map(c=>[symbols.get(c.from)??-1,c.to.map(id=>symbols.get(id)),files.get(c.file),c.line,c.col,c.expression,c.kind==='construct'?1:0,c.deferred?1:0,['unresolved','contract','static'].indexOf(c.certainty)]),
  };
  const assets=fileURLToPath(new URL('../assets/',import.meta.url));
  for(const name of ['index.html','style.css','app.js'])fs.copyFileSync(path.join(assets,name),path.join(out,name));
  fs.writeFileSync(path.join(out,'data.js'),'window.SOURCE_INDEX='+JSON.stringify(wire).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029')+';window.SOURCE_FILES={};\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const out=path.resolve(process.argv[2]);
  pack(JSON.parse(fs.readFileSync(path.join(out,'index.json'),'utf8')),out);
  console.log('已更新离线工作台资源与压缩关系数据。');
}
