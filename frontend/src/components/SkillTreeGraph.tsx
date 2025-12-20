import cytoscape, { Core, ElementDefinition } from 'cytoscape';
import React, { useEffect, useMemo, useRef } from 'react';

import './SkillTreeGraph.css';

export type SkillNode = {
  id: string;
  name: string;
  level: number;
  state?: 'learned' | 'available' | 'locked';
  prerequisites?: string[];
};

export type SkillEdge = { from: string; to: string };

type Props = {
  nodes: SkillNode[];
  edges: SkillEdge[];
};

const ROW_HEIGHT = 200;
const COL_WIDTH = 160;

const buildElements = (nodes: SkillNode[], edges: SkillEdge[]): ElementDefinition[] => {
  const grouped = new Map<number, SkillNode[]>();
  nodes.forEach((n) => {
    const list = grouped.get(n.level) ?? [];
    list.push(n);
    grouped.set(n.level, list);
  });

  const elements: ElementDefinition[] = [];

  Array.from(grouped.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([level, levelNodes]) => {
      levelNodes
        .sort((a, b) => a.name.localeCompare(b.name, 'ko'))
        .forEach((node, index) => {
          elements.push({
            data: {
              id: node.id,
              label: node.name,
              state: node.state ?? (node.prerequisites?.length ? 'locked' : 'available'),
            },
            position: {
              x: index * COL_WIDTH,
              y: level * ROW_HEIGHT,
            },
          });
        });
    });

  edges.forEach((edge) => {
    elements.push({
      data: {
        id: `${edge.from}-${edge.to}`,
        source: edge.from,
        target: edge.to,
      },
    });
  });

  return elements;
};

export const SkillTreeGraph: React.FC<Props> = ({ nodes, edges }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  const elements = useMemo(() => buildElements(nodes, edges), [nodes, edges]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    // destroy old instance if it exists
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      layout: { name: 'preset' },
      minZoom: 0.2,
      maxZoom: 2.5,
      boxSelectionEnabled: false,
      autoungrabify: true,
      autolock: true,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      panningEnabled: true,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#0f172a',
            'border-width': 2,
            'border-color': '#334155',
            label: 'data(label)',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 12,
            color: '#e2e8f0',
            width: 84,
            height: 84,
            'border-radius': '50%',
            'transition-property': 'background-color, border-color, opacity',
            'transition-duration': '150ms',
            'transition-timing-function': 'ease-in-out',
          },
        },
        {
          selector: 'node[state = "learned"]',
          style: {
            'border-color': '#60a5fa',
            'background-color': '#0ea5e9',
            color: '#0b1726',
          },
        },
        {
          selector: 'node[state = "available"]',
          style: {
            'border-color': '#fbbf24',
            'background-color': '#451a03',
            'box-shadow': '0 0 14px #fbbf2480',
          },
        },
        {
          selector: 'node[state = "locked"]',
          style: {
            'border-color': '#475569',
            'background-color': '#020617',
            opacity: 0.55,
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': '#475569',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#c084fc',
            'background-color': '#4c1d95',
          },
        },
      ],
      wheelSensitivity: 0.2,
      pixelRatio: 1,
    });

    cy.fit();
    cyRef.current = cy;

    return () => {
      cy.destroy();
    };
  }, [elements]);

  return <div className="skill-tree-graph" ref={containerRef} />;
};

export default SkillTreeGraph;
