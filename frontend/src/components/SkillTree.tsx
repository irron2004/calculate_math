import React, { useEffect, useMemo, useState } from 'react';

import type { CurriculumGraph } from '../types';
import type { StepID } from '../utils/analytics';
import { fetchCurriculumGraph } from '../utils/api';
import {
  buildSkillTree,
  type BuildSkillTreeOptions,
  type SkillTreeBranch
} from './skillTreeHelpers';
import './SkillTree.css';

type SkillTreeProps = {
  completedNodes: string[];
  focusConceptId?: string | null;
  conceptNames?: Record<string, string>;
  activeConceptId?: string | null;
  selectedNodeId?: string | null;
  onSelectStep?: (conceptId: string, step: StepID) => void;
};

const buildOptions = (conceptNames?: Record<string, string>): BuildSkillTreeOptions => {
  return conceptNames ? { conceptNames } : {};
};

const SkillTree: React.FC<SkillTreeProps> = ({
  completedNodes,
  focusConceptId,
  conceptNames,
  activeConceptId,
  selectedNodeId,
  onSelectStep
}) => {
  const [graph, setGraph] = useState<CurriculumGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    fetchCurriculumGraph()
      .then((data) => {
        if (cancelled) {
          return;
        }
        setGraph(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error('Failed to load curriculum graph for skill tree:', err);
        setError('스킬 트리를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
        setGraph(null);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const branches: SkillTreeBranch[] = useMemo(() => {
    if (!graph) {
      return [];
    }
    return buildSkillTree(graph, completedNodes, buildOptions(conceptNames));
  }, [graph, completedNodes, conceptNames]);

  const filteredBranches = useMemo(() => {
    if (!activeConceptId) {
      return branches;
    }
    return branches.filter((branch) => branch.conceptId === activeConceptId);
  }, [branches, activeConceptId]);

  if (isLoading) {
    return (
      <div className="skill-tree skill-tree--loading" role="status" aria-live="polite">
        스킬 트리를 불러오는 중입니다...
      </div>
    );
  }

  if (error) {
    return (
      <div className="skill-tree skill-tree--error" role="alert">
        {error}
      </div>
    );
  }

  if (!filteredBranches.length) {
    return (
      <div className="skill-tree skill-tree--empty">
        표시할 스킬 트리 데이터가 없습니다.
      </div>
    );
  }

  return (
    <div className="skill-tree" aria-live="polite">
      {filteredBranches.map((branch) => {
        const isFocus = focusConceptId
          ? branch.conceptId === focusConceptId
          : false;
        return (
          <section
            key={branch.conceptId}
            className={`skill-tree__branch${
              isFocus ? ' skill-tree__branch--focus' : ''
            }`}
            aria-labelledby={`skill-branch-${branch.conceptId}`}
          >
            <header className="skill-tree__branch-header">
              <span
                className="skill-tree__branch-indicator"
                style={{ backgroundColor: branch.color ?? '#6366f1' }}
                aria-hidden="true"
              />
              <div className="skill-tree__branch-meta">
                <h3 id={`skill-branch-${branch.conceptId}`}>{branch.label}</h3>
                {branch.lens.length > 0 && (
                  <p className="skill-tree__branch-lens">
                    {branch.lens.join(' · ')}
                  </p>
                )}
              </div>
            </header>
            <ol className="skill-tree__level-list">
              {branch.nodes.map((node) => (
                <SkillTreeNodeItem
                  key={node.id}
                  branch={branch}
                  node={node}
                  selectedNodeId={selectedNodeId}
                  onSelectStep={onSelectStep}
                />
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
};

export default SkillTree;

type NodeItemProps = {
  branch: SkillTreeBranch;
  node: SkillTreeBranch['nodes'][number];
  selectedNodeId?: string | null;
  onSelectStep?: (conceptId: string, step: StepID) => void;
};

const SkillTreeNodeItem: React.FC<NodeItemProps> = ({
  branch,
  node,
  selectedNodeId,
  onSelectStep
}) => {
  const nodeKey = `${branch.conceptId}-${node.step}`;
  const isSelected = nodeKey === selectedNodeId;
  const isInteractive = typeof onSelectStep === 'function' && node.status !== 'locked';

  const handleClick = () => {
    if (!isInteractive) {
      return;
    }
    if (node.step === 'S1' || node.step === 'S2' || node.step === 'S3') {
      onSelectStep?.(branch.conceptId, node.step);
    }
  };

  return (
    <li
      className={`skill-tree__node skill-tree__node--${node.status}${
        isSelected ? ' skill-tree__node--selected' : ''
      }`}
      data-status={node.status}
      data-selected={isSelected ? 'true' : 'false'}
    >
      <button
        type="button"
        className="skill-tree__node-trigger"
        onClick={handleClick}
        disabled={!isInteractive}
        aria-pressed={isSelected}
        aria-current={isSelected ? 'step' : undefined}
      >
        <div className="skill-tree__node-badge">
          <span className="skill-tree__node-step">{node.step}</span>
          <span className="skill-tree__node-label">{node.label}</span>
        </div>
        <div className="skill-tree__node-body">
          <p className="skill-tree__node-mastery">
            숙련도 {Math.round(node.mastery * 100)}%
          </p>
          {node.microSkills.length > 0 && (
            <ul className="skill-tree__micro-skills">
              {node.microSkills.slice(0, 3).map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          )}
          {node.status === 'locked' && node.prerequisites.length > 0 && (
            <p className="skill-tree__node-prereq">
              선행: {node.prerequisites.join(', ')}
            </p>
          )}
        </div>
      </button>
    </li>
  );
};
