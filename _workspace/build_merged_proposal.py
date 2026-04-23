#!/usr/bin/env python3
"""
Phase 1~6의 모든 제안을 합쳐 curriculum_math_2022.json에 적용 가능한
merged_graph.json을 생성한다. Phase 5(CSAT 분리)는 보류.

원본은 수정하지 않는다. 산출: _workspace/merged_graph_v0_3.json
"""
import json, copy
from pathlib import Path

ROOT = Path(__file__).parent.parent
SRC = ROOT / 'public/data/curriculum_math_2022.json'
OUT = ROOT / '_workspace/merged_graph_v0_3.json'

with open(SRC) as f:
    g = json.load(f)

merged = copy.deepcopy(g)
merged['meta']['note'] = g['meta'].get('note','') + ' | v0.3 merge: atomicSkills added, drill-down for 초1-4 NA, 고2 achievements added, branch convergence edges, prereq expansion. CSAT unchanged.'
merged['meta']['merged_at'] = '2026-04-23'
merged['meta']['taxonomy_version'] = 'weakTag v0.3'

# Load all phase proposals
def load(p):
    with open(ROOT / f'_workspace/{p}') as f: return json.load(f)
p1 = load('phase1_graph_proposal.json')
p2 = load('phase2_graph_proposal.json')
p3 = load('phase3_graph_proposal.json')
p4 = load('phase4_graph_proposal.json')
p6 = load('phase6_graph_proposal.json')

node_by_id = {n['id']: n for n in merged['nodes']}

# ===== Phase 1 & 2: atomicSkills field additions =====
for p in (p1, p2):
    for fa in p['field_additions']:
        tid = fa['targetId']
        if tid in node_by_id:
            node_by_id[tid]['atomicSkills'] = fa['add']['atomicSkills']

# ===== Phase 1 & 2: drill-down sub-units =====
for p in (p1, p2):
    for block in p['node_drill_down_subunits']:
        for n in block['newNodes']:
            # skip non-schema fields
            node_clean = {k: v for k, v in n.items() if k != 'rationale'}
            merged['nodes'].append(node_clean)
            node_by_id[n['id']] = node_clean

# ===== Phase 3: new achievement nodes =====
for n in p3['new_achievement_nodes']:
    # Extract atomicSkills, strip alignsToUnit (will become edge)
    clean = {k: v for k, v in n.items() if k not in ('alignsToUnit',)}
    merged['nodes'].append(clean)
    node_by_id[n['id']] = clean
    # Generate contains edge (domain -> achievement) & alignsTo edge (unit -> achievement)
    parent = n['parentId']
    merged['edges'].append({
        "id": f"contains:{parent}->{n['id']}",
        "edgeType": "contains",
        "source": parent,
        "target": n['id']
    })
    merged['edges'].append({
        "id": f"alignsTo:{n['alignsToUnit']}->{n['id']}",
        "edgeType": "alignsTo",
        "source": n['alignsToUnit'],
        "target": n['id']
    })

# ===== Phase 1 & 2: new edges =====
for p in (p1, p2):
    for e in p.get('new_edges', []):
        clean = {k: v for k, v in e.items() if k != 'rationale'}
        merged['edges'].append(clean)

# ===== Phase 4: branch convergence =====
for e in p4['new_edges']:
    clean = {k: v for k, v in e.items() if k != 'rationale'}
    merged['edges'].append(clean)

# ===== Phase 6: prereq edges =====
for e in p6['new_edges_tb_prereq'] + p6['new_edges_achievement_prereq']:
    clean = {k: v for k, v in e.items() if k != 'rationale'}
    merged['edges'].append(clean)

# ===== Write output =====
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

# ===== Summary =====
orig_nodes = len(g['nodes'])
orig_edges = len(g['edges'])
new_nodes = len(merged['nodes']) - orig_nodes
new_edges = len(merged['edges']) - orig_edges
ach_with_as = sum(1 for n in merged['nodes'] if n.get('atomicSkills'))
total_as = sum(len(n.get('atomicSkills', [])) for n in merged['nodes'])

print(f"원본: {orig_nodes} 노드 / {orig_edges} 엣지")
print(f"병합: {len(merged['nodes'])} 노드 / {len(merged['edges'])} 엣지")
print(f"증분: +{new_nodes} 노드 / +{new_edges} 엣지")
print(f"atomicSkills 부여된 노드: {ach_with_as}")
print(f"atomicSkills 총합: {total_as}")
print(f"\n출력: {OUT}")
