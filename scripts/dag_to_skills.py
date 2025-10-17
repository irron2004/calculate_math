
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dag_to_skills.py
----------------
Convert a Markdown DAG spec (docs/dag.md) into skills.json compatible with the app.

Supported inputs inside the Markdown:
  1) Mermaid blocks (```mermaid ... ```):
     - Nodes: A[라벨]  or  A((라벨))  or  A{{라벨}}
     - Edges: A --> B  (treated as "requires" by default)
              A -.-> B or A -- text --> B (still "requires" unless "enables" keyword in text)
     - If the edge text contains "[enables]" or "enables", it's treated as type="enables".

  2) Nodes table blocks (```csv nodes``` or ```json nodes``` or ```yaml nodes```):
     - CSV header (required columns): id,label,tier,kind
       Optional columns: lens,keywords,micro_skills,misconceptions,boss,xp_per_try,xp_per_correct,xp_to_level
       lens/keywords/micro_skills/misconceptions are semicolon-separated lists.

  3) Headings "## Tier N" set current tier for following Mermaid nodes that do not have tiers.

Defaults:
  - Any node discovered via Mermaid without a record in nodes table will be given:
    kind="concept", tier=current_tier or 1, xp_per_try/per_correct from tier defaults
    lens=["transform"], xp_to_level by tier defaults.

Validation:
  - Acyclic graph (toposort), missing node references.
  - Writes warnings for inferred nodes and edges.

Usage:
  python dag_to_skills.py --in docs/dag.md --out app/data/skills.json [--schema skills.schema.json]
"""
import re, json, argparse, sys, csv, io, os, math
from collections import defaultdict, deque
from pathlib import Path

MIN_NODE_THRESHOLD = 10


def strip_json_comments(payload: str) -> str:
    """Remove // and /* */ style comments from JSON-like content."""

    without_block = re.sub(r"/\*.*?\*/", "", payload, flags=re.S)
    return re.sub(r"//.*?$", "", without_block, flags=re.M)


def load_existing_payload(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None

TIER_DEFAULTS = {
    1: {"xp_per_try":4, "xp_per_correct":8, "xp_to_level":[0,40,120,240]},
    2: {"xp_per_try":6, "xp_per_correct":12, "xp_to_level":[0,60,180,360]},
    3: {"xp_per_try":6, "xp_per_correct":12, "xp_to_level":[0,60,180,360]},
    4: {"xp_per_try":7, "xp_per_correct":14, "xp_to_level":[0,70,210,420]},
    5: {"xp_per_try":8, "xp_per_correct":16, "xp_to_level":[0,80,240,480]}
}
PALETTE = {
    "difference":"#E4572E","accumulation":"#17BEBB","ratio":"#8D99AE",
    "scale":"#2E86AB","random":"#F29E4C","transform":"#6C5CE7","vector":"#2D6A4F"
}

def slugify(s: str) -> str:
    s = s.strip()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^A-Za-z0-9_.\-가-힣_]", "", s)
    return s.lower()

def parse_codeblocks(md: str):
    # returns list of (lang, title, content)
    blocks = []
    # ```lang [title]\ncontent\n```
    pattern = re.compile(r"```(\w+)(?:\s+(\w+))?\n(.*?)```", re.S)
    for m in pattern.finditer(md):
        lang, title, content = m.group(1), (m.group(2) or "").lower(), m.group(3)
        blocks.append((lang.lower(), title, content))
    return blocks

def parse_headings_tiers(md: str):
    tiers = []
    tier_map = {}
    current_tier = 1
    for line in md.splitlines():
        m = re.match(r"^#{1,6}\s*(?:Tier|티어)\s*(\d+)", line.strip(), re.I)
        if m:
            current_tier = int(m.group(1))
        tiers.append(current_tier)
    return tiers  # not used directly; we track while parsing sequentially if needed

def parse_mermaid(content: str, current_tier: int, node_acc, edge_acc, inferred_nodes):
    # Example lines:  A[라벨] --> B[라벨]
    # capture nodes and edges
    node_def = re.compile(r"\b([A-Za-z0-9_]+)\s*(?:\[\s*([^\]]+)\s*\]|\(\(\s*([^)]+)\s*\)\)|\{\{\s*([^}]+)\s*\}\})")
    edge_def = re.compile(r"\b([A-Za-z0-9_]+)\s*[-.]*-+>\s*([A-Za-z0-9_]+)(?:\s*:?([^\n]+))?")
    alias_to_id = {}
    # collect node labels
    for m in node_def.finditer(content):
        alias = m.group(1)
        label = m.group(2) or m.group(3) or m.group(4) or alias
        nid = slugify(label)  # id from label
        alias_to_id[alias] = nid
        if nid not in node_acc:
            node_acc[nid] = {
                "id": nid, "label": label, "tier": current_tier,
                "kind": "concept", "requires": None,
                **TIER_DEFAULTS.get(current_tier, TIER_DEFAULTS[1]),
                "lens": ["transform"], "keywords": [], "micro_skills": [],
                "misconceptions": [], "lrc_min": None
            }
            inferred_nodes.add(nid)
    # edges
    for m in edge_def.finditer(content):
        a, b, txt = m.group(1), m.group(2), (m.group(3) or "").strip()
        sa = alias_to_id.get(a, slugify(a)); sb = alias_to_id.get(b, slugify(b))
        etype = "requires"
        if "enable" in txt.lower():
            etype = "enables"
        edge_acc.append({"from": sa, "to": sb, "type": etype})

def parse_nodes_table(lang: str, content: str, node_acc):
    if lang == "csv":
        reader = csv.DictReader(io.StringIO(content.strip()))
        for row in reader:
            nid = row["id"].strip()
            node_acc[nid] = build_node_from_row(row)
    elif lang == "json":
        data = json.loads(content)
        if isinstance(data, list):
            for row in data:
                nid = row["id"]
                node_acc[nid] = build_node_from_row(row)
        else:
            raise ValueError("json nodes block must be a list")
    elif lang in ("yaml","yml"):
        try:
            import yaml
        except ImportError:
            raise SystemExit("pyyaml not installed. pip install pyyaml")
        data = yaml.safe_load(content)
        if isinstance(data, list):
            for row in data:
                nid = row["id"]
                node_acc[nid] = build_node_from_row(row)
        else:
            raise ValueError("yaml nodes block must be a list")
    else:
        # ignore
        pass

def split_list_field(val):
    if val is None:
        return []
    if isinstance(val, list):
        return val
    parts = [p.strip() for p in re.split(r"[;,|]", str(val)) if p.strip()]
    return parts

def build_node_from_row(row):
    tier = int(row.get("tier", 1))
    lens = split_list_field(row.get("lens"))
    keywords = split_list_field(row.get("keywords"))
    micro = split_list_field(row.get("micro_skills"))
    miscon = split_list_field(row.get("misconceptions"))
    xp_try = int(row.get("xp_per_try", TIER_DEFAULTS.get(tier, TIER_DEFAULTS[1])["xp_per_try"]))
    xp_cor = int(row.get("xp_per_correct", TIER_DEFAULTS.get(tier, TIER_DEFAULTS[1])["xp_per_correct"]))
    xp_to_level = row.get("xp_to_level") or TIER_DEFAULTS.get(tier, TIER_DEFAULTS[1])["xp_to_level"]
    if isinstance(xp_to_level, str):
        xp_to_level = [int(x) for x in re.split(r"[,\s]+", xp_to_level) if x]
    requires = row.get("requires")
    if isinstance(requires, str):
        requires = {"all_of": split_list_field(requires), "any_of": [], "min_level": int(row.get("min_level", 1))}
    node = {
        "id": row["id"],
        "label": row.get("label", row["id"]),
        "tier": tier,
        "kind": row.get("kind", "concept"),
        "requires": requires,
        "boss": row.get("boss"),
        "xp_per_try": xp_try,
        "xp_per_correct": xp_cor,
        "xp_to_level": xp_to_level,
        "lens": lens or ["transform"],
        "keywords": keywords,
        "micro_skills": micro,
        "misconceptions": miscon,
        "lrc_min": row.get("lrc_min"),
        "i18n": row.get("i18n")
    }
    return node

def toposort(nodes, edges):
    indeg = defaultdict(int)
    adj = defaultdict(list)
    node_ids = set(nodes.keys())
    for e in edges:
        if e["type"] != "requires":
            continue
        u, v = e["from"], e["to"]
        if u not in node_ids or v not in node_ids:
            continue
        adj[u].append(v)
        indeg[v] += 1
        node_ids.add(u); node_ids.add(v)
    q = deque([n for n in nodes if indeg[n]==0])
    out = []
    while q:
        u = q.popleft()
        out.append(u)
        for w in adj[u]:
            indeg[w] -= 1
            if indeg[w]==0:
                q.append(w)
    if len(out) != len(nodes):
        return None
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--schema", dest="schema", default=None)
    args = ap.parse_args()

    out_path = Path(args.out)
    existing_payload = load_existing_payload(out_path)

    with open(args.inp, "r", encoding="utf-8") as f:
        md = f.read()

    blocks = parse_codeblocks(md)

    # allow direct JSON/YAML blocks that already contain full graph specification
    for lang, title, content in blocks:
        if title == "nodes":
            continue
        graph_data = None
        if lang == "json":
            try:
                graph_data = json.loads(strip_json_comments(content))
            except json.JSONDecodeError:
                continue
        elif lang in ("yaml", "yml"):
            try:
                import yaml
            except ImportError:
                graph_data = None
            else:
                graph_data = yaml.safe_load(content)
        if isinstance(graph_data, dict) and "nodes" in graph_data:
            node_count = len(graph_data.get("nodes") or [])
            if node_count < MIN_NODE_THRESHOLD:
                continue
            if "edges" not in graph_data:
                graph_data["edges"] = []
            if "palette" not in graph_data:
                graph_data["palette"] = PALETTE
            if "version" not in graph_data:
                graph_data["version"] = "auto-from-md"
            with open(args.out, "w", encoding="utf-8") as f:
                json.dump(graph_data, f, ensure_ascii=False, indent=2)
            print(f"Wrote {args.out} from embedded {lang} block. Nodes={len(graph_data['nodes'])} Edges={len(graph_data['edges'])}")
            return

    node_acc = {}
    edge_acc = []
    inferred_nodes = set()
    current_tier = 1

    # track tier headings
    lines = md.splitlines()
    for line in lines:
        m = re.match(r"^#{1,6}\s*(?:Tier|티어)\s*(\d+)", line.strip(), re.I)
        if m:
            current_tier = int(m.group(1))
        # mermaid blocks handled later with same current_tier
        # nodes tables handled globally

    # parse code blocks
    for lang, title, content in blocks:
        if lang == "mermaid":
            parse_mermaid(content, current_tier, node_acc, edge_acc, inferred_nodes)
        elif title == "nodes":
            parse_nodes_table(lang, content, node_acc)

    # Validate references
    node_ids = set(node_acc.keys())
    missing = set()
    for e in edge_acc:
        if e["from"] not in node_ids: missing.add(e["from"])
        if e["to"] not in node_ids: missing.add(e["to"])
    if missing:
        for nid in missing:
            # create minimal inferred nodes
            node_acc[nid] = {
                "id": nid, "label": nid, "tier": 1, "kind":"concept", "requires": None,
                **TIER_DEFAULTS[1],
                "lens": ["transform"], "keywords": [], "micro_skills": [],
                "misconceptions": [], "lrc_min": None
            }
            inferred_nodes.add(nid)

    # Toposort on requires edges
    order = toposort(node_acc, edge_acc)
    if order is None:
        print("ERROR: Cycle detected in 'requires' edges.", file=sys.stderr)
        # still write output for debugging
    palette = PALETTE

    if len(node_acc) < MIN_NODE_THRESHOLD:
        if existing_payload is not None:
            print(
                f"Skipped rewrite: parsed {len(node_acc)} nodes (<{MIN_NODE_THRESHOLD}); keeping existing {args.out}.",
                file=sys.stdout,
            )
            return
        raise SystemExit(
            f"Parsed {len(node_acc)} nodes (<{MIN_NODE_THRESHOLD}) and no existing payload to fall back to."
        )

    out = {
        "version": "auto-from-md",
        "palette": palette,
        "nodes": list(node_acc.values()),
        "edges": edge_acc
    }
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"Wrote {args.out}. Nodes={len(node_acc)} Edges={len(edge_acc)}")
    if inferred_nodes:
        print(f"Note: inferred {len(inferred_nodes)} nodes from Mermaid/edges: {sorted(list(inferred_nodes))[:5]} ...")

if __name__ == "__main__":
    main()
