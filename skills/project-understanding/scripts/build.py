#!/usr/bin/env python3
"""校验分层图解和源码证据，生成离线学习网站。"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess


def build(root, content_path, out):
    root = root.resolve()
    content = json.loads(content_path.read_text())
    if content.get("schemaVersion") != 2:
        raise ValueError("需要 schemaVersion=2；请按图驱动的页面树重新组织内容")
    pages = {p["id"]: p for p in content["pages"]}
    if len(pages) != len(content["pages"]) or "overview" not in pages:
        raise ValueError("页面 ID 必须唯一且包含 overview")
    if pages["overview"]["parent"] is not None:
        raise ValueError("overview 必须是根页面")
    for page in pages.values():
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", page["id"]):
            raise ValueError(f"无效页面 ID: {page['id']}")
        if page["kind"] not in ("overview", "subsystem", "module", "flow", "code"):
            raise ValueError(f"无效页面类型: {page['id']}")
        ancestors = {page["id"]}
        current = page
        while current["id"] != "overview":
            parent = current.get("parent")
            if parent not in pages or parent in ancestors:
                raise ValueError(f"无效父级或循环: {page['id']}")
            ancestors.add(parent)
            current = pages[parent]
        ids = {s["id"] for s in page["sections"]}
        if not ids or len(ids) != len(page["sections"]):
            raise ValueError(f"正文不能为空，段落 ID 必须唯一: {page['id']}")
        if page["kind"] == "module" and not {"purpose", "design", "runtime", "input", "output", "code"} <= ids:
            raise ValueError(f"模块缺少职责、设计、运行、输入、输出或代码: {page['id']}")
        exchange = page.get("exchange")
        if exchange:
            for side in ("input", "output"):
                if not {"label", "format", "sample", "text"} <= exchange.get(side, {}).keys():
                    raise ValueError(f"数据流缺少样本或说明: {page['id']}/{side}")
            if not {"title", "action", "text", "evidence"} <= exchange.keys():
                raise ValueError(f"数据流缺少处理过程或证据: {page['id']}")
    coverage = set()
    links = {id: set() for id in pages}
    diagram_ids = set()
    for diagram in content["diagrams"]:
        if diagram["id"] in diagram_ids or not diagram["nodes"]:
            raise ValueError("图 ID 重复或没有节点")
        diagram_ids.add(diagram["id"])
        if not diagram["pages"] or any(id not in pages for id in diagram["pages"]):
            raise ValueError(f"图引用了无效页面: {diagram['id']}")
        coverage.update(diagram["pages"])
        if diagram.get("after") and any(diagram["after"] not in {s["id"] for s in pages[id]["sections"]} for id in diagram["pages"]):
            raise ValueError(f"图的正文位置不存在: {diagram['id']}")
        if len({n["id"] for n in diagram["nodes"]}) != len(diagram["nodes"]):
            raise ValueError(f"图节点 ID 重复: {diagram['id']}")
        for node in diagram["nodes"]:
            if node.get("target") and node.get("section"):
                raise ValueError("节点只能选择进入子页或定位正文之一")
            if node.get("target"):
                if node["target"] not in pages:
                    raise ValueError(f"节点目标不存在: {node['target']}")
                for id in diagram["pages"]:
                    links[id].add(node["target"])
            if node.get("section"):
                for id in diagram["pages"]:
                    if node["section"] not in {s["id"] for s in pages[id]["sections"]}:
                        raise ValueError(f"正文定位不存在: {id}/{node['section']}")
    if coverage != set(pages):
        raise ValueError(f"每页必须有图，缺少: {set(pages) - coverage}")
    top_coverage = {id for diagram in content["diagrams"] if not diagram.get("after") for id in diagram["pages"]}
    if top_coverage != set(pages):
        raise ValueError(f"每页必须有顶部图，缺少: {set(pages) - top_coverage}")
    for page in pages.values():
        if page["parent"] is not None and page["id"] not in links[page["parent"]]:
            raise ValueError(f"父页的图无法进入子页: {page['id']}")
    tracked = set(subprocess.check_output(["git", "ls-files", "-z"], cwd=root).decode().split("\0"))
    sources = {}

    def resolve(value):
        if isinstance(value, dict):
            if "media" in value:
                media = value["media"]
                path = media["file"]
                target = (root / path).resolve()
                mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(target.suffix.lower())
                if path not in tracked or not target.is_relative_to(root) or not mime:
                    raise ValueError(f"图片必须是仓库内 Git 跟踪的位图: {path}")
                raw = target.read_bytes()
                if len(raw) > 5_000_000 or not media.get("alt") or not media.get("caption"):
                    raise ValueError(f"图片过大或缺少说明: {path}")
                media["src"] = f"data:{mime};base64," + base64.b64encode(raw).decode()
            if "path" in value:
                path = value["path"]
                target = (root / path).resolve()
                if path not in tracked or not target.is_relative_to(root):
                    raise ValueError(f"源码必须是仓库内 Git 跟踪文件: {path}")
                if path not in sources:
                    raw = target.read_bytes()
                    if len(raw) > 2_000_000:
                        raise ValueError(f"引用文件超过 2 MB: {path}")
                    sources[path] = {"text": raw.decode("utf-8"), "sha256": hashlib.sha256(raw).hexdigest()}
                lines = sources[path]["text"].splitlines()
                if value.get("symbol"):
                    matches = [i for i, line in enumerate(lines) if value["symbol"] in line]
                else:
                    matches = [i for i, line in enumerate(lines) if re.match(r"^(?:export )?(?:async )?(?:function|class|interface|type|const) ", line)] or ([0] if lines else [])
                if not matches:
                    raise ValueError(f"源码声明未找到: {path} {value.get('symbol')}")
                start = matches[0]
                value.update(line=start + 1, excerpt="\n".join(lines[start:start + 24]))
            for key, child in value.items():
                if key not in ("data", "excerpt", "sample", "media"):
                    resolve(child)
        elif isinstance(value, list):
            for child in value:
                resolve(child)

    resolve(content)
    revision = subprocess.run(["git", "rev-parse", "--verify", "HEAD"], cwd=root, capture_output=True, text=True)
    content.update(sources=sources, revision=revision.stdout.strip() if revision.returncode == 0 else "uncommitted")
    out.mkdir(parents=True, exist_ok=True)
    assets = Path(__file__).resolve().parent.parent / "assets"
    for name in ("index.html", "style.css", "app.js", "visuals.js"):
        shutil.copyfile(assets / name, out / name)
    encoded = json.dumps(content, ensure_ascii=False).replace("</", "<\\/")
    (out / "data.js").write_text("window.GUIDE = " + encoded + ";\n")
    print(f"已构建 {len(pages)} 页、{len(content['diagrams'])} 张图、{len(sources)} 份源码: {out / 'index.html'}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, required=True)
    parser.add_argument("--content", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    build(args.root, args.content, args.out)
