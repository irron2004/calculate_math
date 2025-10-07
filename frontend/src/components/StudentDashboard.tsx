import {
    BarChart3,
    Play,
    Settings,
    Trophy
} from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import HomePathMap from './HomePathMap';
import './StudentDashboard.css';

const StudentDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats] = useState({
    totalGames: 15,
    averageScore: 85,
    totalTime: 120,
    streak: 5
  });

  // const handleLogout = () => {
  //   logout();
  //   navigate('/');
  // };

  const startGame = () => {
    navigate('/game');
  };

  if (!user || (user.role !== 'student' && user.role !== 'guest')) {
    return <div>접근 권한이 없습니다.</div>;
  }

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <h1>안녕하세요, {user.name}님! <span role="img" aria-label="wave">👋</span></h1>
        <p>학년 수학 학습을 시작해보세요</p>
      </header>
      {user.role === 'student' ? (
        <div className="stat-card guest-message">
          게스트는 기록이 저장되지 않습니다
        </div>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon">🏆</span>
            <div>
              <div className="stat-value">{stats.totalGames}</div>
              <div className="stat-label">총 게임 수</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⭐</span>
            <div>
              <div className="stat-value">{stats.averageScore}%</div>
              <div className="stat-label">평균 점수</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⏰</span>
            <div>
              <div className="stat-value">{stats.totalTime}분</div>
              <div className="stat-label">총 학습 시간</div>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎯</span>
            <div>
              <div className="stat-value">{stats.streak}일</div>
              <div className="stat-label">연속 학습</div>
            </div>
          </div>
        </div>
      )}

      <div className="dashboard-content">
        {/* 메인 액션 버튼 */}
        <div className="main-action">
          <button onClick={startGame} className="start-game-button">
            <Play size={30} />
            <span>수학 게임 시작하기</span>
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
                <div className="progress-fill" style={{ width: '60%' }}></div>
              </div>
              <span className="progress-text">3/5 문제 완료</span>
            </div>
            <p>오늘 5개의 수학 문제를 풀어보세요!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard; 
