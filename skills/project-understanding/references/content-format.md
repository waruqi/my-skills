# Content format

`content.json` is UTF-8 JSON with:

- `title`, `subtitle`, `intro`: project identity and explanation extracted from the target repository, not from the skill or template. The renderer reads these fields for the browser title and project headers.
- `modules`: `{id, title, summary, problem, example, solution, tradeoff, status, parts, refs}`. `parts` are `{title, text, path, symbol?}`. `refs` are `{path, symbol?, note?}`. Source paths are repository-relative tracked text files; symbols are exact nonempty substrings. The builder resolves the first matching line. Prefer distinctive declaration strings.
- `chapters`: `{id, title, summary, sections, refs}`. Sections are `{title, text, code?}`. `code` is an optional JSON value or string. Text is plain text, not HTML.
- `flows`: `{id, title, summary, steps}`. Steps are `{title, text, why, data, refs}`. `data` maps a human-readable view name to a JSON value or string. Every flow must state whether it is simulated, captured locally or captured at an external service.
- `glossary`: `{term, meaning}` records.
- `reading`: ordered `{id, title, text}` links to module or chapter IDs.
- `scope`: explicit limitations and snapshot assumptions, as strings.
- `lanes`: overview call paths, each `{title, nodes: [{id, text, via?}]}`; IDs link to pages. `overviewNote` explains the main architectural boundary.
- `graphPositions`: optional package-ID-to-`[x,y]` map for a curated graph; absent, nodes use a simple grid.
- `comparison`: optional `{id, title, summary, note, rounds: [{label, note, data}]}` for a side-by-side boundary comparison. All rounds share the same data-view names. Do not confuse JSON character counts with token counts.

IDs must be globally unique. `overview`, `graph`, `sources`, `glossary`, `about` are reserved. Cross-links in data are not interpreted as markup. The renderer escapes all prose and source. The graph uses the explicitly authored `packages` inventory described below; no language or directory convention is assumed. Dependency claims must be derived from the target repository.

Put captured samples directly in flow data for the most instructive boundaries; keep larger raw traces as separate downloads.

No confidential files should be cited. The generator permits only Git-tracked UTF-8 text under the repository, and caps each cited file at 2 MB. Source snapshots are for navigation, not proof that the entire file was audited. Record the actual evidence depth in `scope`.

## Visual diagrams

`diagrams` is an array of authored SVG specifications, rendered before prose on the selected pages. Each diagram has `id`, `pages` (existing page IDs), `title`, `kind`, `caption`, `width`, `height`, `nodes` and `edges`.

- Node: `{id, label, sub, x, y, w?, h?, tone?, detail?, target?, step?, ref?}`. Defaults: 180 × 70. `tone` is green, blue, purple or orange. `target` links a page. `step` selects a zero-based step on the current flow page; only use it on diagrams attached to that flow. `ref` is the standard `{path, symbol?}` source reference resolved by the builder. Use short labels; put full explanations in `detail`.
- Edge: `{d, label, x, y, dashed?}`. `d` is an SVG path; `(x,y)` places the label. Author endpoints to touch node boundaries, route around labels, and explain the meaning of solid/dashed arrows in `caption`. A responsibility map can use unlabeled spokes if the caption explicitly says they are decomposition, not time order.
- Optional `bands`: `{x,y,w,h,label}` for system boundaries, layers or grouped columns.
- Optional `lifelines`: `{x,y,end}` for sequence participants; time flows downward from `y` to `end`.

Keep the SVG canvas around 1000 units wide and labels around 12–16 Chinese characters per node. Inspect actual rendering; character count alone does not prove fit. The renderer supplies node selection, keyboard activation, source/step links and zoom. Diagram content belongs in the project JSON, so the reusable template contains no project-specific topology.


## Dependency inventory

`packages` is an optional language-neutral inventory, retaining this field name for the renderer. Each item is `{id, name, dependencies: [], devDependencies: []}`. It can represent a service, library, build target or module in any language. `id` must match a module page ID; names must be unique; dependency values refer to other inventory names. Only include internal nodes whose relationships have evidence; cite the corresponding manifests, import declarations or build definitions in module references. External libraries can be described in prose.

Set `graphSummary` to explain the evidence source and what each arrow means. If the inventory is omitted, the builder shows module nodes without edges and labels the dependencies as unspecified. It never infers dependencies from sibling directories. A Git repository without commits uses the revision label `uncommitted`; source files must still be explicitly tracked.
