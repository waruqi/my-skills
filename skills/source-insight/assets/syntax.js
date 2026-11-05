// 离线词法着色与语义索引分离；返回原文的 UTF-16 区间，保留真实行列与引用。
(() => {
  const aliases={py:'python',pyw:'python',ts:'typescript',tsx:'typescript',mts:'typescript',cts:'typescript',js:'javascript',jsx:'javascript',mjs:'javascript',cjs:'javascript',c:'c',h:'cpp',cc:'cpp',cpp:'cpp',cxx:'cpp',hpp:'cpp',hh:'cpp',hxx:'cpp',lua:'lua',go:'go',rs:'rust',java:'java',kt:'kotlin',kts:'kotlin',m:'objectivec',mm:'objectivec',objc:'objectivec',objcpp:'objectivec',html:'xml',htm:'xml',xml:'xml',svg:'xml',json:'json',sh:'bash',bash:'bash',zsh:'bash',css:'css',md:'markdown',markdown:'markdown',yml:'yaml',yaml:'yaml',swift:'swift'};
  const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function language(file){const key=file.toLowerCase().split('.').pop();return aliases[key]||(window.hljs.getLanguage(key)?key:null);}
  function html(text,file){const lang=language(file);return lang?window.hljs.highlight(text,{language:lang,ignoreIllegals:true}).value:escape(text);}
  function tokens(text,file){
    const template=document.createElement('template');template.innerHTML=html(text,file).replaceAll('\r','&#13;');
    const ranges=[];let offset=0;
    function walk(node,style=''){
      if(node.nodeType===Node.TEXT_NODE){const end=offset+node.textContent.length;if(style&&end>offset)ranges.push([offset,end,style]);offset=end;return;}
      let next=style;
      if(node.nodeType===Node.ELEMENT_NODE){
        const classes=[...node.classList];
        // function/class/params 是语法容器，不能把其整个函数体染成同一种颜色。
        const token=classes.find(c=>c.startsWith('hljs-')&&!['hljs-function','hljs-class','hljs-params','hljs-subst'].includes(c));
        if(token)next=token.slice(5);
        else if(classes.includes('hljs-subst'))next='';
      }
      for(const child of node.childNodes)walk(child,next);
    }
    walk(template.content);
    if(offset!==text.length)throw new Error('高亮结果与源码长度不一致');
    return ranges;
  }
  window.SourceSyntax={language,html,tokens};
})();
