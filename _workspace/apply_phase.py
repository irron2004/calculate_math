#!/usr/bin/env python3
"""
Apply a single phase's proposal to public/data/curriculum_math_2022.json.
Used for per-phase git commits.

Usage: apply_phase.py <phase>
  where <phase> is one of: p1, p2, p3, p4, p6
"""
import json, copy, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
LIVE = ROOT / 'public/data/curriculum_math_2022.json'

def load_phase(name):
    with open(ROOT / f'_workspace/{name}_graph_proposal.json') as f:
        return json.load(f)

def load_live():
    with open(LIVE) as f: return json.load(f)

def write_live(g):
    with open(LIVE, 'w', encoding='utf-8') as f:
        json.dump(g, f, ensure_ascii=False, indent=2)

def strip(d, *keys):
    return {k: v for k, v in d.items() if k not in keys}

def apply_p1_p2(g, p):
    by_id = {n['id']: n for n in g['nodes']}
    for fa in p['field_additions']:
        if fa['targetId'] in by_id:
            by_id[fa['targetId']]['atomicSkills'] = fa['add']['atomicSkills']
    for block in p['node_drill_down_subunits']:
        for n in block['newNodes']:
            g['nodes'].append(strip(n, 'rationale'))
    for e in p.get('new_edges', []):
        g['edges'].append(strip(e, 'rationale'))

def apply_p3(g, p):
    for n in p['new_achievement_nodes']:
        g['nodes'].append(strip(n, 'alignsToUnit'))
        g['edges'].append({"id": f"contains:{n['parentId']}->{n['id']}", "edgeType": "contains", "source": n['parentId'], "target": n['id']})
        g['edges'].append({"id": f"alignsTo:{n['alignsToUnit']}->{n['id']}", "edgeType": "alignsTo", "source": n['alignsToUnit'], "target": n['id']})

def apply_p4(g, p):
    for e in p['new_edges']:
        g['edges'].append(strip(e, 'rationale'))

def apply_p6(g, p):
    for e in p['new_edges_tb_prereq'] + p['new_edges_achievement_prereq']:
        g['edges'].append(strip(e, 'rationale'))

APPLIERS = {
    'p1': ('phase1', apply_p1_p2),
    'p2': ('phase2', apply_p1_p2),
    'p3': ('phase3', apply_p3),
    'p4': ('phase4', apply_p4),
    'p6': ('phase6', apply_p6),
}

def main():
    phase = sys.argv[1]
    name, fn = APPLIERS[phase]
    p = load_phase(name)
    g = load_live()
    before_n, before_e = len(g['nodes']), len(g['edges'])
    fn(g, p)
    # Update meta
    g['meta']['note'] = g['meta'].get('note', '').rstrip(' .') + f' | {phase} applied'
    write_live(g)
    print(f"[{phase}] nodes {before_n} -> {len(g['nodes'])} (+{len(g['nodes'])-before_n}), edges {before_e} -> {len(g['edges'])} (+{len(g['edges'])-before_e})")

if __name__ == '__main__': main()
