import {
    BarChart3,
    Play,
    Settings,
    Trophy
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserProgressMetrics } from '../types';
import { fetchUserMetrics } from '../utils/api';
import HomePathMap from './HomePathMap';
import './StudentDashboard.css';

const StudentDashboard: React.FC = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<UserProgressMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user || user.role === 'guest') {
      setMetrics(null);
      setMetricsError(null);
      setLoadingMetrics(false);
      return () => {
        active = false;
      };
    }

    const loadMetrics = async () => {
      try {
        setLoadingMetrics(true);
        const response = await fetchUserMetrics(token ?? undefined);
        if (!active) {
          return;
        }
        setMetrics(response);
        setMetricsError(null);
      } catch (error) {
        console.error('학습 지표 로드 실패:', error);
        if (!active) {
          return;
        }
        setMetricsError('개인화 학습 지표를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      } finally {
        if (active) {
          setLoadingMetrics(false);
        }
      }
    };

    void loadMetrics();

    return () => {
      active = false;
    };
  }, [token, user]);

  // const handleLogout = () => {
  //   logout();
  //   navigate('/');
  // };

  const startGame = () => {
    navigate('/game');
  };

  const openSkillTree = () => {
    navigate('/skills');
  };

  if (!user || (user.role !== 'student' && user.role !== 'guest')) {
    return <div>접근 권한이 없습니다.</div>;
  }

  const totalAttempts = metrics?.attempts.total ?? 0;
  const accuracyRate = Math.round(metrics?.attempts.accuracy_rate ?? 0);
  const totalXp = metrics?.progress.total_xp ?? 0;
  const streakDays = metrics?.attempts.streak_days ?? 0;
  const unlockedNodes = metrics?.progress.unlocked_nodes ?? 0;
  const completedNodes = metrics?.progress.completed_nodes ?? 0;
  const targetSteps = unlockedNodes > 0 ? unlockedNodes : 5;
  const completedForGoal = Math.min(completedNodes, targetSteps);
  const goalProgressRatio = targetSteps > 0 ? completedForGoal / targetSteps : 0;
  const goalProgressWidth = `${Math.round(goalProgressRatio * 100)}%`;
  const goalText = `${completedForGoal}/${targetSteps} 스텝 완료`;
  const isGuest = user.role === 'guest';

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <h1>안녕하세요, {user.name}님! <span role="img" aria-label="wave">👋</span></h1>
        <p>학년 수학 학습을 시작해보세요</p>
      </header>
      {isGuest ? (
        <div className="stat-card guest-message">
          게스트는 기록이 저장되지 않습니다
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">🏆</span>
            <div>
              <div className="stat-value">
                {loadingMetrics ? '불러오는 중…' : totalAttempts}
              </div>
              <div className="stat-label">총 풀이 시도</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⭐</span>
            <div>
              <div className="stat-value">
                {loadingMetrics ? '불러오는 중…' : `${accuracyRate}%`}
              </div>
              <div className="stat-label">정답률</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⏰</span>
            <div>
              <div className="stat-value">
                {loadingMetrics ? '불러오는 중…' : `${totalXp} XP`}
              </div>
              <div className="stat-label">누적 경험치</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎯</span>
            <div>
              <div className="stat-value">
                {loadingMetrics ? '불러오는 중…' : `${streakDays}일`}
              </div>
              <div className="stat-label">연속 학습</div>
            </div>
          </div>
        </div>
      )}
      {!isGuest && metricsError && (
        <div className="stat-card guest-message">
          {metricsError}
        </div>
      )}

      <div className="dashboard-content">
        {/* 메인 액션 버튼 */}
        <div className="main-action">
          <button onClick={startGame} className="start-game-button">
            <Play size={30} />
            <span>수학 게임 시작하기</span>
          </button>
          <button onClick={openSkillTree} className="start-game-button secondary">
            <span>스킬 트리 열기</span>
          </button>
        </div>

        <section className="path-map-section">
          <div className="section-heading">
            <h2>연결이 보이는 커리큘럼</h2>
            <p>내가 푼 스텝이 어디로 이어지는지 한눈에 살펴보세요.</p>
          </div>
          <HomePathMap />
        </section>

        {/* 학습 옵션 */}
        <div className="learning-options">
          <h2>학습 옵션</h2>
          <div className="options-grid">
            <div className="option-card">
              <div className="option-icon">
                <BarChart3 size={24} />
              </div>
              <h3>진도 확인</h3>
              <p>나의 학습 진도를 확인해보세요</p>
            </div>

            <div className="option-card">
              <div className="option-icon">
                <Trophy size={24} />
              </div>
              <h3>성취도</h3>
              <p>획득한 배지와 성취를 확인하세요</p>
            </div>

            <div className="option-card">
              <div className="option-icon">
                <Settings size={24} />
              </div>
              <h3>설정</h3>
              <p>게임 설정을 변경하세요</p>
            </div>
          </div>
        </div>

        {/* 오늘의 목표 */}
        <div className="today-goal">
          <h2>오늘의 목표</h2>
          <div className="goal-card">
            <div className="goal-progress">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: goalProgressWidth }}></div>
              </div>
              <span className="progress-text">{goalText}</span>
            </div>
            <p>오늘 {targetSteps}개의 스텝을 완료해보세요!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard; 
