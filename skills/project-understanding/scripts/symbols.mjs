// 从目标项目已有的 TypeScript 编译器提取离线符号，不安装依赖或执行项目代码。
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const root = process.argv[2];
const require = createRequire(resolve(root, 'package.json'));
let ts, parse;
try { ts = require('typescript'); } catch {}
if (!ts?.createSourceFile) {
  try { parse = require('rolldown/utils').parseSync; } catch {}
  if (!parse) { process.stdout.write('{}'); process.exit(0); }
}
const paths = JSON.parse(readFileSync(0, 'utf8'));
const result = {};
for (const path of paths) {
  if (!/\.[cm]?[jt]sx?$/.test(path)) continue;
  if (parse) {
    const text = readFileSync(resolve(root, path), 'utf8');
    const parsed = parse(path, text);
    if (parsed.errors.length) continue;
    const items = [];
    const starts = [0];
    for (let i = 0; i < text.length; i++) if (text[i] === '\n') starts.push(i + 1);
    function lineAt(offset) {
      let low = 0, high = starts.length;
      while (low < high) { const mid = (low + high) >>> 1; if (starts[mid] <= offset) low = mid + 1; else high = mid; }
      return low;
    }
    function walk(node, parent = '', depth = 0) {
      const kinds = {FunctionDeclaration:'函数',TSDeclareFunction:'函数',ClassDeclaration:'类',TSInterfaceDeclaration:'接口',TSTypeAliasDeclaration:'类型',TSEnumDeclaration:'枚举',MethodDefinition:'方法',TSAbstractMethodDefinition:'方法',TSMethodSignature:'方法',PropertyDefinition:'属性',TSPropertySignature:'属性',VariableDeclarator:'变量'};
      let kind = kinds[node.type];
      if (kind && ['ArrowFunctionExpression','FunctionExpression'].includes((node.init || node.value)?.type)) kind = '函数';
      const key = node.id || node.key;
      const name = kind && key && (key.name || text.slice(key.start,key.end));
      if (name) items.push({name,kind,parent,depth,line:lineAt(node.start),end:lineAt(node.end)});
      for (const [field,value] of Object.entries(node)) {
        if (field === 'parent') continue;
        for (const child of Array.isArray(value) ? value : [value]) {
          if (child && typeof child === 'object' && typeof child.type === 'string') walk(child,name ? (parent ? parent+'.' : '')+name : parent,name ? depth+1 : depth);
        }
      }
    }
    walk(parsed.program);
    result[path] = {mode:'JavaScript / TypeScript 语法树',items};
    continue;
  }
  const source = ts.createSourceFile(path, readFileSync(resolve(root, path), 'utf8'), ts.ScriptTarget.Latest, true);
  const symbols = [];
  function visit(node, parent = '', depth = 0) {
    let kind;
    if (ts.isFunctionDeclaration(node)) kind = '函数';
    else if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) kind = '方法';
    else if (ts.isConstructorDeclaration(node)) kind = '构造';
    else if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) kind = '访问器';
    else if (ts.isClassDeclaration(node)) kind = '类';
    else if (ts.isInterfaceDeclaration(node)) kind = '接口';
    else if (ts.isTypeAliasDeclaration(node)) kind = '类型';
    else if (ts.isEnumDeclaration(node)) kind = '枚举';
    else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) kind = node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) ? '函数' : '变量';
    else if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node) || ts.isPropertyAssignment(node)) kind = node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) ? '函数' : '属性';
    const name = kind && (node.name?.getText(source) || (kind === '构造' ? 'constructor' : undefined));
    if (name) {
      symbols.push({name, kind, parent, depth, line:source.getLineAndCharacterOfPosition(node.getStart(source)).line+1, end:source.getLineAndCharacterOfPosition(node.end).line+1});
    }
    ts.forEachChild(node, child => visit(child, name ? (parent ? parent+'.' : '')+name : parent, name ? depth+1 : depth));
  }
  visit(source);
  result[path] = {mode:'TypeScript 语法树',items:symbols};
}
process.stdout.write(JSON.stringify(result));
