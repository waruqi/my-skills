// 导出有限范围的本地 Git 历史与工作区差异，不执行仓库代码或访问远端。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export function writeHistory(root, out, notes = []) {
  const git = args => execFileSync('git', ['--no-pager', ...args], {cwd:root,encoding:'utf8',maxBuffer:32e6,stdio:['ignore','pipe','pipe']});
  const empty='4b825dc642cb6eb9a060e54bf8d69288fbee4904';
  let head;
  try { head=git(['rev-parse','--verify','HEAD']).trim(); } catch {}
  const recent=head?git(['log','--since=3 months ago','-40','--format=%H']).trim().split('\n').filter(Boolean):[];
  const hashes=[...new Set([...recent,...notes.filter(n=>n.deep&&/^[a-f0-9]{40}$/.test(n.commit)).map(n=>n.commit)])];
  const encode=data=>JSON.stringify(data).replaceAll('<','\\u003c');
  const commits=[];
  const directory=path.join(out,'history');fs.mkdirSync(directory,{recursive:true});
  for(const id of ['working',...hashes]){
    const working=id==='working';
    const meta=working?['未提交的修改','','','']:git(['show','-s','--format=%s%x00%an%x00%aI%x00%b',id]).trimEnd().split('\0');
    const parent=working?(head||empty):git(['rev-list','--parents','-n','1',id]).trim().split(' ')[1]||empty;
    const range=working?[parent]:[parent,id];
    // 禁用重命名推断以保证每个路径都有独立、可复现的差异。
    const base=['diff','--no-ext-diff','--no-textconv','--no-renames'];
    const excluded=/(^|\/)(node_modules|\.git|dist|build|coverage|vendor|architecture-guide|source-guide)(\/|$)|(^|\/)(\.env(?:\..*)?|credentials(?:\..*)?|id_rsa|id_ed25519)$|\.(pem|key|p12|lock)$/i;
    const names=git([...base,'--name-only','-z',...range,'--']).split('\0').filter(file=>file&&!excluded.test(file));
    const stats=git([...base,'--numstat','-z',...range,'--']).split('\0').filter(Boolean);
    const counts=new Map(stats.map(row=>{const [add,del,...parts]=row.split('\t');return [parts.join('\t'),{add,del}];}));
    const manual=notes.find(n=>n.commit===id);
    const files=[];let total=0;
    for(const file of names.slice(0,manual?.deep?250:100)){
      const stat=counts.get(file)||{add:'0',del:'0'};
      let patch='',truncated=false;
      if(total<2e6){
        try{patch=git([...base,'--unified=3',...range,'--',file]);}catch{patch='此文件差异过大，未导出。';truncated=true;}
        if(patch.length>100000){patch=patch.slice(0,100000);truncated=true;}total+=patch.length;
      }else{patch='本提交导出已达到 2 MB 限制，未包含此文件差异。';truncated=true;}
      const explanation=manual?.files?.find(n=>n.file===file)?.summary;
      files.push({file,...stat,patch,truncated,summary:explanation||`自动统计：${file} ${stat.add==='-'?'包含二进制变化':`新增 ${stat.add} 行，删除 ${stat.del} 行`}。具体行为变化尚未人工分析。`,analyzed:!!explanation});
    }
    const record={id,title:meta[0],author:meta[1],date:meta[2],body:meta[3],parent,working,files,deep:!!manual?.deep,analysisTitle:manual?.title,sections:manual?.sections||[],totalFiles:names.length,summary:manual?.summary||`自动统计：本${working?'次工作区修改':'提交'}涉及 ${names.length} 个文件。${working?'合并展示相对 HEAD 的暂存和未暂存修改，不含未跟踪文件。':'与第一父提交比较；提交标题与正文保留原文，尚未人工分析设计原因。'}`,analyzed:!!manual?.summary};
    const chunk='history/'+createHash('sha256').update(id).digest('hex').slice(0,20)+'.js';
    fs.writeFileSync(path.join(out,chunk),`window.SOURCE_HISTORY[${encode(id)}]=${encode(record)};\n`);
    commits.push({id,title:record.title,author:record.author,date:record.date,files:names,chunk,working,deep:record.deep,analysisTitle:record.analysisTitle});
  }
  return {commits,range:'本地最近三个月，最多 40 个提交；另保留选定深度分析提交；普通提交最多 100 个文件，深度分析最多 250 个文件，每文件最多 100 KB。重命名按删除与新增展示。',generated:new Date().toISOString()};
}
