// 在独立临时仓库中验证历史与工作区快照，不改动被分析仓库。
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {writeHistory} from './history.mjs';

test('根提交、暂存和未暂存修改、说明、凭据排除与安全补丁',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'source-history-'));
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',env:{...process.env,GIT_AUTHOR_NAME:'Fixture',GIT_AUTHOR_EMAIL:'fixture@example.test',GIT_COMMITTER_NAME:'Fixture',GIT_COMMITTER_EMAIL:'fixture@example.test'}}).trim();
 try{
  git(['init','-q']);fs.writeFileSync(path.join(root,'file.txt'),'before\n');fs.writeFileSync(path.join(root,'.env'),'secret=fixture\n');git(['add','file.txt','.env']);
  const tree=git(['write-tree']),id=git(['commit-tree',tree,'-m','initial']);git(['update-ref','HEAD',id]);
  fs.writeFileSync(path.join(root,'file.txt'),'staged\n');git(['add','file.txt']);fs.writeFileSync(path.join(root,'file.txt'),'working </script>\n');
  const out=path.join(root,'out'),history=writeHistory(root,out,[{commit:id,summary:'初始化文件',files:[{file:'file.txt',summary:'建立原始内容'}]}]);
  const context={window:{SOURCE_HISTORY:{}}};
  for(const c of history.commits){assert(!c.files.includes('.env'));const text=fs.readFileSync(path.join(out,c.chunk),'utf8');assert(!text.includes('</script>'));vm.runInNewContext(text,context);}
  const records=context.window.SOURCE_HISTORY;
  assert.match(records.working.files[0].patch,/-before\n\+working <\/script>/);assert(!records.working.files[0].patch.includes('+staged'));
  assert.match(records[id].files[0].patch,/\+before/);assert.equal(records[id].summary,'初始化文件');assert.equal(records[id].files[0].summary,'建立原始内容');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
