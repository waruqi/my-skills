# My Skills

个人 Agent Skills 汇总仓库。每个 skill 独立放在 `skills/<name>/`，集中维护指令、参考资料、脚本和模板，供不同项目复用。

**维护约定：skill 源文件统一在本仓库更新；生成的网站、分析内容和运行样本保留在被分析项目中。** 本机仓库位置：`/Users/ruki/projects/personal/my-skills`。

## Skills 清单

| Skill | 功能 | 适用场景 | 输出 |
| --- | --- | --- | --- |
| [project-understanding](skills/project-understanding/SKILL.md) | 逐层分析项目架构、模块职责、设计取舍与源码；生成可交互架构图、时序图、数据变化图和源码导航；AI 项目进一步展示 LLM 上下文及 provider 请求 | 接手陌生项目、源码学习、架构梳理、团队入门 | 目标项目的 `architecture-guide/` 离线网站、分析内容和可复现样本 |

### project-understanding

- 从系统全景进入模块内部，解释“解决什么问题、为什么这样设计、代价是什么”。
- 图解优先：分层架构、模块结构、运行时序、数据流与必要的状态/恢复图；节点可进入解释、步骤或源码。
- 源码快照带行号及 SHA-256，支持查找、跳转；网站无需前端依赖或 CDN。
- 可用时执行离线样本，分别标明真实执行、模拟模型回复、未发送请求与教学示意。
- 不内置任何被分析项目的名称、路径、架构或案例；每次从目标项目重新建立证据。
- AI 从目标项目的 README、清单、构建配置和源码提取项目名、技术栈、模块和关系，写入该项目的 `content.json`；assets 仅从数据渲染，不写死项目信息。

“一次调用生成”由 Agent 完成分析、编写和构建；`build.py` 只验证并打包已有内容，不会自动推导设计原因。构建器需要 Python 3.9+、Git 和 Git 仓库；运行项目样本时还需要目标项目自身的依赖。依赖图使用分析时填写的语言无关清单，不假定包管理器或目录布局。

## 安装与使用

### 不安装：直接指定 skill

在目标项目中对 Agent 说：

```text
读取 /Users/ruki/projects/personal/my-skills/skills/project-understanding/SKILL.md，
按其中的流程分析当前项目，生成中文架构学习网站。
需要直观架构图、完整运行流程、中间数据、源码位置和设计原因。
```

### 安装到 Codex

在本仓库根目录执行。默认技能目录为 `$CODEX_HOME/skills`，未设置时为 `~/.codex/skills`。安装整个 skill 文件夹，不能只复制 `SKILL.md`。

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

安装后在下一轮使用：

```text
$project-understanding 分析当前项目，生成中文架构学习网站，
包含可点击架构图、时序图、中间数据、源码导航和设计取舍。
```

经常维护 skill 时，可以在上述安装步骤中将 `cp -R` 换成 `ln -s`，将安装目录链接到本仓库。链接会直接使用仓库文件；复制安装则需要在源文件更新后同步安装副本。目标位置已存在时先确认其来源，不要覆盖其他 skill 或自己的修改。

其他支持 `SKILL.md` 的工具，可以直接读取文件，或把完整 skill 目录安装到该工具规定的位置；具体发现机制以对应工具为准。

### 重新生成已有网站

在被分析项目根目录执行：

```sh
python3 /Users/ruki/projects/personal/my-skills/skills/project-understanding/scripts/build.py \
  --root . \
  --content architecture-guide/content.json \
  --out architecture-guide/dist
```

用浏览器打开 `architecture-guide/dist/index.html`。代码变化后先让 Agent 更新分析内容与样本，再运行构建器；只重新打包不会自动更新解释。

## 仓库结构

```text
my-skills/
├── README.md
├── AGENTS.md
└── skills/
    └── project-understanding/
        ├── SKILL.md             # 使用条件和执行方法
        ├── agents/openai.yaml   # Codex 界面元数据
        ├── references/          # 内容格式与图形协议
        ├── scripts/build.py     # 校验引用并生成网站
        └── assets/              # 离线网页与 SVG 渲染器
```

## 新增与维护

1. 新建 `skills/<小写连字符名称>/SKILL.md`，包含 YAML `name` 和 `description`。
2. 说明适用场景、执行方法、证据边界和输出位置；按需附脚本、参考资料与模板。
3. 同步更新本 README 的技能清单、功能说明与调用示例。
4. 验证相对引用和脚本，在实际目标项目检查生成结果。已安装副本需要同步；链接安装直接使用源文件。

本仓库只保存可复用 skill。具体项目的分析内容、运行样本、源码快照与生成网站均留在对应项目，不能回填到通用 skill 中。
