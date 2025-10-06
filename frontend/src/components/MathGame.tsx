import {
  ArrowLeft,
  Clock,
  Target,
  Compass
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type {
  APISession,
  CurriculumConcept,
  GeneratedItem,
  LRCEvaluation
} from '../types';
import {
  createSession,
  evaluateLRC,
  fetchConcepts,
  fetchTemplates,
  fetchLatestLRC,
  generateTemplateInstance
} from '../utils/api';
import {
  DEFAULT_STEP_ORDER,
  limitPracticeToFocus,
  reorderConcepts,
  resolveFocusConcept,
  stepsForConcept
} from '../utils/curriculum';
import './MathGame.css';

const STEP_LABEL: Record<string, string> = {
  S1: 'S1 · 기초',
  S2: 'S2 · 브리지',
  S3: 'S3 · 전이'
};
const PREFERRED_CONCEPTS = ['ALG-AP', 'RAT-PRO', 'GEO-LIN'];

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

interface CurriculumProblem {
  concept: CurriculumConcept;
  instance: GeneratedItem;
}

const MathGame: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [gameState, setGameState] = useState<'loading' | 'playing' | 'finished' | 'submitted'>('loading');
  const [problems, setProblems] = useState<CurriculumProblem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentProblem, setCurrentProblem] = useState<CurriculumProblem | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_LIMIT);
  const [timeSpentHistory, setTimeSpentHistory] = useState<number[]>([]);

  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number | null>>({});

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [lrcResult, setLrcResult] = useState<LRCEvaluation | null>(null);
  const [lrcError, setLrcError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [latestLRC, setLatestLRC] = useState<LRCEvaluation | null>(null);

  const resetGameState = () => {
    setScore(0);
    setStreak(0);
    setCorrectCount(0);
    setUserAnswers({});
    setSelectedAnswer(null);
    setTimeSpentHistory([]);
    setLrcResult(null);
    setLrcError(null);
    setIsSubmitted(false);
    setCurrentIndex(0);
    setCurrentProblem(null);
    setTimeLeft(QUESTION_TIME_LIMIT);
  };

  const pickConcepts = (concepts: CurriculumConcept[], focusConceptId: string | null): CurriculumConcept[] => {
    return reorderConcepts(concepts, PREFERRED_CONCEPTS, focusConceptId).slice(0, 3);
  };

  const generateCurriculumProblems = async (
    latestEvaluation: LRCEvaluation | null
  ): Promise<CurriculumProblem[]> => {
    const concepts = await fetchConcepts();
    if (!concepts.length) {
      throw new Error('등록된 개념이 없습니다.');
    }

    const focusConceptId = latestEvaluation?.focus_concept ?? null;
    const conceptSelection = pickConcepts(concepts, focusConceptId);
    const generated: CurriculumProblem[] = [];
    const limitToFocus = limitPracticeToFocus(latestEvaluation?.recommendation);

    for (const concept of conceptSelection) {
      const isFocus = focusConceptId !== null && concept.id === focusConceptId;
      const steps = stepsForConcept(latestEvaluation?.recommendation, isFocus, DEFAULT_STEP_ORDER);

      for (const step of steps) {
        const templates = await fetchTemplates(concept.id, step);
        if (!templates.length) {
          continue;
        }
        const template = templates[Math.floor(Math.random() * templates.length)];
        const seed = Math.floor(Math.random() * 1_000_000);
        const instance = await generateTemplateInstance(template.id, { seed });
        generated.push({ concept, instance });
      }

      if (limitToFocus && isFocus) {
        break;
      }
    }

    return generated;
  };

  const convertSessionToCurriculum = (session: APISession): CurriculumProblem[] => {
    return session.problems.map((problem, index) => ({
      concept: FALLBACK_CONCEPT,
      instance: {
        id: `${FALLBACK_TEMPLATE_ID}-${index}`,
        template_id: FALLBACK_TEMPLATE_ID,
        concept: FALLBACK_CONCEPT.id,
        step: 'S1',
        prompt: `${problem.left} + ${problem.right} = ?`,
        explanation: '두 수를 더해 답을 구합니다.',
        answer: problem.answer,
        options: problem.options,
        context: 'life',
        lens: FALLBACK_CONCEPT.lens,
        representation: 'C',
        rubric_keywords: ['덧셈'],
        variables: {
          left: problem.left,
          right: problem.right
        }
      }
    }));
  };

  const generateLocalFallback = (count: number): CurriculumProblem[] => {
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
        concept: FALLBACK_CONCEPT,
        instance: {
          id: `${FALLBACK_TEMPLATE_ID}-local-${index}`,
          template_id: FALLBACK_TEMPLATE_ID,
          concept: FALLBACK_CONCEPT.id,
          step: 'S1',
          prompt: `${left} + ${right} = ?`,
          explanation: '두 수를 더해 답을 구합니다.',
          answer,
          options: Array.from(options),
          context: 'life',
          lens: FALLBACK_CONCEPT.lens,
          representation: 'C',
          rubric_keywords: ['덧셈'],
          variables: {
            left,
            right
          }
        }
      };
    });
  };

  const loadProblems = async () => {
    resetGameState();
    setLoadError(null);
    setGameState('loading');

    try {
      let latest: LRCEvaluation | null = null;
      if (user) {
        try {
          latest = await fetchLatestLRC(user.id);
        } catch (latestError) {
          console.warn('Failed to fetch latest LRC result:', latestError);
        }
      }
      setLatestLRC(latest);

      const generated = await generateCurriculumProblems(latest);
      if (!generated.length) {
        throw new Error('생성된 문제가 없습니다.');
      }
      setProblems(generated);
      setCurrentProblem(generated[0]);
      setTotalQuestions(generated.length);
      setGameState('playing');
    } catch (error) {
      console.error('Curriculum generation failed:', error);
      setLoadError('커리큘럼 데이터를 불러오지 못했습니다. 덧셈 예비 문제로 대체합니다.');
      try {
        const session = await createSession();
        const fallback = convertSessionToCurriculum(session);
        setProblems(fallback);
        setCurrentProblem(fallback[0] ?? null);
        setTotalQuestions(fallback.length);
        setGameState(fallback.length ? 'playing' : 'finished');
      } catch (fallbackError) {
        console.error('Fallback session failed:', fallbackError);
        const localFallback = generateLocalFallback(12);
        setProblems(localFallback);
        setCurrentProblem(localFallback[0] ?? null);
        setTotalQuestions(localFallback.length);
        setGameState(localFallback.length ? 'playing' : 'finished');
      }
      setLatestLRC(null);
    }
  };

  useEffect(() => {
    loadProblems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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

  useEffect(() => {
    if (gameState !== 'playing') {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (selectedAnswer !== null) {
          finalizeCurrentProblem(selectedAnswer, false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, selectedAnswer]);

  const finalizeCurrentProblem = (chosenAnswer: number | null, timedOut = false) => {
    if (!currentProblem) {
      return;
    }
    const question = currentProblem.instance;
    const actualAnswer = question.answer;
    const timeUsed = timedOut
      ? QUESTION_TIME_LIMIT
      : Math.min(
          QUESTION_TIME_LIMIT,
          Math.max(0, QUESTION_TIME_LIMIT - timeLeft)
        );

    setUserAnswers((prev) => ({
      ...prev,
      [question.id]: chosenAnswer
    }));
    setTimeSpentHistory((prev) => [...prev, timeUsed]);

    const isCorrect = !timedOut && chosenAnswer === actualAnswer;

    setCorrectCount((prev) => (isCorrect ? prev + 1 : prev));
    setScore((prev) =>
      isCorrect ? prev + 10 + Math.floor((QUESTION_TIME_LIMIT - timeUsed) / 3) : prev
    );
    setStreak((prev) => (isCorrect ? prev + 1 : 0));

    const nextIndex = currentIndex + 1;
    const nextProblem = problems[nextIndex] ?? null;

    setSelectedAnswer(null);
    setTimeLeft(QUESTION_TIME_LIMIT);
    setCurrentIndex(nextIndex);
    setCurrentProblem(nextProblem);

    if (nextProblem) {
      setGameState('playing');
    } else {
      setGameState('finished');
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (selectedAnswer === null) {
      return;
    }
    finalizeCurrentProblem(selectedAnswer, false);
  };

  const handleOptionSelect = (option: number) => {
    setSelectedAnswer(option);
  };

  const handleSubmitResults = async () => {
    setIsSubmitted(true);
    setGameState('submitted');

    if (!totalQuestions) {
      return;
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
    } catch (error) {
      console.error('LRC evaluation failed:', error);
      setLrcError('LRC 평가 호출에 실패했습니다. 나중에 다시 시도해주세요.');
      setLrcResult(null);
    } finally {
      setIsEvaluating(false);
    }
  };

  const restartGame = () => {
    loadProblems();
  };

  const goBack = () => {
    navigate('/student');
  };

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

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

  return (
    <div className="math-game">
      <header className="game-header">
        <button onClick={goBack} className="back-button" type="button">
          <ArrowLeft size={24} />
        </button>
        <div className="game-info">
          <div className="info-item">
            <Target size={20} />
            <span>문제 {Math.max(1, questionNumber)}/{totalQuestions || 1}</span>
          </div>
          <div className="info-item">
            <Clock size={20} />
            <span>{timeLeft}초</span>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="alert alert-warning">
          {loadError}
        </div>
      )}

      <div className="game-content">
        {gameState === 'playing' && currentProblem && (
          <div className="problem-container">
            <div className="problem-display">
              <div className="problem-meta">
                <span className="concept-chip">{currentProblem.concept.name}</span>
                <span className="step-chip">{STEP_LABEL[currentProblem.instance.step] ?? currentProblem.instance.step}</span>
                <span className="lens-chip">
                  <Compass size={16} /> {currentProblem.instance.lens.join(', ')}
                </span>
              </div>
              <h2>{currentProblem.instance.prompt}</h2>
              <p className="context-text">컨텍스트: {currentProblem.instance.context}</p>
            </div>

            <div className="options-container">
              {currentProblem.instance.options.map((option) => (
                <button
                  key={option}
                  onClick={() => handleOptionSelect(option)}
                  className={`option-button ${selectedAnswer === option ? 'selected' : ''}`}
                  type="button"
                >
                  {option}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              className="submit-button"
              type="button"
            >
              확인
            </button>
          </div>
        )}

        {gameState === 'finished' && !isSubmitted && (
          <div className="submit-results">
            <h2>모든 문제를 풀었습니다! 🎉</h2>
            <p>결과를 확인하려면 제출 버튼을 눌러주세요.</p>
            <button onClick={handleSubmitResults} className="submit-results-button" type="button">
              제출
            </button>
          </div>
        )}

        {gameState === 'submitted' && (
          <div className="game-result">
            <h2>게임 완료! 🎊</h2>
            <div className="final-score">
              <h3>최종 점수: {score}점</h3>
              <p>정답률: {totalQuestions ? Math.round((correctCount / totalQuestions) * 100) : 0}%</p>
              <p>맞은 문제: {correctCount}개 / {totalQuestions}개</p>
              <p>평균 풀이 시간: {timeSpentHistory.length ? (timeSpentHistory.reduce((acc, value) => acc + value, 0) / timeSpentHistory.length).toFixed(1) : QUESTION_TIME_LIMIT}초</p>
            </div>

            {isEvaluating && (
              <div className="alert alert-info">LRC 평가를 계산 중입니다...</div>
            )}

            {lrcResult && (
              <div className="lrc-result">
                <h3>LRC 평가 결과</h3>
                <p className={`lrc-status ${lrcResult.passed ? 'passed' : 'pending'}`}>
                  {lrcResult.passed ? '승급 준비 완료!' : `권장 조치: ${lrcResult.recommendation}`}
                </p>
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

            <div className="problem-results">
              <h3>문제별 결과:</h3>
              <div className="results-grid">
                {problems.map((problem, index) => {
                  const userAnswer = userAnswers[problem.instance.id];
                  const isCorrect = userAnswer === problem.instance.answer;
                  return (
                    <div key={problem.instance.id} className={`result-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                      <span className="result-title">
                        문제 {index + 1}: {problem.concept.name} · {STEP_LABEL[problem.instance.step] ?? problem.instance.step}
                      </span>
                      <span className="result-prompt">{problem.instance.prompt}</span>
                      <span>정답: {problem.instance.answer}</span>
                      <span>내 답: {userAnswer ?? '미응답'}</span>
                      <span>렌즈: {problem.instance.lens.join(', ')}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="result-actions">
              <button onClick={restartGame} className="restart-button" type="button">
                다시 하기
              </button>
              <button onClick={goBack} className="back-to-dashboard" type="button">
                대시보드로
              </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MathGame;
