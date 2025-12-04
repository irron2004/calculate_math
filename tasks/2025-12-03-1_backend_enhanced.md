# Task 2025-12-03-1 — Skill Tree UX Alignment

## Problem Statement
- **Viewport is too narrow**: `SkillTreeGraph` clamps width to a fixed 760 px per course group and defaults to zoom=1, so large DAGs render as a cramped strip and users never see the full layout without heavy manual panning.
- **Hover/tooltip collisions**: Nodes have minimal spacing (150 px columns, 110 px rows). When hovering, labels/tooltip cards overlap neighboring nodes, obscuring the state badge and new Diablo-style highlight.
- **Edges terminate mid-air**: We draw cubic curves from node center to node center; with dense rows the arrows appear to connect to other edges rather than the target node, confusing progression cues.
- **Fragmented flows**: Student dashboard (`/student`) still surfaces the legacy S1/S2/S3 HomePath map and launches `/game` directly, while the new Skill Tree lives on `/skills`. There is no continuity between “수학 게임 시작하기” and the skill that was just explored, defeating the roadmap narrative.
- **Course-step labels vs. actual tiers**: HomePathMap uses the legacy `STEP_ORDER = [S1, S2, S3]`, so the dashboard contradicts the Diablo-style tiering in `/skills`.

## Proposed Direction
1. **Responsive layout & auto-fit**
   - Replace hard-coded `PANEL_WIDTH`/`NODE_COLUMN_SPACING` with viewport-relative calculations (or migrate to React Flow’s layout/viewport utilities) so the canvas always opens in a “fit to view” state.
   - Allow the Selected Skill panel to collapse/overlay on small screens so the graph can use the full width.
2. **Interaction polish**
   - Increase tier spacing or compute it dynamically based on node height.
   - Add hover hitboxes + z-indexed tooltips that sit above other nodes, and dim unrelated nodes while hovering.
   - Draw edges using node boundaries/ports instead of center-to-center curves; add arrowheads that land on the node body.
3. **Unified student experience**
   - Merge the Skill Tree into the student dashboard (or make `/skills` the primary landing) so learners start from the Diablo-style view.
   - When “연습 시작” is triggered, pass the selected skill ID into the practice/session route instead of launching `/game` with arbitrary problems.
   - Update HomePathMap (or replace it entirely) to derive tiers/labels from the new DAG rather than fixed S1/S2/S3 strings.
4. **Onboarding clarity**
   - Before starting a session, show a short confirmation modal summarizing the chosen skill, required prerequisites, and what the practice set will cover.

## Acceptance Criteria
- Opening `/skills` or the unified dashboard shows the entire tiered graph within the viewport without manual zooming, and resizing the window keeps it legible.
- Hovering or focusing a node produces a tooltip/panel that never overlaps neighboring nodes; unrelated nodes are visually deemphasized.
- Connector arrows visibly terminate on their target nodes (no mid-air junctions), and bundled edges remain readable.
- “수학 게임 시작하기” launches a session scoped to the currently selected skill; the learner understands why those problems appear.
- Dashboard visuals (HomePathMap or replacement) reference the same course tiers as the Skill Tree—no stale S1/S2/S3 copy.

## Dependencies & Notes
- Layout changes live entirely in `frontend/src/components/SkillTreeGraph.tsx` and CSS; no backend schema change is required.
- Flow merge likely needs UX alignment (decide whether `/skills` replaces `/student` or vice versa).
- Practice session API already accepts config payloads; we just need to pass the selected skill ID/step.


## 🎯 당신에게 할당된 작업 (Action Items)

### 1. Expose/confirm practice session parameters for skill-scoped launches and surface any metadata UX needs (e.g., tier labels, prerequisites).
- **우선순위**: high
- **마감일**: 2025-12-10
- **출처**: handoff
- **참고 노트**: Responsive fixes for the overcrowded Skill Tree (viewport auto-fit, hover spacing, arrow rendering) plus a unified student flow that ties the dashboard, skill selection, and practice sessions together.



### 📄 현재 파일 스냅샷 (읽기 전용)

#### frontend/src/components/SkillTreeGraph.tsx\n```\nimport { ArrowRight, CheckCircle, Lock, Sparkles, Star } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ELK from 'elkjs/lib/elk.bundled.js';

import type {
  SkillNodeProgress,
  SkillTreeEdge,
  SkillTreeGraphTree,
  SkillTreeRequirement,
  SkillTreeTeaching,
  SkillTreeNodeState,
} from '../types';
import {
  SKILL_STATE_BADGE_CLASS,
  SKILL_STATE_COLORS,
  SKILL_STATE_META,
  type SkillState,
} from '../constants/skillStates';
import { formatList, t } from '../utils/i18n';
import './SkillTreeGraph.css';

export type SkillTreeGraphNodeView = {
  id: string;
  tree: string;
  tier: number;
  label: string;
  lens: string[];
  boss?: boolean;
  grid: {
    row: number;
    col: number;
  };
  xp: {
    per_try: number;
    per_correct: number;
  };
  requires: SkillTreeRequirement[];
  teaches: SkillTreeTeaching[];
  state: SkillTreeNodeState;
  resolvedState: SkillState;
  progress?: SkillNodeProgress | null;
};

type SkillTreeGraphProps = {
  nodes: SkillTreeGraphNodeView[];
  edges: SkillTreeEdge[];
  trees: SkillTreeGraphTree[];
  palette: Record<string, string>;
  onStart: (node: SkillTreeGraphNodeView) => void;
  onSelect?: (node: SkillTreeGraphNodeView) => void;
  zoom?: number;
  highContrast?: boolean;
  focusNodeId?: string | null;
  dimUnrelated?: boolean;
};

type PositionedNode = {
  node: SkillTreeGraphNodeView;
  x: number;
  y: number;
  width: number;
  height: number;
  groupIndex: number;
};

const PANEL_WIDTH = 760;
const PANEL_PADDING_X = 36;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 88;
const NODE_COLUMN_SPACING = 150;
const ROW_GAP = 110;

const ICON_COMPONENTS = {
  lock: Lock,
  sparkles: Sparkles,
  'arrow-right': ArrowRight,
  'check-circle': CheckCircle,
  star: Star,
} as const;

function groupOrder(groups: SkillTreeGraphTree[]): Record<string, number> {
  return groups
    .slice()
    .sort((a, b) => a.order - b.order)
    .reduce<Record<string, number>>((accumulator, gro\n... [truncated] ...\node__title">
                  {displayLabel}
                  {node.boss ? <span className="skill-tree-node__boss">BOSS</span> : null}
                </h3>
                <div className="skill-tree-node__compact">
                  {node.lens.slice(0, 3).map((lens: string) => (
                    <span
                      key={`${node.id}-lens-${lens}`}
                      className="skill-tree-node__badge"
                      style={{
                        borderColor: palette[lens] ? `${palette[lens]}55` : undefined,
                        color: palette[lens] ?? undefined,
                      }}
                      aria-hidden="true"
                    >
                      {lens}
                    </span>
                  ))}
                </div>
                <div className="skill-card__tooltip" role="tooltip" aria-label={`${node.label} 상세`}>
                  <div className="tooltip-row">
                    <span>Tier {node.tier}</span>
                    <span>
                      XP {node.xp.per_try}/{node.xp.per_correct}
                    </span>
                  </div>
                  <div className="tooltip-row">{formatRequirements(node.requires)}</div>
                  <div className="tooltip-row">{formatTeaches(node.teaches)}</div>
                  <div className="tooltip-row">{formatXpSummary(node.progress) ?? '시도 기록 없음'}</div>
                  <button
                    type="button"
                    className="skill-tree-node__action"
                    onClick={(event) => {
                      event.stopPropagation();
                      onStart(node);
                    }}
                    disabled={disabled}
                    aria-disabled={disabled}
                  >
                    학습 시작
                  </button>
                </div>
              </article>
            );
          })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillTreeGraph;
\n```