import { Clock, Target } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type {
  APISession,
  CourseSessionConfig,
  CurriculumConcept,
  CurriculumGraphNode,
  GeneratedItem,
  LRCEvaluation,
  LRCStatus,
  LRCRecommendation
} from '../types';
import {
  createSession,
  evaluateLRC,
  fetchConcepts,
  fetchCurriculumGraph,
  fetchTemplates,
  fetchLatestLRC,
  generateTemplateInstance
} from '../utils/api';
import { resolveFocusConcept } from '../utils/curriculum';
import { getLensBadges, getLensBadgeTokens } from '../utils/lens';
import { countKeywordMatches } from '../utils/text';
import SkillTree from './SkillTree';
import './MathGame.css';
import {
  trackBossPassed,
  trackSessionStartedFromTree,
  trackSkillUnlocked,
  trackSkillViewed,
  type SkillViewSource,
  type StepID
} from '../utils/analytics';

const STEP_LABEL: Record<string, string> = {
  S1: 'S1 · 기초',
  S2: 'S2 · 브리지',
  S3: 'S3 · 전이'
};
const PREFERRED_CONCEPTS = ['ALG-AP', 'RAT-PRO', 'GEO-LIN'];

const LRC_STATUS_MESSAGES: Record<LRCStatus, { title: string; body: string }> = {
  gold: {
    title: 'GOLD 초대 조건을 달성했어요! ✨',
    body: '정확도와 속도, 설명까지 모두 충족했어요. 바로 다음 단계로 넘어갈 준비가 되었어요.'
  },
  silver: {
    title: 'SILVER 초대 조건이에요! 🥈',
    body: '정확도와 속도는 충분해요. 설명을 조금만 더 채우면 GOLD에 도전할 수 있어요.'
  },
  pending: {
    title: '거의 다 왔어요! 🔄',
    body: '정확도와 속도 중 하나만 더 끌어올리면 초대 조건을 만족할 수 있어요.'
  },
  retry: {
    title: '다시 준비해볼까요? 💪',
    body: '기초 개념을 한 번 더 다져서 초대 조건을 채워봐요.'
  }
};

type RecommendationKey = Extract<LRCRecommendation, 'promote' | 'reinforce' | 'remediate'>;

const LRC_RECOMMENDATION_LABELS: Record<RecommendationKey, string> = {
  promote: '승급 연동',
  reinforce: '집중 보강',
  remediate: '기초 복습'
};

const FALLBACK_CONCEPT: CurriculumConcept = {
  id: 'FALLBACK',
  name: '기본 덧셈',
  lens: ['difference'],
  prerequisites: [],
  transfers: [],
  summary: '덧셈 연습을 위한 예비 문제 세트입니다.',
  stage_span: ['S1'],
  focus_keywords: ['덧셈']
};

const FALLBACK_TEMPLATE_ID = 'fallback-inline';
const QUESTION_TIME_LIMIT = 30;
const STEP_SEQUENCE: ReadonlyArray<StepID> = ['S1', 'S2', 'S3'];
const PROBLEMS_PER_STEP = 6;

const parseSessionConfigParam = (raw: string | null): CourseSessionConfig | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const concept =
      typeof parsed.concept === 'string' && parsed.concept.trim().length > 0
        ? parsed.concept
        : null;
    const step =
      parsed.step === 'S1' || parsed.step === 'S2' || parsed.step === 'S3'
        ? parsed.step
        : null;
    const problemCount =
      typeof parsed.problem_count === 'number' && Number.isFinite(parsed.problem_count)
        ? parsed.problem_count
        : null;
    const generator =
      typeof parsed.generator === 'string' && parsed.generator.trim().length > 0
        ? parsed.generator
        : null;
    const parameters =
      parsed.parameters && typeof parsed.parameters === 'object' ? parsed.parameters : {};
    return {
      concept,
      step,
      problem_count: problemCount,
      generator,
      parameters: parameters as Record<string, unknown>,
    };
  } catch {
    return null;
  }
};

const randomInt = (min: number, max: number): number => {
  const lower = Math.ceil(min);
  const upper = Math.floor(max);
  return Math.floor(Math.random() * (upper - lower + 1)) + lower;
};

const randomNumberWithDigits = (digits: number): number => {
  const safeDigits = Math.max(1, Math.min(6, Math.floor(digits)));
  const min = safeDigits === 1 ? 1 : 10 ** (safeDigits - 1);
  const max = 10 ** safeDigits - 1;
  return randomInt(min, max);
};

const hasAdditionCarry = (a: number, b: number): boolean => {
  let left = a;
  let right = b;
  while (left > 0 || right > 0) {
    const sum = (left % 10) + (right % 10);
    if (sum >= 10) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
};

const hasSubtractionBorrow = (a: number, b: number): boolean => {
  let left = a;
  let right = b;
  while (left > 0 || right > 0) {
    const leftDigit = left % 10;
    const rightDigit = right % 10;
    if (leftDigit < rightDigit) {
      return true;
    }
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
};

const buildNumericOptions = (answer: number): number[] => {
  const options = new Set<number>([answer]);
  const magnitude = Math.max(5, Math.abs(answer) / 10);
  while (options.size < 4) {
    const offset = randomInt(-Math.ceil(magnitude), Math.ceil(magnitude));
    if (offset === 0) {
      continue;
    }
    const candidate = answer + offset;
    if (candidate < 0) {
      continue;
    }
    options.add(candidate);
  }
  return Array.from(options).sort(() => Math.random() - 0.5);
};

const parseStepParam = (value: string | null): StepID | null => {
  if (value === 'S1' || value === 'S2' || value === 'S3') {
    return value;
  }
  return null;
};

interface CurriculumProblem {
  concept: CurriculumConcept;
  instance: GeneratedItem;
}

type SequenceEntry = {
  conceptId: string;
  step: StepID;
  nodeId: string;
  label: string;
  lens: string[];
};

type TreeTrigger = 'skill_node';

type LoadProblemsOptions = {
  source?: SkillViewSource;
  sequenceEntry?: SequenceEntry | null;
  triggeredByTree?: TreeTrigger | null;
  sessionConfig?: CourseSessionConfig | null;
};

interface ProblemFeedback {
  prompt: string;
  conceptName: string;
  step: string;
  correctAnswer: number;
  userAnswer: number | null;
  isCorrect: boolean;
  explanation: string;
  keywordsMatched: number;
  keywordsAvailable: number;
  hintUsed: boolean;
}

const MathGame: React.FC = () => {
  const { user, token } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedConceptParam = searchParams.get('concept');
  const requestedStepParam = parseStepParam(searchParams.get('step'));
  const requestedSessionParam = searchParams.get('session');
  const requestedSessionConfig = useMemo(
    () => parseSessionConfigParam(requestedSessionParam),
    [requestedSessionParam]
  );

  const [gameState, setGameState] = useState<'loading' | 'playing' | 'finished' | 'submitted'>('loading');
  const [problems, setProblems] = useState<CurriculumProblem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentProblem, setCurrentProblem] = useState<CurriculumProblem | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [timeSpentHistory, setTimeSpentHistory] = useState<number[]>([]);

  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number | null>>({});
  const [answerInput, setAnswerInput] = useState('');
  const [explanationInput, setExplanationInput] = useState('');
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [hintUsage, setHintUsage] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement | null>(null);
  const explanationValueRef = useRef('');
  const hintRevealedRef = useRef(false);
  const questionStartRef = useRef<number | null>(null);
  const focusStartRef = useRef<number | null>(null);
  const [feedback, setFeedback] = useState<ProblemFeedback | null>(null);

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lrcResult, setLrcResult] = useState<LRCEvaluation | null>(null);
  const [lrcError, setLrcError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestLRC, setLatestLRC] = useState<LRCEvaluation | null>(null);
  const [showKeywordHints, setShowKeywordHints] = useState(false);
  const [conceptCatalog, setConceptCatalog] = useState<Record<string, CurriculumConcept>>({});
  const [concepts, setConcepts] = useState<CurriculumConcept[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<CurriculumConcept | null>(null);
  const [selectedStep, setSelectedStep] = useState<StepID | null>(null);
  const [completedStepsByConcept, setCompletedStepsByConcept] = useState<Record<string, StepID[]>>({});
  const [curriculumSequence, setCurriculumSequence] = useState<SequenceEntry[]>([]);
  const [sequenceIndex, setSequenceIndex] = useState<number | null>(null);

  const resetRoundState = () => {
    setScore(0);
    setCorrectCount(0);
    setUserAnswers({});
    setTimeSpentHistory([]);
    setAnswerInput('');
    setExplanationInput('');
    setExplanations({});
    setHintUsage({});
    setShowKeywordHints(false);
    explanationValueRef.current = '';
    hintRevealedRef.current = false;
    questionStartRef.current = null;
    focusStartRef.current = null;
    setFeedback(null);
    setLrcResult(null);
    setLrcError(null);
    setIsSubmitted(false);
    setCurrentIndex(0);
    setCurrentProblem(null);
    setTimeLeft(QUESTION_TIME_LIMIT);
    setProblems([]);
  };

  const upsertConceptCatalog = (list: CurriculumConcept[]) => {
    const mapping = list.reduce<Record<string, CurriculumConcept>>((accumulator, concept) => {
      accumulator[concept.id] = concept;
      return accumulator;
    }, {});
    setConceptCatalog(mapping);
    setConcepts(list);
    return mapping;
  };

  const getCompletedSteps = (conceptId: string): Set<string> => {
    return new Set(completedStepsByConcept[conceptId] ?? []);
  };

  const isStepAvailable = (conceptId: string, step: StepID): boolean => {
    if (step === 'S1') {
      return true;
    }
    const completed = getCompletedSteps(conceptId);
    const targetIndex = STEP_SEQUENCE.indexOf(step);
    if (targetIndex <= 0) {
      return true;
    }
    const required = STEP_SEQUENCE.slice(0, targetIndex);
    return required.every((requiredStep) => completed.has(requiredStep));
  };

  const determineNextStepForConcept = (conceptId: string): StepID | null => {
    const completed = getCompletedSteps(conceptId);
    for (const step of STEP_SEQUENCE) {
      if (!completed.has(step) && isStepAvailable(conceptId, step)) {
        return step;
      }
    }
    return STEP_SEQUENCE[STEP_SEQUENCE.length - 1] ?? null;
  };

  const markStepCompleted = (conceptId: string, step: StepID) => {
    const existingSteps = new Set(completedStepsByConcept[conceptId] ?? []);
    if (existingSteps.has(step)) {
      return;
    }

    const updatedSteps = new Set(existingSteps);
    updatedSteps.add(step);

    setCompletedStepsByConcept((previous) => ({
      ...previous,
      [conceptId]: Array.from(updatedSteps)
    }));

    const { index } = findSequenceInfo(conceptId, step);
    if (index !== null) {
      setSequenceIndex(index);
    }

    const nextStep = getNextSequentialStep(step);
    if (!nextStep) {
      return;
    }
    const requiredSteps = STEP_SEQUENCE.slice(0, STEP_SEQUENCE.indexOf(nextStep));
    const prerequisitesMet = requiredSteps.every((required) => updatedSteps.has(required));
    if (!prerequisitesMet || updatedSteps.has(nextStep)) {
      return;
    }

    const nextInfo = findSequenceInfo(conceptId, nextStep);
    const concept =
      conceptCatalog[conceptId] ?? (conceptId === FALLBACK_CONCEPT.id ? FALLBACK_CONCEPT : null);
    trackSkillUnlocked({
      conceptId,
      conceptName: concept?.name ?? conceptId,
      unlockedStep: nextStep,
      previousStep: step,
      nodeId: nextInfo.entry?.nodeId ?? `${conceptId}-${nextStep}`,
      sequenceIndex: nextInfo.index,
      lens: nextInfo.entry?.lens?.[0] ?? concept?.lens?.[0] ?? null,
    });
  };

  const getNextSequentialStep = (step: StepID): StepID | null => {
    const index = STEP_SEQUENCE.indexOf(step);
    if (index === -1 || index === STEP_SEQUENCE.length - 1) {
      return null;
    }
    return STEP_SEQUENCE[index + 1] ?? null;
  };

  const isStepCompleted = (conceptId: string, step: StepID): boolean => {
    return (completedStepsByConcept[conceptId] ?? []).includes(step);
  };

  const buildCurriculumSequence = (nodes: CurriculumGraphNode[]): SequenceEntry[] => {
    return nodes
      .filter((node) => (STEP_SEQUENCE as readonly string[]).includes(node.step))
      .map((node) => ({
        conceptId: node.concept,
        step: node.step as StepID,
        nodeId: node.id,
        label: node.label,
        lens: node.lens ?? [],
      }));
  };

  const reorderConceptsBySequence = (
    sequence: SequenceEntry[],
    catalog: Record<string, CurriculumConcept>
  ): CurriculumConcept[] => {
    const ordered: CurriculumConcept[] = [];
    const seen = new Set<string>();
    sequence.forEach((entry) => {
      if (seen.has(entry.conceptId)) {
        return;
      }
      const concept = catalog[entry.conceptId];
      if (concept) {
        ordered.push(concept);
        seen.add(entry.conceptId);
      }
    });
    Object.values(catalog).forEach((concept) => {
      if (!seen.has(concept.id)) {
        ordered.push(concept);
        seen.add(concept.id);
      }
    });
    return ordered;
  };

  const findSequenceInfo = (conceptId: string, step: StepID) => {
    const index = curriculumSequence.findIndex(
      (entry) => entry.conceptId === conceptId && entry.step === step
    );
    if (index === -1) {
      return { entry: null, index: null } as const;
    }
    return { entry: curriculumSequence[index], index } as const;
  };

  const convertSessionToCurriculum = (
    session: APISession,
    concept: CurriculumConcept,
    step: StepID
  ): CurriculumProblem[] => {
    return session.problems.map((problem, index) => ({
      concept,
      instance: {
        id: `${FALLBACK_TEMPLATE_ID}-${index}`,
        template_id: FALLBACK_TEMPLATE_ID,
        concept: concept.id,
        step,
        prompt: `${problem.left} + ${problem.right} = ?`,
        explanation: '두 수를 더해 답을 구합니다.',
        answer: problem.answer,
        options: problem.options,
        context: 'life',
        lens: concept.lens,
        representation: 'C',
        rubric_keywords: concept.focus_keywords.length ? concept.focus_keywords : ['덧셈'],
        variables: {
          left: problem.left,
          right: problem.right
        }
      }
    }));
  };

  const generateLocalFallback = (
    count: number,
    concept: CurriculumConcept,
    step: StepID
  ): CurriculumProblem[] => {
    return Array.from({ length: count }, (_, index) => {
      const left = Math.floor(Math.random() * 9) + 1;
      const right = Math.floor(Math.random() * 9) + 1;
      const answer = left + right;
      const options = new Set<number>([answer]);
      while (options.size < 4) {
        const candidate = answer + Math.floor(Math.random() * 10) - 5;
        if (candidate > 0) {
          options.add(candidate);
        }
      }
      return {
        concept,
        instance: {
          id: `${FALLBACK_TEMPLATE_ID}-local-${index}`,
          template_id: FALLBACK_TEMPLATE_ID,
          concept: concept.id,
          step,
          prompt: `${left} + ${right} = ?`,
          explanation: '두 수를 더해 답을 구합니다.',
          answer,
          options: Array.from(options),
          context: 'life',
          lens: concept.lens,
          representation: 'C',
          rubric_keywords: concept.focus_keywords.length ? concept.focus_keywords : ['덧셈'],
          variables: {
            left,
            right
          }
        }
      };
    });
  };

  const generateArithmeticProblemSet = (
    concept: CurriculumConcept,
    step: StepID,
    session: CourseSessionConfig,
    targetCount: number
  ): CurriculumProblem[] => {
    const params = session.parameters ?? {};
    const count = Math.max(1, Math.min(60, Math.floor(targetCount)));
    const rawOps = Array.isArray((params as Record<string, unknown>).ops)
      ? ((params as Record<string, unknown>).ops as string[])
      : null;
    const ops =
      rawOps?.filter((value) => value === 'add' || value === 'sub' || value === 'mul' || value === 'div') ?? [];
    const singleOp =
      typeof (params as Record<string, unknown>).op === 'string'
        ? String((params as Record<string, unknown>).op)
        : null;
    const allowCarry = Boolean((params as Record<string, unknown>).allow_carry ?? true);
    const allowRemainder = Boolean((params as Record<string, unknown>).allow_remainder ?? false);
    const digitsParam = Array.isArray((params as Record<string, unknown>).digits)
      ? (params as Record<string, unknown>).digits
      : null;
    const leftDigits =
      typeof (params as Record<string, unknown>).left_digits === 'number'
        ? Number((params as Record<string, unknown>).left_digits)
        : null;
    const rightDigits =
      typeof (params as Record<string, unknown>).right_digits === 'number'
        ? Number((params as Record<string, unknown>).right_digits)
        : null;
    const dividendDigits =
      typeof (params as Record<string, unknown>).dividend_digits === 'number'
        ? Number((params as Record<string, unknown>).dividend_digits)
        : null;
    const divisorDigits =
      typeof (params as Record<string, unknown>).divisor_digits === 'number'
        ? Number((params as Record<string, unknown>).divisor_digits)
        : null;
    const includePow10 = Boolean((params as Record<string, unknown>).include_pow10 ?? false);

    const minValue =
      typeof (params as Record<string, unknown>).min === 'number'
        ? Number((params as Record<string, unknown>).min)
        : 10;
    const maxValue =
      typeof (params as Record<string, unknown>).max === 'number'
        ? Number((params as Record<string, unknown>).max)
        : 999;

    const problems: CurriculumProblem[] = [];

    const selectOp = (): 'add' | 'sub' | 'mul' | 'div' => {
      if (ops.length) {
        const candidate = ops[randomInt(0, ops.length - 1)] as 'add' | 'sub' | 'mul' | 'div';
        return candidate;
      }
      if (singleOp && (singleOp === 'add' || singleOp === 'sub' || singleOp === 'mul' || singleOp === 'div')) {
        return singleOp as 'add' | 'sub' | 'mul' | 'div';
      }
      return 'add';
    };

    for (let index = 0; index < count; index += 1) {
      const op = selectOp();
      let left: number;
      let right: number;
      let answer: number;

      if (op === 'mul') {
        const leftNumber =
          leftDigits && leftDigits > 0
            ? randomNumberWithDigits(leftDigits)
            : digitsParam && digitsParam.length > 0
            ? randomNumberWithDigits(digitsParam[0])
            : randomInt(Math.max(2, minValue), Math.max(9, Math.min(maxValue, 99)));
        let rightNumber =
          rightDigits && rightDigits > 0
            ? randomNumberWithDigits(rightDigits)
            : digitsParam && digitsParam.length > 1
            ? randomNumberWithDigits(digitsParam[1])
            : randomInt(2, 9);
        if (includePow10 && Math.random() < 0.3) {
          rightNumber = Math.random() < 0.5 ? 10 : 100;
        }
        left = leftNumber;
        right = rightNumber;
        answer = leftNumber * rightNumber;
      } else if (op === 'div') {
        const divisorNumber =
          divisorDigits && divisorDigits > 0 ? randomNumberWithDigits(divisorDigits) : randomInt(2, 9);
        let dividendNumber: number;
        if (!allowRemainder) {
          const quotientDigits = dividendDigits ? Math.max(1, dividendDigits - (divisorDigits ?? 1) + 1) : 2;
          let attempts = 0;
          while (true) {
            const quotient = randomNumberWithDigits(quotientDigits);
            dividendNumber = quotient * divisorNumber;
            if (!dividendDigits || String(dividendNumber).length === Math.max(1, dividendDigits)) {
              break;
            }
            attempts += 1;
            if (attempts > 25) {
              break;
            }
          }
        } else {
          const digits = dividendDigits ?? Math.max(2, divisorDigits ? divisorDigits + 1 : 3);
          dividendNumber = randomNumberWithDigits(digits);
          if (dividendNumber < divisorNumber) {
            dividendNumber += divisorNumber;
          }
        }
        left = dividendNumber;
        right = divisorNumber;
        const quotient = dividendNumber / divisorNumber;
        answer = allowRemainder ? Math.floor(quotient) : quotient;
      } else {
        const [defaultLeftDigits, defaultRightDigits] =
          digitsParam && digitsParam.length >= 2 ? digitsParam : [2, 2];
        const leftRangeMin =
          defaultLeftDigits > 0 ? Math.max(minValue, 10 ** (defaultLeftDigits - 1)) : Math.max(1, minValue);
        const leftRangeMax =
          defaultLeftDigits > 0
            ? Math.min(maxValue, 10 ** defaultLeftDigits - 1)
            : Math.max(maxValue, leftRangeMin);
        const rightRangeMin =
          defaultRightDigits > 0 ? Math.max(minValue, 10 ** (defaultRightDigits - 1)) : Math.max(1, minValue);
        const rightRangeMax =
          defaultRightDigits > 0
            ? Math.min(maxValue, 10 ** defaultRightDigits - 1)
            : Math.max(maxValue, rightRangeMin);

        let attempts = 0;
        let generatedLeft = randomInt(leftRangeMin, leftRangeMax);
        let generatedRight = randomInt(rightRangeMin, rightRangeMax);

        if (op === 'add' && !allowCarry) {
          while (attempts < 50 && hasAdditionCarry(generatedLeft, generatedRight)) {
            generatedLeft = randomInt(leftRangeMin, leftRangeMax);
            generatedRight = randomInt(rightRangeMin, rightRangeMax);
            attempts += 1;
          }
        }
        if (op === 'sub') {
          if (generatedLeft < generatedRight) {
            [generatedLeft, generatedRight] = [generatedRight, generatedLeft];
          }
          if (!allowCarry) {
            while (attempts < 50 && hasSubtractionBorrow(generatedLeft, generatedRight)) {
              generatedLeft = randomInt(leftRangeMin, leftRangeMax);
              generatedRight = randomInt(rightRangeMin, rightRangeMax);
              if (generatedLeft < generatedRight) {
                [generatedLeft, generatedRight] = [generatedRight, generatedLeft];
              }
              attempts += 1;
            }
          }
        }
        left = generatedLeft;
        right = generatedRight;
        if (op === 'add') {
          answer = left + right;
        } else if (op === 'sub') {
          answer = left - right;
        } else {
          answer = left + right;
        }
      }

      let prompt: string;
      switch (op) {
        case 'add':
          prompt = `${left} + ${right} = ?`;
          break;
        case 'sub':
          prompt = `${left} - ${right} = ?`;
          break;
        case 'mul':
          prompt = `${left} × ${right} = ?`;
          break;
        case 'div':
          prompt = `${left} ÷ ${right} = ?`;
          break;
        default:
          prompt = `${left} + ${right} = ?`;
          break;
      }
      const instanceId = `session-${op}-${index}`;
      const numericAnswer = typeof answer === 'number' ? answer : Number(answer);
      const options = buildNumericOptions(numericAnswer);
      problems.push({
        concept,
        instance: {
          id: instanceId,
          template_id: `session-${op}`,
          concept: concept.id,
          step,
          prompt,
          explanation: '계산 규칙을 적용해 답을 구합니다.',
          answer: numericAnswer,
          options,
          context: 'life',
          lens: concept.lens,
          representation: 'C',
          rubric_keywords: concept.focus_keywords.length ? concept.focus_keywords : ['연산'],
          variables: { left, right, op },
        },
      });
    }

    return problems;
  };

  const generateProblemsFromSessionConfig = (
    concept: CurriculumConcept,
    step: StepID,
    sessionConfig: CourseSessionConfig | null
  ): CurriculumProblem[] | null => {
    if (!sessionConfig) {
      return null;
    }
    const explicitCount =
      typeof sessionConfig.problem_count === 'number' && Number.isFinite(sessionConfig.problem_count)
        ? sessionConfig.problem_count
        : null;
    const parameterCount =
      sessionConfig.parameters && typeof sessionConfig.parameters.count === 'number'
        ? Number(sessionConfig.parameters.count)
        : null;
    const targetCount = explicitCount ?? parameterCount ?? PROBLEMS_PER_STEP;
    if (sessionConfig.generator === 'arithmetic') {
      return generateArithmeticProblemSet(concept, step, sessionConfig, targetCount);
    }
    return null;
  };

  const generateProblemsForStep = async (
    concept: CurriculumConcept,
    step: StepID
  ): Promise<CurriculumProblem[]> => {
    const templates = await fetchTemplates(concept.id, step);
    if (!templates.length) {
      throw new Error(`템플릿이 없습니다: ${concept.id}/${step}`);
    }
    const pool = [...templates].sort(() => Math.random() - 0.5);
    const generated: CurriculumProblem[] = [];
    let index = 0;
    while (generated.length < PROBLEMS_PER_STEP) {
      const summary = pool[index % pool.length];
      const contexts = summary.context_pack.length ? summary.context_pack : ['life'];
      const contextChoice = contexts[generated.length % contexts.length];
      const seed = Math.floor(Math.random() * 1_000_000);
      try {
        const instance = await generateTemplateInstance(summary.id, {
          seed,
          context: contextChoice,
        });
        generated.push({ concept, instance });
      } catch (generationError) {
        console.warn('템플릿 생성 실패:', generationError);
      }
      index += 1;
      if (index > PROBLEMS_PER_STEP * Math.max(1, pool.length) * 2) {
        break;
      }
    }
    if (generated.length < PROBLEMS_PER_STEP && pool.length) {
      const fallbackSummary = pool[0];
      const contexts = fallbackSummary.context_pack.length ? fallbackSummary.context_pack : ['life'];
      while (generated.length < PROBLEMS_PER_STEP) {
        const contextChoice = contexts[generated.length % contexts.length];
        const seed = Math.floor(Math.random() * 1_000_000);
        try {
          const instance = await generateTemplateInstance(fallbackSummary.id, {
            seed,
            context: contextChoice,
          });
          generated.push({ concept, instance });
        } catch (retryError) {
          console.warn('템플릿 재생성 실패:', retryError);
          break;
        }
      }
    }
    if (!generated.length) {
      throw new Error('템플릿 생성에 모두 실패했습니다.');
    }
    return generated.slice(0, PROBLEMS_PER_STEP);
  };

  const loadProblemsForStep = async (
    concept: CurriculumConcept,
    step: StepID,
    options: LoadProblemsOptions = {}
  ) => {
    resetRoundState();
    setSelectedConcept(concept);
    setSelectedStep(step);
    setGameState('loading');
    setLoadError(null);
    setActiveSessionConfig(options.sessionConfig ?? null);

    let problems: CurriculumProblem[] | null = null;
    let problemsSource: 'session_config' | 'generated' | 'session_fallback' | 'local_fallback' = 'generated';

    const configured = generateProblemsFromSessionConfig(
      concept,
      step,
      options.sessionConfig ?? activeSessionConfig
    );
    if (configured && configured.length) {
      problems = configured;
      problemsSource = 'session_config';
    } else {
      try {
        const generated = await generateProblemsForStep(concept, step);
        if (!generated.length) {
          throw new Error('생성된 문제가 없습니다.');
        }
        problems = generated;
        problemsSource = 'generated';
      } catch (error) {
        console.error('문제 불러오기 실패:', error);
        setLoadError('커리큘럼 데이터를 불러오지 못했습니다. 예비 문제로 대체합니다.');
      }
    }

    if (!problems || !problems.length) {
      try {
        const session = await createSession(token ?? undefined);
        problems = convertSessionToCurriculum(session, concept, step);
        problemsSource = 'session_fallback';
      } catch (fallbackError) {
        console.error('Fallback session 불러오기 실패:', fallbackError);
        problems = generateLocalFallback(12, concept, step);
        problemsSource = 'local_fallback';
      }
    }

    if (!problems || !problems.length) {
      setGameState('finished');
      return;
    }

    setProblems(problems);
    setTotalQuestions(problems.length);
    setCurrentProblem(problems[0] ?? null);
    setGameState(problems.length ? 'playing' : 'finished');

    if (options.source === 'skill_node' || options.triggeredByTree) {
      trackSessionStartedFromTree({
        conceptId: concept.id,
        conceptName: concept.name,
        step,
        nodeId: options.sequenceEntry?.nodeId ?? `${concept.id}-${step}`,
        sequenceIndex: options.sequenceEntry ? curriculumSequence.indexOf(options.sequenceEntry) : null,
        triggeredBy: 'skill_node',
        available: true,
        completed: false,
        lens: concept.lens?.[0] ?? null,
      });
    }

    trackSkillViewed({
      conceptId: concept.id,
      conceptName: concept.name,
      step,
      nodeId: options.sequenceEntry?.nodeId ?? `${concept.id}-${step}`,
      source: options.source ?? 'unknown',
      sequenceIndex: options.sequenceEntry
        ? curriculumSequence.indexOf(options.sequenceEntry)
        : sequenceIndex,
      available: true,
      completed: false,
      lens: concept.lens?.[0] ?? null,
      problemCount: problems.length,
      problemsSource,
    });
  };

  const initialiseGame = async () => {
    setLoadError(null);
    try {
      const latestPromise = user
        ? fetchLatestLRC(user.id).catch((latestError) => {
            console.warn('Failed to fetch latest LRC result:', latestError);
            return null;
          })
        : Promise.resolve(null);

      const [latest, conceptList, curriculumGraph] = await Promise.all([
        latestPromise,
        fetchConcepts(),
        fetchCurriculumGraph(),
      ]);
      setLatestLRC(latest);

      if (!conceptList.length) {
        throw new Error('등록된 개념이 없습니다.');
      }

      const catalog = upsertConceptCatalog(conceptList);
      const sequence = buildCurriculumSequence(curriculumGraph.nodes ?? []);
      if (!sequence.length) {
        throw new Error('커리큘럼 노드가 없습니다.');
      }
      setCurriculumSequence(sequence);

      const requestedConceptId = requestedConceptParam && catalog[requestedConceptParam]
        ? requestedConceptParam
        : null;
      const requestedStep = requestedStepParam;

      const orderedConcepts = reorderConceptsBySequence(sequence, catalog);
      setConcepts(orderedConcepts);

      const preferredConcepts = [
        latest?.focus_concept ?? null,
        ...PREFERRED_CONCEPTS,
      ].filter((value): value is string => Boolean(value));

      if (requestedConceptId && requestedStep) {
        const targetConcept = catalog[requestedConceptId];
        if (targetConcept) {
          const targetIndex = sequence.findIndex(
            (entry) => entry.conceptId === requestedConceptId && entry.step === requestedStep
          );
          const targetEntry = targetIndex !== -1 ? sequence[targetIndex] : null;
          await loadProblemsForStep(targetConcept, requestedStep, {
            source: 'query_param',
            sequenceEntry: targetEntry,
          });
          if (targetIndex !== -1) {
            setSequenceIndex(targetIndex);
          }
          return;
        }
      }

      const pickNextIndex = (candidates: string[]): number => {
        for (const conceptId of candidates) {
          const nextStep = determineNextStepForConcept(conceptId) ?? 'S1';
          const idx = sequence.findIndex(
            (entry) => entry.conceptId === conceptId && entry.step === nextStep
          );
          if (idx !== -1) {
            return idx;
          }
        }
        return sequence.findIndex(
          (entry) => !isStepCompleted(entry.conceptId, entry.step)
        );
      };

      let startingIndex = pickNextIndex(preferredConcepts);
      if (startingIndex < 0) {
        startingIndex = 0;
      }
      const startingEntry = sequence[startingIndex];
      const startingConcept =
        catalog[startingEntry.conceptId] ??
        conceptList.find((concept) => concept.id === startingEntry.conceptId) ??
        conceptList[0] ??
        FALLBACK_CONCEPT;

      await loadProblemsForStep(startingConcept, startingEntry.step, {
        source: 'initial',
        sequenceEntry: startingEntry,
      });
      setSequenceIndex(startingIndex);
    } catch (error) {
      console.error('초기 문제 준비 실패:', error);
      setLatestLRC(null);
      setConcepts([FALLBACK_CONCEPT]);
      setConceptCatalog({ [FALLBACK_CONCEPT.id]: FALLBACK_CONCEPT });
      setCurriculumSequence([
        {
          conceptId: FALLBACK_CONCEPT.id,
          step: 'S1',
          nodeId: 'FALLBACK-S1',
          label: '기본 덧셈 · S1',
          lens: FALLBACK_CONCEPT.lens,
        },
      ]);
      resetRoundState();
      setSelectedConcept(FALLBACK_CONCEPT);
      setSelectedStep('S1');
      const fallbackProblems = generateLocalFallback(12, FALLBACK_CONCEPT, 'S1');
      setProblems(fallbackProblems);
      setTotalQuestions(fallbackProblems.length);
      setCurrentProblem(fallbackProblems[0] ?? null);
      setGameState(fallbackProblems.length ? 'playing' : 'finished');
      setSequenceIndex(0);
      setLoadError('기본 문제 세트로 시작합니다.');
      trackSkillViewed({
        conceptId: FALLBACK_CONCEPT.id,
        conceptName: FALLBACK_CONCEPT.name,
        step: 'S1',
        nodeId: 'FALLBACK-S1',
        source: 'initial',
        sequenceIndex: 0,
        available: true,
        completed: false,
        lens: FALLBACK_CONCEPT.lens?.[0] ?? null,
        problemCount: fallbackProblems.length,
        problemsSource: 'local_fallback',
      });
    }
  };

  useEffect(() => {
    void initialiseGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, requestedConceptParam, requestedStepParam]);

  const handleConceptSelect = async (conceptId: string) => {
    const concept = conceptCatalog[conceptId];
    if (!concept) {
      return;
    }
    const nextStep = determineNextStepForConcept(conceptId) ?? 'S1';
    const { entry, index } = findSequenceInfo(conceptId, nextStep);
    await loadProblemsForStep(concept, nextStep, {
      source: 'concept_tab',
      sequenceEntry: entry,
    });
    if (index !== null) {
      setSequenceIndex(index);
    }
  };

  const handleStepSelect = async (conceptId: string, step: StepID) => {
    if (!isStepAvailable(conceptId, step)) {
      return;
    }
    const concept =
      conceptCatalog[conceptId] ?? (conceptId === FALLBACK_CONCEPT.id ? FALLBACK_CONCEPT : null);
    if (!concept) {
      return;
    }
    if (selectedConcept?.id === conceptId && selectedStep === step && gameState === 'playing') {
      return;
    }
    const { entry, index } = findSequenceInfo(conceptId, step);
    await loadProblemsForStep(concept, step, {
      source: 'skill_node',
      sequenceEntry: entry,
      triggeredByTree: 'skill_node',
    });
    if (index !== null) {
      setSequenceIndex(index);
    }
  };

  const startNextStep = () => {
    if (!curriculumSequence.length) {
      return;
    }
    const currentIndex = sequenceIndex ?? -1;
    const findNextIndex = (start: number) =>
      curriculumSequence.findIndex((entry, idx) => {
        if (idx < start) {
          return false;
        }
        if (isStepCompleted(entry.conceptId, entry.step)) {
          return false;
        }
        return isStepAvailable(entry.conceptId, entry.step);
      });

    let nextIndex = findNextIndex(currentIndex + 1);
    if (nextIndex === -1) {
      nextIndex = findNextIndex(0);
    }
    if (nextIndex === -1) {
      return;
    }
    const nextEntry = curriculumSequence[nextIndex];
    const concept =
      conceptCatalog[nextEntry.conceptId] ??
      (nextEntry.conceptId === FALLBACK_CONCEPT.id ? FALLBACK_CONCEPT : null);
    if (!concept) {
      return;
    }
    void (async () => {
      await loadProblemsForStep(concept, nextEntry.step, {
        source: 'auto_progress',
        sequenceEntry: nextEntry,
      });
      setSequenceIndex(nextIndex);
    })();
  };

  useEffect(() => {
    if (gameState !== 'playing') {
      return;
    }
    if (!currentProblem) {
      return;
    }
    if (timeLeft <= 0) {
      finalizeCurrentProblem(null, true);
      return;
    }
    const timer = window.setTimeout(() => {
      setTimeLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, gameState, currentProblem?.instance.id]);

  const currentProblemId = currentProblem?.instance.id;

  useEffect(() => {
    if (!currentProblemId || gameState !== 'playing') {
      return;
    }
    questionStartRef.current = performance.now();
    focusStartRef.current = null;
    hintRevealedRef.current = false;
    explanationValueRef.current = '';
    setExplanationInput('');
    setShowKeywordHints(false);
  }, [currentProblemId, gameState]);

  useEffect(() => {
    explanationValueRef.current = explanationInput;
  }, [explanationInput]);

  useEffect(() => {
    if (gameState === 'playing' && currentProblemId) {
      inputRef.current?.focus();
    }
  }, [gameState, currentProblemId]);

  const finalizeCurrentProblem = (chosenAnswer: number | null, timedOut = false) => {
    if (!currentProblem) {
      return;
    }

    const question = currentProblem.instance;
    const actualAnswer = question.answer;
    const explanation = explanationValueRef.current.trim();
    const rubricKeywords = question.rubric_keywords ?? [];
    const keywordsAvailable = rubricKeywords.length;
    const keywordMatches = countKeywordMatches(explanation, rubricKeywords);

    const now = performance.now();
    const start = focusStartRef.current ?? questionStartRef.current;
    const reactionTimeMs = start !== null ? Math.max(0, Math.round(now - start)) : null;
    const focusDelayMs =
      focusStartRef.current !== null && questionStartRef.current !== null
        ? Math.max(0, Math.round(focusStartRef.current - questionStartRef.current))
        : null;
    const fallbackSeconds = timedOut
      ? QUESTION_TIME_LIMIT
      : Math.min(QUESTION_TIME_LIMIT, Math.max(0, QUESTION_TIME_LIMIT - timeLeft));
    const secondsElapsed = reactionTimeMs !== null
      ? Math.min(QUESTION_TIME_LIMIT, reactionTimeMs / 1000)
      : fallbackSeconds;
    const timeLimitMs = QUESTION_TIME_LIMIT * 1000;

    setUserAnswers((prev) => ({
      ...prev,
      [question.id]: chosenAnswer
    }));
    setExplanations((prev) => ({
      ...prev,
      [question.id]: explanation
    }));
    setHintUsage((prev) => ({
      ...prev,
      [question.id]: hintRevealedRef.current
    }));
    setTimeSpentHistory((prev) => [...prev, secondsElapsed]);

    const isCorrect = !timedOut && chosenAnswer === actualAnswer;

    setFeedback({
      prompt: question.prompt,
      conceptName: currentProblem.concept.name,
      step: question.step,
      correctAnswer: actualAnswer,
      userAnswer: chosenAnswer,
      isCorrect,
      explanation,
      keywordsMatched: keywordMatches,
      keywordsAvailable,
      hintUsed: hintRevealedRef.current
    });

    setCorrectCount((prev) => (isCorrect ? prev + 1 : prev));
    setScore((prev) =>
      isCorrect ? prev + 10 + Math.floor((QUESTION_TIME_LIMIT - secondsElapsed) / 3) : prev
    );

    if (typeof window !== 'undefined' && window.analytics) {
      const rtPayload: Record<string, unknown> = {
        problem_id: question.id,
        concept_id: currentProblem.concept.id,
        step: question.step,
        lens: question.lens?.[0],
        time_limit_ms: timeLimitMs,
        timed_out,
        correct: isCorrect,
        hint_used: hintRevealedRef.current || undefined
      };
      if (reactionTimeMs !== null) {
        rtPayload.rt_ms = reactionTimeMs;
      }
      if (focusDelayMs !== null) {
        rtPayload.focus_delay_ms = focusDelayMs;
      }
      window.analytics.trackProblemRT?.(rtPayload);

      window.analytics.trackProblemExplanation?.({
        problem_id: question.id,
        concept_id: currentProblem.concept.id,
        step: question.step,
        length: explanation.length,
        keywords_available: keywordsAvailable,
        keywords_matched: keywordMatches,
        hint_used: hintRevealedRef.current || undefined
      });
    }

    const nextIndex = currentIndex + 1;
    const nextProblem = problems[nextIndex] ?? null;

    setTimeLeft(QUESTION_TIME_LIMIT);
    setCurrentIndex(nextIndex);
    setCurrentProblem(nextProblem);
    setAnswerInput('');
    setExplanationInput('');
    explanationValueRef.current = '';
    focusStartRef.current = null;
    questionStartRef.current = null;
    hintRevealedRef.current = false;
    setShowKeywordHints(false);

    if (nextProblem) {
      setGameState('playing');
    } else {
      setGameState('finished');
    }
  };

  const handleExplanationChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setExplanationInput(value);
    explanationValueRef.current = value;
  };

  const handleToggleKeywordHints = () => {
    setShowKeywordHints((prev) => {
      const next = !prev;
      if (next) {
        hintRevealedRef.current = true;
      }
      return next;
    });
  };

  const handleAnswerFocus = () => {
    if (focusStartRef.current === null) {
      focusStartRef.current = performance.now();
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setAnswerInput(event.target.value);
  };

  const handleConfirmAnswer = () => {
    const trimmed = answerInput.trim();
    if (!trimmed) {
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return;
    }
    finalizeCurrentProblem(parsed, false);
  };

  const handleOptionSelect = (option: number) => {
    setAnswerInput(option.toString());
    window.setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleAnswerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleConfirmAnswer();
    }
  };

  const handleSubmitResults = async () => {
    setIsSubmitted(true);
    setGameState('submitted');

    if (!totalQuestions) {
      return;
    }

    if (selectedConcept && selectedStep) {
      markStepCompleted(selectedConcept.id, selectedStep);
    }

    const accuracy = totalQuestions ? correctCount / totalQuestions : 0;
    const averageTime = timeSpentHistory.length
      ? timeSpentHistory.reduce((acc, value) => acc + value, 0) / timeSpentHistory.length
      : QUESTION_TIME_LIMIT;
    const rtPercentile = Math.min(
      1,
      Math.max(0, 1 - averageTime / QUESTION_TIME_LIMIT)
    );
    const rubricScore = accuracy >= 0.9 ? 0.85 : accuracy >= 0.75 ? 0.7 : 0.55;

    setIsEvaluating(true);
    try {
      const focusConceptId = resolveFocusConcept(latestLRC, problems[0]?.concept.id ?? null);
      const response = await evaluateLRC({
        accuracy,
        rt_percentile: rtPercentile,
        rubric: rubricScore,
        user_id: user?.id,
        focus_concept: focusConceptId ?? undefined
      });
      setLrcResult(response);
      setLatestLRC(response);
      setLrcError(null);
      if (response.passed && selectedConcept && selectedStep === 'S3') {
        const { entry, index } = findSequenceInfo(selectedConcept.id, selectedStep);
        trackBossPassed({
          conceptId: selectedConcept.id,
          conceptName: selectedConcept.name,
          step: selectedStep,
          nodeId: entry?.nodeId ?? `${selectedConcept.id}-${selectedStep}`,
          sequenceIndex: index,
          status: response.status,
          recommendation: response.recommendation,
          metrics: {
            accuracy,
            rt_percentile: rtPercentile,
            rubric: rubricScore,
          },
          score,
          totalQuestions,
          correctCount,
        });
      }
    } catch (error) {
      console.error('LRC evaluation failed:', error);
      setLrcError('LRC 평가 호출에 실패했습니다. 나중에 다시 시도해주세요.');
      setLrcResult(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  const restartGame = () => {
    if (selectedConcept && selectedStep) {
      const { entry } = findSequenceInfo(selectedConcept.id, selectedStep);
      void loadProblemsForStep(selectedConcept, selectedStep, {
        source: 'restart',
        sequenceEntry: entry,
      });
      return;
    }
    void initialiseGame();
  };

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  const completedNodeIds = useMemo(() => {
    return Object.entries(completedStepsByConcept).flatMap(([conceptId, steps]) =>
      steps.map((step) => `${conceptId}-${step}`)
    );
  }, [completedStepsByConcept]);

  const conceptNames = useMemo(() => {
    return Object.values(conceptCatalog).reduce<Record<string, string>>((accumulator, concept) => {
      accumulator[concept.id] = concept.name;
      return accumulator;
    }, {});
  }, [conceptCatalog]);

  const selectedConceptId = selectedConcept?.id ?? null;
  const selectedNodeId = selectedConcept && selectedStep ? `${selectedConcept.id}-${selectedStep}` : null;

  const nextStepCandidate = useMemo(() => {
    if (!selectedConcept || !selectedStep) {
      return null;
    }
    return getNextSequentialStep(selectedStep);
  }, [selectedConcept, selectedStep]);

  const canStartNextStep = useMemo(() => {
    if (!selectedConcept || !nextStepCandidate) {
      return false;
    }
    return isStepAvailable(selectedConcept.id, nextStepCandidate);
  }, [selectedConcept, nextStepCandidate]);

  const accuracyPercent = useMemo(() => {
    return totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0;
  }, [correctCount, totalQuestions]);

  const renderFeedback = () => {
    if (!feedback) {
      return null;
    }
    return (
      <div className={`feedback ${feedback.isCorrect ? 'correct' : 'incorrect'}`}>
        <h2>{feedback.isCorrect ? '정답입니다! 👍' : '아쉬워요! 다음에는 맞을 수 있어요.'}</h2>
        <p>개념: {feedback.conceptName} · {STEP_LABEL[feedback.step] ?? feedback.step}</p>
        <p>이전 문제: {feedback.prompt}</p>
        <p>정답: {feedback.correctAnswer}</p>
        <p>내 답: {feedback.userAnswer ?? '미응답'}</p>
        <p>내 설명: {feedback.explanation ? feedback.explanation : '작성하지 않았어요'}</p>
        {feedback.keywordsAvailable > 0 && (
          <p>키워드 매칭: {feedback.keywordsMatched}/{feedback.keywordsAvailable}</p>
        )}
        <p>힌트 사용: {feedback.hintUsed ? '예' : '아니오'}</p>
      </div>
    );
  };

  if (gameState === 'loading') {
    return (
      <div className="math-game">
        <div className="loading-container">
          <h2>문제를 준비하고 있습니다...</h2>
          <div className="loading-spinner" />
        </div>
      </div>
    );
  }

  const questionNumber = Math.min(currentIndex + 1, totalQuestions);
  const trimmedAnswer = answerInput.trim();
  const parsedAnswer = Number(trimmedAnswer);
  const canSubmit = trimmedAnswer !== '' && Number.isFinite(parsedAnswer);
  const lensBadges = currentProblem ? getLensBadges(currentProblem.instance.lens) : [];
  const rubricKeywords = currentProblem?.instance.rubric_keywords ?? [];
  const keywordHintId = showKeywordHints && currentProblemId ? `keyword-hints-${currentProblemId}` : undefined;
  const lrcCopy = lrcResult
    ? LRC_STATUS_MESSAGES[lrcResult.status] ?? {
        title: 'LRC 평가 결과',
        body: '세부 지표를 확인해주세요.'
      }
    : null;
  const lrcRecommendationKey = lrcResult?.recommendation as RecommendationKey | undefined;
  const lrcRecommendationCopy = lrcResult
    ? lrcRecommendationKey
      ? LRC_RECOMMENDATION_LABELS[lrcRecommendationKey]
      : lrcResult.recommendation
    : null;
  const progressPercent = totalQuestions
    ? Math.min(100, Math.max(0, Math.round((questionNumber / totalQuestions) * 100)))
    : 0;

  return (
    <div className="math-game">
      <header className="game-header">
        <div className="game-info" role="group" aria-label="현재 진행 상황">
          <div className="info-item">
            <Target size={20} />
            <span>문제 {Math.max(1, questionNumber)}/{totalQuestions || 1}</span>
          </div>
          <div className="info-item">
            <Clock size={20} />
            <span>{timeLeft}초</span>
          </div>
        </div>
        <div className="progress-indicator">
          <span className="progress-label">진행률</span>
          <div
            className="progress-bar"
            role="progressbar"
            aria-label="문제 풀이 진행률"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="progress-bar__fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      </header>

      {loadError && (
        <div className="alert alert-warning">
          {loadError}
        </div>
      )}

      <div className="game-content">
        {concepts.length > 0 && (
          <section className="skill-tree-panel" aria-labelledby="skill-tree-heading">
            <div className="skill-tree-panel__header">
              <h2 id="skill-tree-heading">
                {selectedConcept ? `${selectedConcept.name} 단계` : '학습 단계'}
              </h2>
              <p className="skill-tree-panel__summary">
                {selectedConcept?.summary
                  ? selectedConcept.summary
                  : 'S1부터 차례로 도전하면 다음 단계가 자동으로 열립니다.'}
              </p>
            </div>
            <div className="concept-selector" role="tablist" aria-label="학습 개념 선택">
              {concepts.map((concept) => {
                const isActive = selectedConceptId === concept.id;
                return (
                  <button
                    key={concept.id}
                    type="button"
                    className={`concept-tab${isActive ? ' concept-tab--active' : ''}`}
                    onClick={() => {
                      void handleConceptSelect(concept.id);
                    }}
                    aria-pressed={isActive}
                  >
                    {concept.name}
                  </button>
                );
              })}
            </div>
            <SkillTree
              completedNodes={completedNodeIds}
              focusConceptId={latestLRC?.focus_concept ?? null}
              conceptNames={conceptNames}
              activeConceptId={selectedConceptId}
              selectedNodeId={selectedNodeId}
              onSelectStep={handleStepSelect}
            />
          </section>
        )}

        {gameState === 'playing' && currentProblem && (
          <div className="problem-container">
            <div className="problem-display">
              <div className="problem-meta">
                <span className="concept-chip">{currentProblem.concept.name}</span>
                <span className="step-chip">{STEP_LABEL[currentProblem.instance.step] ?? currentProblem.instance.step}</span>
                <div className="lens-badges" role="list" aria-label="렌즈 분류">
                  {lensBadges.map((badge) => (
                    <span key={badge.id} className="lens-badge" role="listitem" title={`${badge.label} 렌즈`}>
                      <span aria-hidden="true" className="lens-icon">{badge.icon}</span>
                      <span className="lens-label">{badge.label}</span>
                    </span>
                  ))}
                </div>
              </div>
              <h2>{currentProblem.instance.prompt}</h2>
              <p className="context-text">컨텍스트: {currentProblem.instance.context}</p>
            </div>

            <div className="answer-form" role="form" aria-label="정답 제출 폼">
              <div className="explanation-block">
                <div className="explanation-header">
                  <label className="explanation-label" htmlFor="explanation-input">
                    어떻게 풀었나요?
                  </label>
                  {rubricKeywords.length > 0 && (
                    <button
                      type="button"
                      className="hint-toggle"
                      onClick={handleToggleKeywordHints}
                    >
                      {showKeywordHints ? '힌트 숨기기' : '키워드 힌트'}
                    </button>
                  )}
                </div>
                {showKeywordHints && (
                  <div className="keyword-hints" id={keywordHintId}>
                    {rubricKeywords.join(', ')}
                  </div>
                )}
                <textarea
                  id="explanation-input"
                  className="explanation-input"
                  value={explanationInput}
                  onChange={handleExplanationChange}
                  placeholder="생각한 방법을 간단히 적어보세요"
                  rows={3}
                  aria-label="풀이 설명 입력"
                  aria-describedby={keywordHintId}
                />
              </div>
              <input
                ref={inputRef}
                className="answer-input"
                type="text"
                inputMode="numeric"
                pattern="-?[0-9]*"
                value={answerInput}
                onChange={handleInputChange}
                onFocus={handleAnswerFocus}
                onKeyDown={handleAnswerKeyDown}
                placeholder="정답을 입력하세요"
                aria-label="정답 입력"
              />

              {!!currentProblem.instance.options?.length && (
                <div className="options-container">
                  {currentProblem.instance.options.map((option) => {
                    const isSelected = canSubmit && parsedAnswer === option;
                    return (
                      <button
                        key={option}
                        onClick={() => handleOptionSelect(option)}
                        className={`option-button ${isSelected ? 'selected' : ''}`}
                        type="button"
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                disabled={!canSubmit}
                className="submit-button"
                type="button"
                onClick={handleConfirmAnswer}
              >
                확인
              </button>
            </div>

            {renderFeedback()}
          </div>
        )}

        {gameState === 'finished' && !isSubmitted && (
          <div className="submit-results">
            <h2>모든 문제를 풀었습니다! 🎉</h2>
            <p>결과를 확인하려면 제출 버튼을 눌러주세요.</p>
            <button onClick={handleSubmitResults} className="submit-results-button" type="button">
              제출
            </button>
            <div className="submit-results-stats" aria-live="polite">
              <p>정답률 미리보기: {accuracyPercent}%</p>
              <p>맞은 문제: {correctCount}개 / {totalQuestions}개</p>
            </div>
            {renderFeedback()}
          </div>
        )}

        {gameState === 'submitted' && (
          <div className="game-result">
            <h2>게임 완료! 🎊</h2>
            <div className="final-score">
              <h3>최종 점수: {score}점</h3>
              <p>정답률: {accuracyPercent}%</p>
              <p>맞은 문제: {correctCount}개 / {totalQuestions}개</p>
              <p>평균 풀이 시간: {timeSpentHistory.length ? (timeSpentHistory.reduce((acc, value) => acc + value, 0) / timeSpentHistory.length).toFixed(1) : QUESTION_TIME_LIMIT}초</p>
            </div>
            {renderFeedback()}

            {isEvaluating && (
              <div className="alert alert-info">LRC 평가를 계산 중입니다...</div>
            )}

            {lrcResult && lrcCopy && (
              <div className="lrc-result">
                <div className={`lrc-tier ${lrcResult.status}`}>
                  {lrcResult.status.toUpperCase()}
                </div>
                <h3>{lrcCopy.title}</h3>
                <p className="lrc-description">{lrcCopy.body}</p>
                {!lrcResult.passed && lrcRecommendationCopy && (
                  <p className="lrc-recommendation">권장 조치: {lrcRecommendationCopy}</p>
                )}
                <div className="lrc-metrics">
                  {Object.entries(lrcResult.metrics).map(([key, metric]) => (
                    <div key={key} className="metric-card">
                      <span className="metric-label">{key}</span>
                      <span className="metric-value">{Math.round(metric.value * 100)}%</span>
                      <span className={`metric-status ${metric.met ? 'ok' : 'warn'}`}>
                        기준 {Math.round(metric.threshold * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lrcError && (
              <div className="alert alert-warning">{lrcError}</div>
            )}

            <section className="skill-tree-section">
              <h3>학습 스킬 트리</h3>
              <p className="skill-tree-description">
                이번 세션에서 학습한 단계와 이어질 다음 스텝을 살펴보세요.
              </p>
              <SkillTree
                completedNodes={completedNodeIds}
                focusConceptId={latestLRC?.focus_concept ?? null}
                conceptNames={conceptNames}
                activeConceptId={selectedConceptId}
                selectedNodeId={selectedNodeId}
                onSelectStep={handleStepSelect}
              />
            </section>

            <div className="problem-results">
              <h3>문제별 결과:</h3>
              <div className="results-grid">
                {problems.map((problem, index) => {
                  const userAnswer = userAnswers[problem.instance.id];
                  const isCorrect = userAnswer === problem.instance.answer;
                  const explanation = explanations[problem.instance.id] ?? '';
                  const hintUsed = hintUsage[problem.instance.id] ?? false;
                  const keywordsAvailable = problem.instance.rubric_keywords?.length ?? 0;
                  const keywordMatches = explanation
                    ? countKeywordMatches(explanation, problem.instance.rubric_keywords ?? [])
                    : 0;
                  return (
                    <div key={problem.instance.id} className={`result-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                      <span className="result-title">
                        문제 {index + 1}: {problem.concept.name} · {STEP_LABEL[problem.instance.step] ?? problem.instance.step}
                      </span>
                      <span className="result-prompt">{problem.instance.prompt}</span>
                      <span>정답: {problem.instance.answer}</span>
                      <span>내 답: {userAnswer ?? '미응답'}</span>
                      <span>설명: {explanation || '작성하지 않음'}</span>
                      {keywordsAvailable > 0 && (
                        <span>키워드 매칭: {keywordMatches}/{keywordsAvailable}</span>
                      )}
                      <span>힌트 사용: {hintUsed ? '예' : '아니오'}</span>
                      <span>렌즈: {getLensBadgeTokens(problem.instance.lens)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="result-actions">
              {canStartNextStep && (
                <button onClick={startNextStep} className="next-step-button" type="button">
                  다음 단계 시작
                </button>
              )}
              <button onClick={restartGame} className="restart-button" type="button">
                다시 하기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MathGame;
