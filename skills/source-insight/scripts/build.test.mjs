// 验证绑定、未知边界、离线转义与讲解锚点；夹具只写入临时目录。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('索引区分同名方法、别名导入、接口与未知调用，保留安全文本', () => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'source-insight-test-'));
  const compiler=process.env.SOURCE_INSIGHT_COMPILER;
  const build=fileURLToPath(new URL('./build.mjs',import.meta.url));
  const files={
    'package.json':'{"name":"fixture","type":"module"}',
    'tsconfig.json':'{"compilerOptions":{"target":"ESNext","module":"NodeNext","moduleResolution":"NodeNext"}}',
    'a.ts':'export function same(n: number) { return n + 1; }\nexport class A { run() { return same(1); } }\nexport interface Port { run(): number; }',
    'b.ts':'import { same as renamed, A, type Port } from "./a.js";\nexport function same() { return "local"; }\nexport class B { run() { return same(); } }\nexport class Child extends A {}\nexport function use(p: Port) { renamed(2); new A().run(); new B().run(); p.run(); }\nexport function dynamic(p: unknown) { (p as any)["later"](); }\nexport const content = "</script><img src=x onerror=alert(1)>";',
    '.env':'DO_NOT_EXPORT=this-is-a-test-secret',
  };
  try {
    for(const [name,text] of Object.entries(files))fs.writeFileSync(path.join(root,name),text);
    execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['add','package.json','tsconfig.json','a.ts','b.ts','.env'],{cwd:root});
    const analysis={title:'示例',notes:[{file:'b.ts',symbol:'use',title:'调用不同目标',body:'用类型与作用域区分，而非名称相同就连线。'}],chains:[]};
    fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify(analysis));
    const argv=[build,'--root',root,'--out',path.join(root,'out'),'--analysis',path.join(root,'analysis.json')];
    if(compiler)argv.push('--compiler',compiler);
    execFileSync(process.execPath,argv,{maxBuffer:2e6});
    const d=JSON.parse(fs.readFileSync(path.join(root,'out/index.json'),'utf8'));
    const get=(file,name)=>d.symbols.find(s=>s.file===file&&s.qualified===name);
    const callsFrom=s=>d.calls.filter(c=>c.from===s.id);
    const use=callsFrom(get('b.ts','use'));
    assert(use.some(c=>c.expression==='renamed'&&c.to.includes(get('a.ts','same').id)));
    assert(callsFrom(get('a.ts','A.run')).some(c=>c.to.includes(get('a.ts','same').id)));
    assert(callsFrom(get('b.ts','B.run')).some(c=>c.to.includes(get('b.ts','same').id)));
    assert(use.some(c=>c.expression==='p.run'&&c.certainty==='contract'));
    assert(callsFrom(get('b.ts','dynamic')).some(c=>c.certainty==='unresolved'));
    assert(d.inheritance.some(e=>e.from===get('b.ts','Child').id&&e.to===get('a.ts','A').id));
    assert(d.imports.some(e=>e.from==='b.ts'&&e.to==='a.ts'));
    assert(!d.files.some(f=>f.id==='.env'));
    assert.equal(d.analysis.notes[0].symbolId,get('b.ts','use').id);
    const chunk=fs.readFileSync(path.join(root,'out',d.files.find(f=>f.id==='b.ts').chunk),'utf8');
    assert(!chunk.includes('</script>'));assert(chunk.includes('\\u003c/script>'));
    assert.equal(d.revision,'uncommitted');
    analysis.notes[0].symbol='missing';fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify(analysis));
    assert.throws(()=>execFileSync(process.execPath,argv,{stdio:'pipe'}),/Command failed/);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
});
