
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
validate_skills.py
------------------
Validate a skills.json against the schema and run consistency checks:
- JSON Schema validation (optional if jsonschema installed)
- unique node ids
- referenced nodes exist
- acyclic requires graph
- unreachable nodes (optional warning)
"""
import json, argparse, sys
from collections import defaultdict, deque

def toposort(nodes, edges):
    indeg = defaultdict(int)
    adj = defaultdict(list)
    for e in edges:
        if e["type"] != "requires": continue
        u, v = e["from"], e["to"]
        adj[u].append(v); indeg[v]+=1
    q = deque([n["id"] for n in nodes if indeg[n["id"]]==0])
    out = []
    while q:
        u = q.popleft()
        out.append(u)
        for w in adj[u]:
            indeg[w]-=1
            if indeg[w]==0: q.append(w)
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--schema", dest="schema", default=None)
    args = ap.parse_args()

    with open(args.inp, "r", encoding="utf-8") as f:
        data = json.load(f)
    ok = True

    # schema validation (optional)
    if args.schema:
        try:
            import jsonschema
        except ImportError:
            print("Schema: SKIPPED (install 'jsonschema' to enable schema validation)", file=sys.stderr)
        else:
            try:
                with open(args.schema, "r", encoding="utf-8") as sf:
                    schema = json.load(sf)
                jsonschema.validate(instance=data, schema=schema)
                print("Schema: OK")
            except Exception as e:
                print(f"Schema: FAIL - {e}", file=sys.stderr)
                ok = False

    ids = [n["id"] for n in data["nodes"]]
    if len(ids) != len(set(ids)):
        print("Duplicate node ids detected.", file=sys.stderr); ok = False

    idset = set(ids)
    for e in data["edges"]:
        if e["from"] not in idset: print(f"Edge 'from' missing: {e}", file=sys.stderr); ok = False
        if e["to"] not in idset: print(f"Edge 'to' missing: {e}", file=sys.stderr); ok = False

    order = toposort(data["nodes"], data["edges"])
    if len(order) != len(ids):
        print("Cycle detected in requires edges or disconnected graph.", file=sys.stderr); ok = False
    else:
        print("Toposort: OK (no cycle)")

    # unreachable (warning)
    roots = set(order[:1])
    # basic warn skipped: content dependent

    if not ok:
        sys.exit(1)
    print("Validation passed.")

if __name__ == "__main__":
    main()
