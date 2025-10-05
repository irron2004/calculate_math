import {
    ArrowLeft,
    Clock,
    Target
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { APIProblem } from '../types';
import { createSession } from '../utils/api';
import './MathGame.css';

const MathGame: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentProblem, setCurrentProblem] = useState<APIProblem | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [totalQuestions] = useState(20); // 기획서에 따라 20문제
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'finished' | 'submitted'>('loading');
  const [streak, setStreak] = useState(0);
  const [problems, setProblems] = useState<APIProblem[]>([]);
  const [attemptCount, setAttemptCount] = useState<number>(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: number }>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  // API에서 문제 세트 로드
  const loadProblems = async () => {
    try {
      setGameState('loading');
      const session = await createSession();
      setProblems(session.problems);
      setCurrentProblem(session.problems[0]);
      // setSessionId(session.session_id);
      setGameState('playing');
    } catch (error) {
      console.error('문제 로드 실패:', error);
      // 에러 시 기본 문제 생성 (fallback)
      const fallbackProblems = generateFallbackProblems();
      setProblems(fallbackProblems);
      setCurrentProblem(fallbackProblems[0]);
      setGameState('playing');
    }
  };

  // API 실패 시 사용할 기본 문제 생성
  const generateFallbackProblems = (): APIProblem[] => {
    return Array.from({ length: 20 }, (_, index) => {
      const left = Math.floor(Math.random() * 9) + 1;
      const right = Math.floor(Math.random() * 9) + 1;
      const answer = left + right;
      
      // 선택지 생성
      const options = [answer];
      while (options.length < 4) {
        const wrongAnswer = answer + Math.floor(Math.random() * 10) - 5;
        if (wrongAnswer > 0 && !options.includes(wrongAnswer)) {
          options.push(wrongAnswer);
        }
      }
      
      return {
        id: index + 1,
        left,
        right,
        answer,
        options: options.sort(() => Math.random() - 0.5) // 선택지 순서 섞기
      };
    });
  };

  // 게임 초기화
  useEffect(() => {
    loadProblems();
  }, []);

  // 타이머
  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      handleNextQuestion();
    }
  }, [timeLeft, gameState]);

  // 답변 처리 - 정답 체크 없이 바로 다음 문제로
  const handleAnswer = async (chosenAnswer: number | null) => {
    if (!currentProblem || chosenAnswer === null) return;

    // 사용자 답변 저장
    setUserAnswers(prev => ({
      ...prev,
      [currentProblem.id]: chosenAnswer
    }));

    // 정답 여부 확인 (점수 계산용, 화면에는 표시하지 않음)
    const isCorrect = chosenAnswer === currentProblem.answer;
    if (isCorrect) {
      setScore(score + 10 + Math.floor(timeLeft / 3));
      setStreak(streak + 1);
      setCorrectCount(correctCount + 1);
    } else {
      setStreak(0);
    }

    // 바로 다음 문제로 넘어가기
    handleNextQuestion();
  };

  // 다음 문제로 넘어가는 함수
  const handleNextQuestion = () => {
    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
      setCurrentProblem(problems[currentQuestion]);
      setSelectedAnswer(null);
      setTimeLeft(30);
      setGameState('playing');
      setAttemptCount(1);
    } else {
      setGameState('finished');
    }
  };

  // 제출 버튼 클릭 시 결과 확인
  const handleSubmitResults = () => {
    setIsSubmitted(true);
    setGameState('submitted');
  };

  const handleOptionSelect = (option: number) => {
    setSelectedAnswer(option);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAnswer !== null) {
      handleAnswer(selectedAnswer);
    }
  };

  const goBack = () => {
    navigate('/student');
  };

  const restartGame = () => {
    loadProblems();
    setScore(0);
    setCurrentQuestion(1);
    setTimeLeft(30);
    setStreak(0);
    setSelectedAnswer(null);
    setAttemptCount(1);
    setCorrectCount(0);
    setUserAnswers({});
    setIsSubmitted(false);
  };

  if (!user) {
    return <div>로그인이 필요합니다.</div>;
  }

  if (gameState === 'loading') {
    return (
      <div className="math-game">
        <div className="loading-container">
          <h2>문제를 준비하고 있습니다...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="math-game">
      <header className="game-header">
        <button onClick={goBack} className="back-button">
          <ArrowLeft size={24} />
        </button>
        <div className="game-info">
          <div className="info-item">
            <Target size={20} />
            <span>문제 {currentQuestion}/{totalQuestions}</span>
          </div>
          <div className="info-item">
            <Clock size={20} />
            <span>{timeLeft}초</span>
          </div>
        </div>
      </header>

      <div className="game-content">
        {gameState === 'playing' && currentProblem && (
          <div className="problem-container">
            <div className="problem-display">
              <h2>{currentProblem.left} + {currentProblem.right} = ?</h2>
              {attemptCount > 1 && (
                <div className="attempt-indicator">
                  {attemptCount}번째 시도
                </div>
              )}
            </div>
            
            <div className="options-container">
              {currentProblem.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  className={`option-button ${selectedAnswer === option ? 'selected' : ''}`}
                >
                  {option}
                </button>
              ))}
            </div>

            <button 
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              className="submit-button"
            >
              확인
            </button>
          </div>
        )}

        {gameState === 'finished' && !isSubmitted && (
          <div className="submit-results">
            <h2>모든 문제를 풀었습니다! 🎉</h2>
            <p>결과를 확인하려면 제출 버튼을 눌러주세요.</p>
            <button onClick={handleSubmitResults} className="submit-results-button">
              제출
            </button>
          </div>
        )}

        {gameState === 'submitted' && (
          <div className="game-result">
            <h2>게임 완료! 🎊</h2>
            <div className="final-score">
              <h3>최종 점수: {score}점</h3>
              <p>정답률: {Math.round((correctCount / totalQuestions) * 100)}%</p>
              <p>맞은 문제: {correctCount}개 / {totalQuestions}개</p>
            </div>
            
            {/* 문제별 결과 표시 */}
            <div className="problem-results">
              <h3>문제별 결과:</h3>
              <div className="results-grid">
                {problems.map((problem, index) => {
                  const userAnswer = userAnswers[problem.id];
                  const isCorrect = userAnswer === problem.answer;
                  return (
                    <div key={problem.id} className={`result-item ${isCorrect ? 'correct' : 'incorrect'}`}>
                      <span>문제 {index + 1}: {problem.left} + {problem.right} = {problem.answer}</span>
                      <span>내 답: {userAnswer}</span>
                      <span>{isCorrect ? '✅' : '❌'}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="result-actions">
              <button onClick={restartGame} className="restart-button">
                다시 하기
              </button>
              <button onClick={goBack} className="back-to-dashboard">
                대시보드로
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MathGame; 