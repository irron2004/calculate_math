import {
    BarChart3,
    Bell,
    Clock,
    LogOut,
    Target,
    TrendingUp,
    Users
} from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ParentDashboard.css';

const ParentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [children] = useState([
    { id: '1', name: '김철수', grade: 1, lastPlayed: '2024-01-15', totalTime: 45 }
  ]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user || user.role !== 'parent') {
    return <div>접근 권한이 없습니다.</div>;
  }

  return (
    <div className="parent-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>부모님 대시보드</h1>
          <p>{user.name}님, 자녀의 학습 현황을 확인하세요</p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          <LogOut size={20} />
        </button>
      </header>

      <div className="dashboard-content">
        {/* 자녀 목록 */}
        <div className="children-section">
          <h2>자녀 현황</h2>
          <div className="children-grid">
            {children.map(child => (
              <div key={child.id} className="child-card">
                <div className="child-info">
                  <h3>{child.name}</h3>
                  <p>{child.grade}학년</p>
                </div>
                <div className="child-stats">
                  <div className="stat-item">
                    <Clock size={16} />
                    <span>총 학습시간: {child.totalTime}분</span>
                  </div>
                  <div className="stat-item">
                    <Target size={16} />
                    <span>마지막 학습: {child.lastPlayed}</span>
                  </div>
                </div>
                <button className="view-details-button">
                  상세 보기
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 알림 섹션 */}
        <div className="notifications-section">
          <h2>최근 알림</h2>
          <div className="notifications-list">
            <div className="notification-item">
              <div className="notification-icon">
                <Bell size={20} />
              </div>
              <div className="notification-content">
                <h4>김철수가 오늘 학습을 완료했습니다!</h4>
                <p>10문제 중 8문제를 맞혔습니다. (80% 정답률)</p>
                <span className="notification-time">2시간 전</span>
              </div>
            </div>
            <div className="notification-item">
              <div className="notification-icon">
                <TrendingUp size={20} />
              </div>
              <div className="notification-content">
                <h4>김철수의 성적이 향상되었습니다!</h4>
                <p>지난 주 대비 평균 점수가 15% 상승했습니다.</p>
                <span className="notification-time">1일 전</span>
              </div>
            </div>
          </div>
        </div>

        {/* 전체 통계 */}
        <div className="overall-stats">
          <h2>전체 통계</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-info">
                <h3>{children.length}명</h3>
                <p>등록된 자녀</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <h3>{children.reduce((sum, child) => sum + child.totalTime, 0)}분</h3>
                <p>총 학습 시간</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <BarChart3 size={24} />
              </div>
              <div className="stat-info">
                <h3>85%</h3>
                <p>평균 정답률</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParentDashboard; 