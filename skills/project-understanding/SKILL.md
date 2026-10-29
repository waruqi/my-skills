---
name: project-understanding
description: Analyze a repository and generate a local, layered architecture learning website with source evidence, execution traces, intermediate data, and design tradeoffs. Use for project onboarding or understanding an unfamiliar codebase.
---

# Project understanding

Turn the current repository into an explorable explanation in the user's language. Default output: `architecture-guide/`. Keep the application unchanged. The result must explain behavior, not merely list directories.

Keep reusable instructions, templates and the builder in the skill's source repository; keep generated content, runtime captures and the website in the analyzed project. When improving this skill, update its canonical source rather than creating a second skill copy inside the output directory. Record the source location and exact regeneration command in the target project's README.

## Investigate before writing

Extract project identity and metadata from the repository being analyzed: its README, manifests, public entry points, build configuration and source. Determine the display name, purpose, languages, frameworks, modules, directories, entry points and verified relationships. Do not use the skill repository's name or a previous project's values. Resolve conflicting names from evidence; if no product name exists, use the target directory name as an explicitly stated fallback.

Write this extracted information into the target project's `content.json` (`title`, `subtitle`, `intro`, `modules`, dependency inventory and diagrams). Templates must read project-specific values from that data. Keep skill instructions, assets, scripts and examples free of concrete analyzed-project names, paths, logos, revisions and topology. A generic UI label is allowed; a project's identity must never be hardcoded in the renderer.

Read repository instructions, manifests, public entry points and the implementation of the representative paths. Inventory every workspace, including packages missing from the root README. Distinguish production entry points, optional integrations, experimental implementations and plans. A dependency is not evidence that a runtime calls a module.

Follow one concrete user action through entry, orchestration, domain logic, external boundary, persistence and presentation. For each boundary record the producer, consumer, exact type, sample and source symbol. Read relevant files completely in bounded chunks; a truncated tool response does not count as a complete read. Expand into the other major runtime paths. Do not imply every file was audited.

For each module explain: the problem; a concrete example; the mechanism; why it is needed; its cost; where to read next. Distinguish documented rationale from your inference. Include ownership, lifecycle, error behavior and extension points when relevant. Use actual paths and symbols, never guessed line numbers.

For an AI application, show the persisted record, in-memory message, normalized model context, provider request and response events separately. Explain system instructions, tool declarations, call/result pairing, filtering, summaries, token pressure and what never reaches the model. For other projects choose equivalent boundary representations (HTTP request, job, database row, render model).

Prefer an offline executable trace with the project's fake adapters and temporary fixtures. Capture snapshots at actual boundaries; mock responses must be labeled. Capture provider serialization with an injected transport or pre-send callback and stop before real I/O. Never claim a synthetic trace was sent to a service. No credentials, real user sessions or paid requests are needed. Label illustrative data and omissions if execution is unavailable.

Keep all analyzed project names, paths, revisions, module maps and case-study conclusions in the target project output, never in this reusable skill. Derive the architecture afresh for each repository. The workflow applies to libraries, services, frontends, CLIs and mixed-language systems; AI-specific context views are conditional on the project actually using an LLM.

## Build the learning site

Read [the content format](references/content-format.md). Populate the language-neutral dependency inventory from inspected manifests, imports or build definitions; do not assume a language, package manager or directory layout. Copy `assets/` to the output directory; write `content.json` with the actual analysis. The reusable renderer provides module navigation, dependency graph, source reader, execution steps, search and local reading progress. Adapt it when the project needs different concepts.

Run:

```sh
python3 <skill-directory>/scripts/build.py --root <repository> --content <output>/content.json --out <output>/dist
```

The builder validates references and embeds explicitly cited source snapshots with SHA-256 and repository revision. It does not analyze the project or refresh prose automatically. After code changes, re-analyze affected claims before rebuilding. Do not copy a previous repository's explanations into the next one.

Keep the website offline-capable: no CDN, no required service, no publication unless requested. Explain overview → modules → trace/data → rationale → source. Graph arrows must say whether they represent dependencies, calls or data movement. Mark statements based only on documentation and future work.

Lead with visual explanations, not a directory list or a page of cards. Put a layered system diagram at the top of the overview and an internal responsibility or call diagram at the top of each major module. Show a representative execution as a sequence/swimlane diagram, and data transformations as before/after or accumulation diagrams. Use branch/state diagrams where recovery or state changes matter. Choose diagram types according to the actual architecture; do not invent sequential arrows between unrelated responsibilities.

Use the offline SVG renderer in `assets/visuals.js` with the `diagrams` schema in [the content format](references/content-format.md). Author project-specific nodes, boundaries and labeled edges from evidence. Diagram nodes should expose the explanation and, where applicable, source or runtime-step links. Preserve the existing narrative and raw samples as deeper layers. Support zoom and horizontal scrolling on narrow screens. Do not count a list with arrows or a dependency graph alone as a complete visual explanation.

## Verify and hand off

Run the builder, syntax checks and repository-required checks. Verify source references, graph nodes, navigation, all trace steps, available data-view switching and narrow layouts; use browser QA when available. Report unavailable checks honestly. Re-read all authored files. Do not use a full unrelated test suite as a substitute for checking the website.

For visual acceptance, inspect rendered diagrams at desktop and mobile widths: labels must fit nodes, arrows must have a clear meaning and direction, modules must remain distinct from runtime stages, and clicks/keyboard activation must reveal the expected explanation, sample or source. Check these behaviors on the copied output, not only on the template. A future invocation should generate diagrams as part of the initial deliverable, without requiring a follow-up request.

Provide the local entry, regeneration command, evidence limits and skill location. A single future invocation such as `$project-understanding 分析当前项目并生成架构学习网站` asks the agent to repeat the analysis and generation; it is not a claim that static dependency scanning can infer the entire architecture.
