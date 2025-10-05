import {
    BarChart3,
    BookOpen,
    Clock,
    LogOut,
    Target,
    TrendingUp,
    Users
} from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './TeacherDashboard.css';

const TeacherDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [students] = useState([
    { id: '1', name: '김철수', grade: 1, lastPlayed: '2024-01-15', totalTime: 45, averageScore: 85 },
    { id: '2', name: '이영희', grade: 1, lastPlayed: '2024-01-14', totalTime: 30, averageScore: 92 },
    { id: '3', name: '박민수', grade: 2, lastPlayed: '2024-01-15', totalTime: 60, averageScore: 78 }
  ]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user || user.role !== 'teacher') {
    return <div>접근 권한이 없습니다.</div>;
  }

  return (
    <div className="teacher-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>선생님 대시보드</h1>
          <p>{user.name}님, 학생들의 학습 현황을 확인하세요</p>
        </div>
        <button onClick={handleLogout} className="logout-button">
          <LogOut size={20} />
        </button>
      </header>

      <div className="dashboard-content">
        {/* 전체 통계 */}
        <div className="overall-stats">
          <h2>전체 통계</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">
                <Users size={24} />
              </div>
              <div className="stat-info">
                <h3>{students.length}명</h3>
                <p>등록된 학생</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <Clock size={24} />
              </div>
              <div className="stat-info">
                <h3>{students.reduce((sum, student) => sum + student.totalTime, 0)}분</h3>
                <p>총 학습 시간</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <BarChart3 size={24} />
              </div>
              <div className="stat-info">
                <h3>{Math.round(students.reduce((sum, student) => sum + student.averageScore, 0) / students.length)}%</h3>
                <p>평균 정답률</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">
                <BookOpen size={24} />
              </div>
              <div className="stat-info">
                <h3>2개</h3>
                <p>학년별 통계</p>
              </div>
            </div>
          </div>
        </div>

        {/* 학생 목록 */}
        <div className="students-section">
          <h2>학생 현황</h2>
          <div className="students-grid">
            {students.map(student => (
              <div key={student.id} className="student-card">
                <div className="student-info">
                  <h3>{student.name}</h3>
                  <p>{student.grade}학년</p>
                </div>
                <div className="student-stats">
                  <div className="stat-item">
                    <Clock size={16} />
                    <span>총 학습시간: {student.totalTime}분</span>
                  </div>
                  <div className="stat-item">
                    <Target size={16} />
                    <span>평균 점수: {student.averageScore}%</span>
                  </div>
                  <div className="stat-item">
                    <TrendingUp size={16} />
                    <span>마지막 학습: {student.lastPlayed}</span>
                  </div>
                </div>
                <div className="student-actions">
                  <button className="view-details-button">
                    상세 보기
                  </button>
                  <button className="send-message-button">
                    메시지 보내기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 학년별 통계 */}
        <div className="grade-stats">
          <h2>학년별 통계</h2>
          <div className="grade-grid">
            <div className="grade-card">
              <h3>1학년</h3>
              <div className="grade-info">
                <p>학생 수: {students.filter(s => s.grade === 1).length}명</p>
                <p>평균 점수: {Math.round(students.filter(s => s.grade === 1).reduce((sum, s) => sum + s.averageScore, 0) / students.filter(s => s.grade === 1).length)}%</p>
                <p>총 학습시간: {students.filter(s => s.grade === 1).reduce((sum, s) => sum + s.totalTime, 0)}분</p>
              </div>
            </div>
            <div className="grade-card">
              <h3>2학년</h3>
              <div className="grade-info">
                <p>학생 수: {students.filter(s => s.grade === 2).length}명</p>
                <p>평균 점수: {Math.round(students.filter(s => s.grade === 2).reduce((sum, s) => sum + s.averageScore, 0) / students.filter(s => s.grade === 2).length)}%</p>
                <p>총 학습시간: {students.filter(s => s.grade === 2).reduce((sum, s) => sum + s.totalTime, 0)}분</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard; 