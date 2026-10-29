#!/usr/bin/env python3
"""Validate an authored architecture guide and package a local source-linked site."""

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess


def build(root, content_path, out):
    root = root.resolve()
    content = json.loads(content_path.read_text())
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0"))
    ids = {"overview", "graph", "sources", "glossary", "about"}
    pages = content["modules"] + content["chapters"] + content["flows"]
    if content.get("comparison"):
        pages = pages + [content["comparison"]]
    for item in pages:
        if item["id"] in ids:
            raise ValueError(f"Duplicate/reserved id: {item['id']}")
        ids.add(item["id"])
    for item in content["reading"]:
        if item["id"] not in ids:
            raise ValueError(f"Unknown reading destination: {item['id']}")
    diagram_ids = set()
    for diagram in content.get("diagrams", []):
        if diagram["id"] in diagram_ids:
            raise ValueError(f"Duplicate diagram id: {diagram['id']}")
        diagram_ids.add(diagram["id"])
        if not diagram["pages"] or any(page not in ids for page in diagram["pages"]):
            raise ValueError(f"Unknown diagram page: {diagram['id']}")
        node_ids = set()
        for node in diagram["nodes"]:
            if node["id"] in node_ids:
                raise ValueError(f"Duplicate diagram node: {node['id']}")
            node_ids.add(node["id"])
            if node.get("target") and node["target"] not in ids:
                raise ValueError(f"Unknown node destination: {node['target']}")
            if "step" in node:
                for page in diagram["pages"]:
                    flow = next((f for f in content["flows"] if f["id"] == page), None)
                    if flow is None or not 0 <= node["step"] < len(flow["steps"]):
                        raise ValueError(f"Invalid diagram step: {diagram['id']}/{node['id']}")
    sources = {}

    def resolve_refs(value):
        if isinstance(value, dict):
            if "path" in value:
                path = value["path"]
                target = (root / path).resolve()
                if path not in tracked or not target.is_relative_to(root):
                    raise ValueError(f"Source must be tracked inside repository: {path}")
                if path not in sources:
                    raw = target.read_bytes()
                    if len(raw) > 2_000_000:
                        raise ValueError(f"Source exceeds 2 MB: {path}")
                    sources[path] = {"text": raw.decode("utf-8"), "sha256": hashlib.sha256(raw).hexdigest()}
                symbol = value.get("symbol")
                lines = sources[path]["text"].splitlines()
                if symbol:
                    matches = [i + 1 for i, line in enumerate(lines) if symbol in line]
                    if not matches:
                        raise ValueError(f"Missing symbol {symbol!r} in {path}")
                    value["line"] = matches[0]
                else:
                    value["line"] = 1
            for key, child in value.items():
                if key not in ("data", "code"):
                    resolve_refs(child)
        elif isinstance(value, list):
            for child in value:
                resolve_refs(child)

    resolve_refs(content)
    packages = content.get("packages")
    if packages is None:
        packages = [{"id": m["id"], "name": m["id"], "dependencies": [], "devDependencies": []}
                    for m in content["modules"]]
        content["graphSummary"] = "此页仅展示模块清单，尚未提供已验证的依赖关系；没有连线不表示模块相互独立。"
    module_ids = {m["id"] for m in content["modules"]}
    names = {p["name"] for p in packages}
    if len(names) != len(packages) or len({p["id"] for p in packages}) != len(packages):
        raise ValueError("Dependency inventory ids and names must be unique")
    for package in packages:
        if package["id"] not in module_ids:
            raise ValueError(f"Dependency node needs a module page: {package['id']}")
        for field in ("dependencies", "devDependencies"):
            package.setdefault(field, [])
            if any(name not in names for name in package[field]):
                raise ValueError(f"Unknown internal dependency in {package['id']}")
    revision_result = subprocess.run(["git", "rev-parse", "--verify", "HEAD"], cwd=root,
                                     capture_output=True, text=True)
    revision = revision_result.stdout.strip() if revision_result.returncode == 0 else "uncommitted"
    content.update({"sources": sources, "packages": packages, "revision": revision})
    out.mkdir(parents=True, exist_ok=True)
    assets = Path(__file__).resolve().parent.parent / "assets"
    for name in ("index.html", "style.css", "app.js", "visuals.js"):
        shutil.copyfile(assets / name, out / name)
    encoded = json.dumps(content, ensure_ascii=False).replace("</", "<\\/")
    (out / "data.js").write_text("window.GUIDE = " + encoded + ";\n")
    print(f"Built {len(content['modules'])} modules, {len(content['chapters'])} chapters, "
          f"{len(content['flows'])} flows, {len(sources)} source snapshots: {out / 'index.html'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--content", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    build(args.root, args.content, args.out)
