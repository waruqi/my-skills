# 内容格式：图驱动的分层阅读

`content.json` 使用 UTF-8 JSON，`schemaVersion` 为 `2`。顶层包含 `title`、`intro`、`pages` 和 `diagrams`。项目名和所有具体内容从目标项目提取。旧版 modules、chapters、reading 等不再作为页面协议；迁移时重新组织为统一页面树。

## 页面

`pages` 每项为 `{id, title, summary, kind, parent, sections}`。唯一根页 `id="overview"`、`parent=null`；其他页面必须有存在的父页。`kind` 为 `overview`、`subsystem`、`module`、`flow` 或 `code`。标题写当前层概念，不以文件清单代替解释。

`sections` 为 `{id, title, text, data?, refs?}` 数组，在图下方渲染为连续讲解，不作为正文列表导航。模块页必须包含 `purpose`、`design`、`runtime`、`input`、`output`、`code` 六个段落标识。`data` 是“视图名称 → JSON 值或字符串”的映射；格式、字段含义、生产者、消费者及真实性写在对应 `text` 中。

`refs` 每项为 `{path, symbol?, note?}`。路径是目标仓库 Git 跟踪的相对文本路径；`symbol` 是关键声明的文本，取第一个匹配行。构建器生成行号、24 行关键片段和文件摘要。`note` 解释代码的作用。完整文件可从正文或文件树打开。单文件不超过 2 MB，不引用秘密或用户私密数据。

## 图与下钻

每页至少一张图。图项为 `{id, pages, title, kind, caption, width, height, nodes, edges, bands?, lifelines?}`。`pages` 是应用该图的页面 ID 数组，每个父页必须通过图节点直接进入子页。

节点为 `{id, label, sub?, x, y, w?, h?, tone?, target?, section?, detail?, ref?}`。`target` 直接进入另一页；`section` 定位当前页段落，二者只能选一种。无定位的节点应提供 `detail` 或 `ref` 解释外部角色。`tone` 可为 green、blue、purple、orange；默认尺寸 180×70。节点文字短而完整，细节写在正文。

边为 `{d, label, x, y, dashed?}`，`d` 是 SVG 路径，`x/y` 是标签位置。连线不要穿过无关节点或文字，`caption` 说明阅读方向与线型。职责分解不代表执行顺序。`bands` 为 `{x,y,w,h,label}`，表示系统边界；`lifelines` 为 `{x,y,end}`，用于从上到下的时序图。

节点点击或键盘激活后进入子页或定位讲解。支持缩放和画布内滚动；面包屑与架构侧栏树反映相同页面层级；文件树支持搜索并关联引用页面。

补充的实现图可用 `after: "段落ID"` 放在对应解释之后，避免首页或模块顶部连续堆图。每页仍必须有一张未设置 after 的顶部图。

## 证据与覆盖

实际交付必须覆盖全部主要模块与关键运行路径，按全局、子系统、模块、机制、代码逐层组织，小项目可省略子系统层。验证范围写在首页正文，术语就地解释。Git 仓库无提交时显示 `uncommitted`，引用源码仍需被跟踪。网站不依赖网络、框架或 CDN；运行样本的依赖和启动方法写在目标项目 README。

## 可见的输入输出与界面

页面可增加 `exchange: {title, evidence, input, action, text, output}`，放在首张图之后、长篇解释之前。`input` 与 `output` 各为 `{label, format, sample, text}`：label 指明来源或去向，format 写真实类型或明确“摘录”，sample 为 JSON 值或字符串，text 解释字段和对应关系。action 是本次处理动作，text 解释变化，evidence 标明实际捕获、源码推导或教学示意。必须选择一组相互对应的小样本，不能机械取每页第一个 JSON；完整数据在 sections.data 中默认展开。

段落可增加 `media: {file, alt, caption}` 展示界面。file 为目标仓库 Git 跟踪的 PNG/JPEG/WebP 图片相对路径，大小不超过 5 MB；caption 说明来源、版本及是否本次运行。构建器嵌入图片供离线查看。没有真实界面的项目不需要图片。

首页首张图串起具体任务、程序、外部依赖和可观察结果。快速体验也是从图进入的页面，正文使用可复制命令和预期效果。模块的六个 section ID 用于校验，标题和段落应按当前机制自然表达，不要把 ID 翻译成固定问卷。

构建器为 sources 自动补充 absolutePath 和 fileUrl，均由目标根目录解析，不在技能中写死。引用的 symbol 匹配行作为关键入口行高亮。语法着色是轻量词法着色，非类型分析；Markdown/纯文本保持原样。复制路径、原文件链接和 VS Code/Cursor 定位均指向当前本机真实文件。

构建器从 Git 跟踪文件生成 files；可读 UTF-8 文本按需打包为 source-files 下的离线脚本块。二进制、超过 2 MB 和常见凭证文件仅展示路径和未打包原因。未被分析引用的文件可阅读源码，但不宣称已有架构讲解。

## Git 历史

顶层可设 historyOptions: {days:92,maxCommits:2500}。historyNotes 为 {commit,title,summary,reason,impact,evidence,pages,files} 数组；commit 为完整 SHA，pages 为当前讲解 ID，files 为核对过的路径字符串。构建器从本机全部引用导出范围内提交、父提交、作者/提交时间、文件状态及分支 tip。逐提交 diff 相对第一父提交，根提交相对空树；分支比较是 HEAD → tip 的净变化。未解读提交不生成虚构原因。

历史脚本块保存在 git-history/，浏览器按需加载。单文件 diff 最多显示 3000 行并标注截断；常见凭证文件省略内容。历史差异的行号属于旧/新提交，架构链接指向当前讲解。

## 核心设计专题

复用现有页面和图协议，不增加写死的设计分类。可用 flow 或 subsystem 页面承载主线与设计专题，由首页的 target 节点进入，专题再连接已有模块和源码。每个专题仍需顶部图；对照图标明简单方案是教学假设，箭头表达数据或状态变化。用 exchange 放关键差异的短样本，用 sections.text 说明问题、原因、代价和证据，refs 指向决定行为的实现；补充机制可用 after 内嵌图。专题标题与重点从目标项目提取，不使用固定亮点模板。

页面可选 `featuredLabel` 和 `featuredDescription`：前者是简短的独立导航名称，后者说明读者会看到什么。未设置 lesson 时，模板在顶部导航、侧栏顶部和首页标题下生成可点击入口，并标记专题及子页的当前位置；隐藏侧栏后顶部入口仍保留。不设置这些字段的项目不显示额外入口。入口名称和目标页面来自内容，不在模板中写死。

## 完整流程动画

页面可增加 `walkthrough: {diagram, evidence, steps}`。diagram 指向属于本页的顶部图；evidence 概括验证范围。设置 lesson 时把动画编排进课程，不显示独立专题导航。模板复用图节点与连线，不包含项目专属结构。

每步为 `{id,title,phase,text,evidence,nodes,edges,input,output,screen,refs?,page?,data?}`。id 唯一；phase 是简短阶段名，用于跳转。nodes 是本步高亮的图节点 ID 数组，edges 是本步高亮连线的零起始下标数组，箭头方向必须与数据流一致；没有跨模块传输时可为空。input/output 是 `{label,format,sample}`，分别说明来源、去向和实际格式。screen 为 `{title,text}`，展示当前用户看到的结果，模拟界面要在 title 或 evidence 标注。refs 使用已有源码引用格式；page 链接已有模块页；data 放完整请求体或长样本，默认折叠。样本中的文件 path 必须放在 sample/data 内，不能误识别为源码引用。

steps 用同一个任务，展示每轮请求如何加入上一轮结果，不能只换步骤标题。安装、外部响应、UI 与存储如果没有实跑，应逐步标明。播放状态不进入项目源码，不触发真实副作用。构建器检查步骤、节点、连线、目标页面和输入输出；作者仍须核对真实执行顺序和数据含义。

## 连续讲解

顶层可增加 `lesson: {slides}`。每项为 `{page,title,chapter,note,next?,diagram?,steps?,refs?,example?}`：page 引用已有页面；title 是本页要解释的内容，chapter 为章节名，note 是连续讲解正文，next 为衔接下一页的短句。diagram 可指定属于该页的图；steps 为动画的闭区间 `[起始下标,结束下标]`，必须对应所选动画图。refs 复用源码引用，可用 `excerptLines`（1–60，默认 24）指定片段长度，并在 note 解释关键行。example 是短命令或数据字符串。

设置 lesson 后，空地址与 #overview 默认进入讲解第一页；#lesson/数字 定位某页，#explore/页面ID 自由查看，#reference/页面ID 打开完整资料。讲解引用已有图和动画。课程要在入门之后继续覆盖子系统、模块和关键实现，不能以少量概览页结束；已有普通页面地址也进入对应讲解，模块下钻仍可继续翻页。进入动画页默认播放，最后一步停止；保留暂停及减少动态效果支持。详情覆盖整个视口，返回后保留原页。未设置 lesson 的项目仍是原有资料模式。所有项目名、课程顺序、讲解与代码选择由分析者从目标项目提取。验收课程时实际顺着翻页阅读，检查前后关系、图与代码对应、动画步骤范围、全屏、自由下钻返回和窄屏。


## 多图型与语义节点

图可设 type 为 architecture（默认）、sequence、swimlane、state、hierarchy、dataflow、comparison。复用统一 SVG 与交互；实际布局必须表达图型含义。sequence 使用参与者、lifelines 和按时间排列的调用/返回；swimlane 使用 bands 划分责任方；state 的边标触发条件；hierarchy 的结构边设置 arrow:false。不要用图型名掩盖普通列表。

节点 shape 为 box（默认）、decision（菱形）、terminal（椭圆）、state（圆角状态）、record（数据卡片）。record 可设 rows 为短文本数组，每行展示一个实际字段或消息摘要；高度至少为 76 + 40 × 行数。样本来源与省略范围写在 caption 和正文。边可设 arrow:false 隐藏箭头以表达归属关系。形状仍保留 target/section、键盘与动画节点 ID，不用另建无法下钻的图片。

讲解页可增加 `media: {file, alt, caption}`，与段落图片使用同一校验和离线嵌入规则。讲解侧显示缩略图，点击打开完整说明；应在该页段落中同时提供对应图片与说明。图中 target 若已属于课程，则进入其正式讲解页，保留 example、图片和连续翻页。
