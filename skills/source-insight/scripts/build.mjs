// 读取源码与编译器语义，生成离线工作台；不导入或执行被分析项目。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pack } from './pack.mjs';

const args = process.argv.slice(2);
const value = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
if (args.includes('--help')) {
  console.log('node scripts/build.mjs --root REPO --out REPO/source-guide/dist [--analysis FILE] [--compiler PATH_TO_TYPESCRIPT_JS] [--config tsconfig.json]');
  process.exit(0);
}
const root = fs.realpathSync(value('--root', '.'));
const out = path.resolve(value('--out', path.join(root, 'source-guide/dist')));
const require = createRequire(path.join(root, 'package.json'));
const compiler = value('--compiler');
let ts;
try { ts = compiler ? require(path.resolve(compiler)) : require('typescript'); } catch {}
if (!ts?.createProgram) throw new Error('需要提供 createProgram 的 TypeScript 编译器 API。可用 --compiler 指向本机已有兼容编译器；不要降级目标项目依赖。');
const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 50e6 }).split('\0').filter(Boolean);
let revision = 'uncommitted';
try { revision = execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: root, encoding: 'utf8', stdio:['ignore','pipe','ignore'] }).trim(); } catch {}
const worktree = execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: root, encoding: 'utf8' }).trim();
const excluded = /(^|\/)(node_modules|\.git|dist|build|coverage|vendor|architecture-guide|source-guide)(\/|$)|(^|\/)(\.env(?:\..*)?|credentials(?:\..*)?|id_rsa|id_ed25519)$|\.(pem|key|p12|lock)$/i;
const files = [], textByFile = new Map(), absByRel = new Map();
for (const name of tracked) {
  if (excluded.test(name)) continue;
  const abs = path.resolve(root, name);
  let real, stat;
  try { real = fs.realpathSync(abs); stat = fs.statSync(abs); } catch { continue; }
  if (!real.startsWith(root + path.sep) || !stat.isFile()) continue;
  const file = { id: name, size: stat.size, language: 'text', readable: false };
  files.push(file);
  if (stat.size > 1500000) { file.reason = '超过 1.5 MB，仅保留路径'; continue; }
  const bytes = fs.readFileSync(abs);
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { file.reason = '二进制或非 UTF-8'; continue; }
  if (text.includes('\0')) { file.reason = '二进制'; continue; }
  file.readable = true; file.lines = text.split('\n').length;
  file.hash = createHash('sha256').update(bytes).digest('hex');
  file.language = /\.[cm]?[jt]sx?$/.test(name) ? 'typescript' : path.extname(name).slice(1) || 'text';
  textByFile.set(name, text); absByRel.set(name, abs);
}
const toRel = abs => path.relative(root, path.resolve(abs)).split(path.sep).join('/');
const roots = files.filter(f => f.readable && f.language === 'typescript').map(f => absByRel.get(f.id));
const configPath = path.resolve(root, value('--config', 'tsconfig.json'));
let options = { target: ts.ScriptTarget.Latest, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, allowJs: true, noEmit: true, skipLibCheck: true };
const diagnostics = [];
if (fs.existsSync(configPath)) {
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
  options = { ...options, ...parsed.options, noEmit: true, allowJs: true };
  for (const error of parsed.errors) diagnostics.push(ts.flattenDiagnosticMessageText(error.messageText, '\n'));
}
console.log(`读取 ${roots.length} 个 JS/TS 文件，使用 TypeScript ${ts.version}…`);
const program = ts.createProgram(roots, options);
const checker = program.getTypeChecker();
const sources = program.getSourceFiles().filter(s => textByFile.has(toRel(s.fileName)) && /\.[cm]?[jt]sx?$/.test(s.fileName));
const symbols = [], byNode = new Map(), bySymbol = new Map(), fileSymbols = new Map();
const callableKinds = new Set(['function', 'method', 'constructor', 'accessor']);
const loc = (source, pos) => { const p = source.getLineAndCharacterOfPosition(pos); return { line: p.line + 1, col: p.character }; };
function kind(node) {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isMethodDeclaration(node) || ts.isMethodSignature(node)) return 'method';
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node)) return 'accessor';
  if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) ? 'function' : 'variable';
  if (ts.isPropertyDeclaration(node) || ts.isPropertySignature(node)) return node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) ? 'method' : 'property';
}
for (const source of sources) {
  const file = toRel(source.fileName);
  const syntax = source.parseDiagnostics || [];
  for (const d of syntax) diagnostics.push(`${file}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`);
  function declarations(node, parent) {
    const k = kind(node);
    const name = k && (node.name?.getText(source) || (k === 'constructor' ? 'constructor' : 'default'));
    let current = parent;
    if (name) {
      const start = node.getStart(source), pos = loc(source, start), end = loc(source, node.end).line;
      const id = `${file}#${start}`;
      const symbol = node.name && checker.getSymbolAtLocation(node.name);
      const record = { id, file, name, kind: k, ...pos, end, parent: parent?.id || null, qualified: parent ? `${parent.qualified}.${name}` : name, implementation: !!node.body || !!node.initializer };
      const sigNode = ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node) ? node.initializer : node;
      if (sigNode && callableKinds.has(k)) {
        try { const sig = checker.getSignatureFromDeclaration(sigNode); if (sig) record.signature = checker.signatureToString(sig, undefined, ts.TypeFormatFlags.NoTruncation).slice(0, 2000); } catch {}
      }
      if (symbol) {
        record.doc = ts.displayPartsToString(symbol.getDocumentationComment(checker)).slice(0, 2500);
        const entries = bySymbol.get(symbol) || []; entries.push(record); bySymbol.set(symbol, entries);
      }
      symbols.push(record); byNode.set(node, record);
      if (node.name) byNode.set(node.name, record);
      if (node.initializer && callableKinds.has(k)) byNode.set(node.initializer, record);
      if (!fileSymbols.has(file)) fileSymbols.set(file, []);
      fileSymbols.get(file).push(id); current = record;
    }
    ts.forEachChild(node, child => declarations(child, current));
  }
  declarations(source, null);
}
function targets(node) {
  let symbol = checker.getSymbolAtLocation(node);
  if (!symbol) return [];
  if (symbol.flags & ts.SymbolFlags.Alias) { try { symbol = checker.getAliasedSymbol(symbol); } catch { return []; } }
  const choices = bySymbol.get(symbol) || (symbol.declarations || []).map(d => byNode.get(d)).filter(Boolean);
  const implemented = choices.filter(s => s.implementation);
  return implemented.length ? implemented : choices;
}
const calls = [], refs = [], inheritance = [], imports = [], perFile = new Map();
for (const source of sources) {
  const file = toRel(source.fileName), fileRefs = [];
  perFile.set(file, fileRefs);
  function visit(node, owner, deferred = false) {
    const own = byNode.get(node);
    if (own && (callableKinds.has(own.kind) || own.kind === 'class')) { owner = own; deferred = false; }
    else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) deferred = true;
    if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) {
      const found = targets(node);
      if (found.length) {
        const pos = loc(source, node.getStart(source));
        const declaration = byNode.get(node)?.id;
        const record = { file, ...pos, length: node.end - node.getStart(source), targets: found.map(t => t.id), declaration: !!declaration, owner: owner?.id || null };
        fileRefs.push(record);
        if (!declaration) refs.push(record);
      }
    }
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const expr = node.expression;
      const nameNode = ts.isPropertyAccessExpression(expr) ? expr.name : expr;
      let found = targets(nameNode);
      // Resolved signatures can identify imported overloads; interface signatures remain declarations.
      if (!found.length) { try { const d = checker.getResolvedSignature(node)?.declaration; const candidate = d && byNode.get(d); if (candidate) found = [candidate]; } catch {} }
      const pos = loc(source, node.getStart(source));
      const isContract = found.some(t => !t.implementation && ['method','property','function'].includes(t.kind));
      calls.push({ from: owner?.id || `file:${file}`, to: found.map(t => t.id), file, ...pos, expression: expr.getText(source).slice(0, 160), kind: ts.isNewExpression(node) ? 'construct' : 'call', deferred, certainty: !found.length ? 'unresolved' : isContract ? 'contract' : 'static' });
    }
    if (ts.isHeritageClause(node)) for (const type of node.types) {
      const target = targets(ts.isPropertyAccessExpression(type.expression) ? type.expression.name : type.expression);
      const from = byNode.get(node.parent);
      if (from) for (const to of target) inheritance.push({ from: from.id, to: to.id, kind: node.token === ts.SyntaxKind.ImplementsKeyword ? 'implements' : 'extends', file, ...loc(source, type.getStart(source)) });
    }
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const specifier = node.moduleSpecifier.text;
      const resolved = ts.resolveModuleName(specifier, source.fileName, options, ts.sys).resolvedModule;
      imports.push({ from: file, specifier, to: resolved && textByFile.has(toRel(resolved.resolvedFileName)) ? toRel(resolved.resolvedFileName) : null, line: loc(source, node.getStart(source)).line });
    }
    ts.forEachChild(node, child => visit(child, owner, deferred));
  }
  visit(source, null);
}
console.log(`已解析 ${symbols.length} 个声明、${refs.length} 处引用、${calls.length} 处调用。`);
const analysisPath = value('--analysis');
const analysis = analysisPath ? JSON.parse(fs.readFileSync(analysisPath, 'utf8')) : { title: path.basename(root), intro: '', notes: [], chains: [] };
function resolveAnchor(anchor) {
  if (!textByFile.has(anchor.file)) throw new Error(`讲解文件不存在或未收录：${anchor.file}`);
  if (anchor.symbol) {
    let candidates = symbols.filter(s => s.file === anchor.file && (s.qualified === anchor.symbol || s.name === anchor.symbol));
    if (anchor.line) candidates = candidates.filter(s => s.line === anchor.line);
    const implemented = candidates.filter(s => s.implementation); if (implemented.length) candidates = implemented;
    if (candidates.length !== 1) throw new Error(`符号定位不唯一或不存在：${anchor.file} ${anchor.symbol} (${candidates.length})`);
    anchor.symbolId = candidates[0].id; anchor.line = candidates[0].line; anchor.end = candidates[0].end;
  }
  if (!Number.isInteger(anchor.line) || anchor.line < 1 || anchor.line > textByFile.get(anchor.file).split('\n').length) throw new Error('讲解行号越界');
  return anchor;
}
for (const note of analysis.notes || []) {
  resolveAnchor(note);
  if (!note.title || !note.body) throw new Error('讲解需要标题和正文');
}
for (const chain of analysis.chains || []) {
  if (!chain.title || !chain.steps?.length) throw new Error('调用链需要标题和步骤');
  for (const step of chain.steps) resolveAnchor(step);
}
if (analysis.start) resolveAnchor(analysis.start);
for (const note of analysis.fileNotes || []) {
  if (!textByFile.has(note.file) || !note.summary) throw new Error('文件讲解需要已收录文件和职责摘要');
}
for (const doc of analysis.documents || []) {
  const file = files.find(f => f.id === doc.file && f.readable);
  if (!file || file.hash !== doc.sourceHash) throw new Error('文档译文与当前源码快照不匹配：' + doc.file);
  if (!doc.summary || !doc.translation) throw new Error('关键文档需要中文概要和完整译文');
  for (const link of doc.related || []) resolveAnchor({ ...link, line: link.line || 1 });
}
fs.mkdirSync(path.join(out, 'chunks'), { recursive: true });
const encode = data => JSON.stringify(data).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
for (const file of files) {
  if (!file.readable) continue;
  const chunk = createHash('sha256').update(file.id).digest('hex').slice(0, 24);
  file.chunk = `chunks/${chunk}.js`;
  file.symbols = fileSymbols.get(file.id) || [];
  const text = textByFile.get(file.id);
  // The compiler scanner gives token colours without adding a browser dependency.
  const tokens = [];
  if (file.language === 'typescript') {
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, /\.[jt]sx$/.test(file.id) ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard, text);
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
      let style = token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword ? 'keyword' : [ts.SyntaxKind.SingleLineCommentTrivia,ts.SyntaxKind.MultiLineCommentTrivia].includes(token) ? 'comment' : [ts.SyntaxKind.StringLiteral,ts.SyntaxKind.NoSubstitutionTemplateLiteral,ts.SyntaxKind.TemplateHead,ts.SyntaxKind.TemplateMiddle,ts.SyntaxKind.TemplateTail].includes(token) ? 'string' : token === ts.SyntaxKind.NumericLiteral ? 'number' : '';
      if (style) tokens.push([scanner.getTokenPos(), scanner.getTextPos(), style]);
    }
  }
  fs.writeFileSync(path.join(out, file.chunk), `window.SOURCE_FILES[${encode(file.id)}]=${encode({ text, refs: perFile.get(file.id) || [], tokens })};\n`);
}
const manifest = { version: 1, title: analysis.title || path.basename(root), root, revision, dirty: !!worktree, generated: new Date().toISOString(), compiler: ts.version, config: fs.existsSync(configPath) ? toRel(configPath) : null, files, symbols, refs, calls, inheritance, imports, analysis, diagnostics, coverage: { indexedFiles: sources.length, readableFiles: textByFile.size, skippedFiles: files.filter(f => !f.readable).length, unresolvedCalls: calls.filter(c => c.certainty === 'unresolved').length, limitations: ['JS/TS 使用编译器静态符号绑定；不是运行时完整调用轨迹。','接口、回调和动态分派不推断所有具体实现；未解析调用单独展示。','其他语言仅支持源码、文本搜索和人工行级讲解，不宣称语义引用。','只收录 Git 跟踪的当前文件；排除依赖、产物、常见凭证路径和超大文件。','使用指定根配置组织所有 JS/TS 文件；异构子项目配置可能影响解析。'] } };
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(manifest));
pack(manifest, out);
console.log(`离线源码工作台：${pathToFileURL(path.join(out, 'index.html')).href}`);
