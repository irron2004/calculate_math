import { ArrowRight, LockOpen, Map, Sparkles } from 'lucide-react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

const samplePaths = [
  '덧셈 → 등차수열 → 일차함수 → 미분',
  '구구단 → 비율 → 일차함수',
  '분수 → 비율 → 확률',
];

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="home-page">
      <header className="home-topbar">
        <div className="home-logo">Calculate Math</div>
        <div className="home-actions">
          <button className="text-button" onClick={() => navigate('/login')}>
            로그인
          </button>
          <button className="outline-button" onClick={() => navigate('/signup')}>
            회원가입
          </button>
        </div>
      </header>

      <section className="home-hero">
        <div className="home-hero-text">
          <p className="hero-badge">수학 스킬트리</p>
          <h1>덧셈에서 미분까지, 연결이 보이는 수학 스킬트리</h1>
          <p className="hero-sub">
            지금 배우는 덧셈이 나중에 등차수열, 일차함수, 미분까지 어떻게 이어지는지 한 번에 보여줘요.
            선행·전이 경로를 따라 바로 연습을 시작하세요.
          </p>
          <div className="home-cta">
            <button className="primary-button" onClick={() => navigate('/skills')}>
              스킬 트리 구경하기
              <ArrowRight size={18} />
            </button>
            <button className="ghost-button" onClick={() => navigate('/game')}>
              예시 문제 먼저 풀어보기
            </button>
          </div>
        </div>
        <div className="home-hero-card">
          <div className="card-title">스킬트리 미리보기</div>
          <p className="card-sub">어디서 시작해도, 상위 개념까지 연결을 보여줍니다.</p>
          <ul className="card-paths">
            {samplePaths.map((path) => (
              <li key={path}>{path}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="home-steps">
        <div className="section-head">
          <p className="section-kicker">사용 방법</p>
          <h2>3단계로 바로 시작</h2>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">
              <Map size={22} />
            </div>
            <h3>트리에서 개념 선택</h3>
            <p>전체 수학 지도를 보며 지금 배우고 싶은 개념을 고릅니다.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">
              <LockOpen size={22} />
            </div>
            <h3>선행 스킬 확인</h3>
            <p>필요한 선행 개념과 현재 상태를 한눈에 확인합니다.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">
              <Sparkles size={22} />
            </div>
            <h3>연습 시작</h3>
            <p>바로 문제를 풀고, 다음 스킬을 해금하며 진도를 올립니다.</p>
          </div>
        </div>
      </section>

      <section className="home-paths">
        <div className="section-head">
          <p className="section-kicker">연결 예시</p>
          <h2>스킬이 이어지는 실제 경로</h2>
        </div>
        <div className="path-cards">
          {samplePaths.map((path) => (
            <div key={path} className="path-card">
              <p>{path}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
