# My Skills

可复用的 Agent Skills，用于项目理解、架构分析等开发任务。

## Skills 清单

| Skill | 功能 | 适用场景 |
| --- | --- | --- |
| [project-understanding](skills/project-understanding/SKILL.md) | 分析项目架构、模块职责与设计取舍，生成带交互图解、运行流程、数据样本和源码导航的离线网站 | 接手项目、阅读源码、架构梳理、团队入门 |

### project-understanding

先用具体任务、界面和运行结果说明项目用途，提供可以照做的快速体验。再从目标项目提取项目名、技术栈、模块和调用关系，沿“总架构 → 子架构 → 模块 → 机制与代码”逐层下钻。每页上方是当前层的图，模块图下直接并排展示输入、处理和输出，用短样本解释字段；下方用具体场景讲解设计、运行和源码，避免重复问卷式标题；通过图节点与可收起的树状侧栏导航；侧栏包含架构层级和真实项目文件，可快速搜索文件并与图解联动。

- **架构图解**：分层架构、模块结构、调用时序、数据流及状态变化，支持点击节点查看细节。
- **设计思路**：解释模块解决的问题、具体机制及其取舍。
- **代码讲解**：在对应模块中阅读关键片段，再打开带行号的完整源码，支持浅色语法高亮、引用入口行标记、行号跳转、前后匹配查找、换行、复制和本地编辑器定位。
- **运行样本**：展示关键边界的中间数据，区分实际捕获与模拟示例。
- **LLM 上下文**：针对 AI 项目，展示系统指令、工具声明、历史消息及模型请求的组成。

默认生成 `architecture-guide/dist/index.html`，可直接用浏览器离线打开。

## 安装

### Codex

克隆仓库：

```sh
git clone https://github.com/waruqi/my-skills.git
cd my-skills
```

安装所需 skill：

```sh
skill_source="$PWD/skills/project-understanding"
skill_target="${CODEX_HOME:-$HOME/.codex}/skills/project-understanding"
mkdir -p "$(dirname "$skill_target")"
if [ -e "$skill_target" ] || [ -L "$skill_target" ]; then
  printf '已存在，未覆盖：%s\n' "$skill_target"
else
  cp -R "$skill_source" "$skill_target"
fi
```

安装后在下一轮调用。其他支持 `SKILL.md` 的工具，可将完整 skill 文件夹放到对应的技能目录。

### 不安装，直接使用

在目标项目中让 Agent 读取克隆目录下的 `skills/project-understanding/SKILL.md`，按其中的流程执行即可。

## 用法

在要分析的项目中调用：

```text
$project-understanding 分析当前项目，生成中文架构学习网站。
包含可点击架构图、完整运行流程、中间数据、源码导航和设计取舍。
```

也可以指定重点：

```text
$project-understanding 重点解释一次请求从入口到存储的完整过程，
展示每一步的数据格式、错误处理和对应源码。
```

构建网站需要 Python 3.9+ 和 Git；运行样本需要目标项目自身的依赖。项目分析由 Agent 完成，构建脚本负责校验与打包。

### 更新已有网站

先让 Agent 根据代码变更更新分析内容和样本。当前模板使用分层页面格式（schemaVersion 2）；旧版内容需让 Agent 重新组织为可从图逐层进入的页面。随后在目标项目根目录运行以下命令，将 `/path/to/skill` 替换为 `project-understanding` 的安装目录：

```sh
python3 /path/to/skill/scripts/build.py \
  --root . \
  --content architecture-guide/content.json \
  --out architecture-guide/dist
```

## Skill 目录结构

```text
skills/project-understanding/
├── SKILL.md             # 使用说明与执行流程
├── agents/openai.yaml   # Codex 技能信息
├── references/          # 内容格式与图形协议
├── scripts/build.py     # 网站构建器
└── assets/              # 网页模板与交互图形渲染器
```
