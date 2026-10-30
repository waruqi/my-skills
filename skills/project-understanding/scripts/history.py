"""只读导出有时间边界的 Git 日志、分支比较及按需加载的差异。"""
from datetime import datetime, timedelta, timezone
import hashlib
import json
import re
import subprocess


def build_history(root, out, content):
    config = content.get('historyOptions', {})
    days = int(config.get('days', 92))
    limit = int(config.get('maxCommits', 2500))
    if not 1 <= days <= 3660 or not 1 <= limit <= 10000:
        raise ValueError('历史范围需要 days=1..3660，maxCommits=1..10000')
    since = (datetime.now(timezone.utc) - timedelta(days=days)).date().isoformat()

    def git(*args):
        return subprocess.check_output(['git', '-c', 'core.quotepath=false', *args], cwd=root,input=b'').decode('utf-8', errors='replace')

    if subprocess.run(['git','rev-parse','--verify','HEAD'],cwd=root,capture_output=True).returncode:
        return dict(commits=[],branches=[],since=since,total=0,notes=[],comparisons=[],head=None)
    head = git('rev-parse','HEAD').strip()
    # NUL delimiters keep commit bodies and names out of the parsing syntax.
    fields = git('log','--all',f'--since={since}',f'--max-count={limit}','--date-order',
                 '--format=%H%x00%P%x00%cI%x00%aI%x00%an%x00%s%x00%B%x00').split('\0')
    commits = []
    for i in range(0,len(fields)-1,7):
        sha,parents,date,authored,author,subject,body=fields[i:i+7]
        commits.append(dict(id=sha.strip(),parents=parents.split(),date=date,authored=authored,author=author,subject=subject,body=body))
    total = int(git('rev-list','--all',f'--since={since}','--count').strip())
    refs = git('for-each-ref','--format=%(refname)%00%(objectname)%00%(symref)','refs/heads','refs/remotes').splitlines()
    branches=[]
    for ref in refs:
        name,tip,sym=ref.split('\0')
        if sym: continue
        reachable=set(git('rev-list',f'--since={since}',tip).splitlines())
        branches.append(dict(name=name.removeprefix('refs/'),tip=tip,commits=[c['id'] for c in commits if c['id'] in reachable]))
    exact={}
    def refs_in(value,page):
        if isinstance(value,dict):
            if 'path' in value: exact.setdefault(value['path'],set()).add(page)
            for key,child in value.items():
                if key not in ('data','sample','media','excerpt'): refs_in(child,page)
        elif isinstance(value,list):
            for child in value: refs_in(child,page)
    for page in content['pages']: refs_in(page,page['id'])
    for diagram in content['diagrams']:
        for page in diagram['pages']: refs_in(diagram,page)
    notes = content.get('historyNotes',[])
    for note in notes:
        if not re.fullmatch('[0-9a-f]{40}',note['commit']): raise ValueError('历史分析必须引用完整 commit SHA')
        if any(p not in {v['id'] for v in content['pages']} for p in note.get('pages',[])): raise ValueError('历史分析关联了不存在的页面')
    directory=out/'git-history';directory.mkdir(parents=True,exist_ok=True)
    empty=git('hash-object','-t','tree','--stdin').strip()

    def diff(base,tip,key):
        chunk='git-history/'+hashlib.sha256(key.encode()).hexdigest()[:24]+'.js'
        prefix='window.HISTORY_DETAILS['+json.dumps(key)+']='
        cached=out/chunk
        if cached.exists():
            encoded=cached.read_text()
            data=json.loads(encoded[len(prefix):-2]) if encoded.startswith(prefix) and encoded.endswith(';\n') else None
            if data and data.get('base')==base and data.get('tip')==tip:
                for file in data['files']:
                    file['pages']=sorted(exact.get(file['old'],set())|exact.get(file['name'],set()))
                cached.write_text(prefix+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+';\n')
                return dict(chunk=chunk,files=[{k:v for k,v in f.items() if k!='patch'} for f in data['files']])
        raw=git('diff','--no-ext-diff','--no-textconv','--find-renames','--name-status','-z',base,tip,'--').split('\0')
        files=[]; i=0
        while i<len(raw)-1:
            status=raw[i];old=raw[i+1];i+=2
            new=raw[i] if status.startswith(('R','C')) else old
            if status.startswith(('R','C')): i+=1
            files.append(dict(status=status,old=old,name=new,pages=sorted(exact.get(old,set())|exact.get(new,set()))))
        patch=git('diff','--no-ext-diff','--no-textconv','--find-renames','--no-color','--unified=3',base,tip,'--')
        blocks=re.split(r'(?=^diff --git )',patch,flags=re.M)
        blocks=[b for b in blocks if b]
        if len(blocks)!=len(files): raise ValueError('差异文件与文件状态数量不匹配')
        for file,block in zip(files,blocks):
            if re.search(r'(^|/)(\.env(?:\..*)?|credentials(?:\..*)?|id_rsa|id_ed25519)$|\.(pem|key|p12)$',file['name'],re.I):
                file.update(patch='',omitted='可能包含凭证，未打包差异')
            else:
                rows=block.splitlines(); file['truncated']=len(rows)>3000
                file['patch']='\n'.join(rows[:3000])
        data=dict(base=base,tip=tip,files=files)
        (out/chunk).write_text('window.HISTORY_DETAILS['+json.dumps(key)+']='+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+';\n')
        return dict(chunk=chunk,files=[{k:v for k,v in f.items() if k not in ('patch',)} for f in files])

    for index,c in enumerate(commits):
        c['base']=c['parents'][0] if c['parents'] else empty
        c.update(diff(c['base'],c['id'],c['id']))
        if (index+1)%250==0: print(f'历史差异 {index+1}/{len(commits)}',flush=True)
    comparisons=[]
    for branch in branches:
        key='branch:'+branch['name']
        ahead,behind=git('rev-list','--left-right','--count',head+'...'+branch['tip']).split()
        comparisons.append(dict(id=key,name=branch['name'],base=head,tip=branch['tip'],behind=int(ahead),ahead=int(behind),**diff(head,branch['tip'],key)))
    return dict(head=head,since=since,days=days,total=total,limit=limit,commits=commits,branches=branches,comparisons=comparisons,notes=notes)
