# 内容格式：图驱动的分层阅读

`content.json` 使用 UTF-8 JSON，`schemaVersion` 为 `2`。顶层包含 `title`、`intro`、`pages` 和 `diagrams`。项目名和所有具体内容从目标项目提取。旧版 modules、chapters、reading 等不再作为页面协议；迁移时重新组织为统一页面树。

## 页面

`pages` 每项为 `{id, title, summary, kind, parent, sections}`。唯一根页 `id="overview"`、`parent=null`；其他页面必须有存在的父页。`kind` 为 `overview`、`subsystem`、`module`、`flow` 或 `code`。标题写当前层概念，不以文件清单代替解释。

`sections` 为 `{id, title, text, data?, refs?}` 数组，在图下方渲染为连续讲解，不作为列表导航。模块页必须包含 `purpose`、`design`、`runtime`、`input`、`output`、`code` 六个段落标识。`data` 是“视图名称 → JSON 值或字符串”的映射；格式、字段含义、生产者、消费者及真实性写在对应 `text` 中。

`refs` 每项为 `{path, symbol?, note?}`。路径是目标仓库 Git 跟踪的相对文本路径；`symbol` 是关键声明的文本，取第一个匹配行。构建器生成行号、24 行关键片段和文件摘要。`note` 解释代码的作用。完整文件从正文打开，不生成源码索引。单文件不超过 2 MB，不引用秘密或用户私密数据。

## 图与下钻

每页至少一张图。图项为 `{id, pages, title, kind, caption, width, height, nodes, edges, bands?, lifelines?}`。`pages` 是应用该图的页面 ID 数组，每个父页必须通过图节点直接进入子页。

节点为 `{id, label, sub?, x, y, w?, h?, tone?, target?, section?, detail?, ref?}`。`target` 直接进入另一页；`section` 定位当前页段落，二者只能选一种。无定位的节点应提供 `detail` 或 `ref` 解释外部角色。`tone` 可为 green、blue、purple、orange；默认尺寸 180×70。节点文字短而完整，细节写在正文。

边为 `{d, label, x, y, dashed?}`，`d` 是 SVG 路径，`x/y` 是标签位置。连线不要穿过无关节点或文字，`caption` 说明阅读方向与线型。职责分解不代表执行顺序。`bands` 为 `{x,y,w,h,label}`，表示系统边界；`lifelines` 为 `{x,y,end}`，用于从上到下的时序图。

节点点击或键盘激活后进入子页或定位讲解。支持缩放和画布内滚动；页面仅保留祖先面包屑和返回上层，不提供内容列表。

补充的实现图可用 `after: "段落ID"` 放在对应解释之后，避免首页或模块顶部连续堆图。每页仍必须有一张未设置 after 的顶部图。

## 证据与覆盖

实际交付必须覆盖全部主要模块与关键运行路径，按全局、子系统、模块、机制、代码逐层组织，小项目可省略子系统层。验证范围写在首页正文，术语就地解释。Git 仓库无提交时显示 `uncommitted`，引用源码仍需被跟踪。网站不依赖网络、框架或 CDN；运行样本的依赖和启动方法写在目标项目 README。

## 可见的输入输出与界面

页面可增加 `exchange: {title, evidence, input, action, text, output}`，放在首张图之后、长篇解释之前。`input` 与 `output` 各为 `{label, format, sample, text}`：label 指明来源或去向，format 写真实类型或明确“摘录”，sample 为 JSON 值或字符串，text 解释字段和对应关系。action 是本次处理动作，text 解释变化，evidence 标明实际捕获、源码推导或教学示意。必须选择一组相互对应的小样本，不能机械取每页第一个 JSON；完整数据在 sections.data 中默认展开。

段落可增加 `media: {file, alt, caption}` 展示界面。file 为目标仓库 Git 跟踪的 PNG/JPEG/WebP 图片相对路径，大小不超过 5 MB；caption 说明来源、版本及是否本次运行。构建器嵌入图片供离线查看。没有真实界面的项目不需要图片。

首页首张图串起具体任务、程序、外部依赖和可观察结果。快速体验也是从图进入的页面，正文使用可复制命令和预期效果。模块的六个 section ID 用于校验，标题和段落应按当前机制自然表达，不要把 ID 翻译成固定问卷。
