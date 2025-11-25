import { Link, useNavigate } from 'react-router-dom';

import './LandingPage.css';
import './pages.css';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <header className="landing-header">
        <div className="landing-brand">
          <span>Calculate Math</span>
        </div>
        <nav className="landing-nav">
          <Link to="/skills">스킬 트리</Link>
          <Link to="/skills">내 학습</Link>
          <Link to="/skills">문제 목록</Link>
        </nav>
        <div className="landing-actions">
          <Link className="ghost-button" to="/login">
            로그인
          </Link>
          <Link className="primary-button" to="/signup">
            회원가입
          </Link>
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="hero-text">
            <p className="eyebrow">MVP 플로우</p>
            <h1>수학 개념을 스킬트리처럼 한눈에</h1>
            <p>덧셈부터 미분까지, 선행 스킬과 추천 경로를 따라 바로 문제를 풀어보세요.</p>
            <div className="cta-row">
              <button className="primary-button" type="button" onClick={() => navigate('/skills')}>
                스킬 트리 보러가기
              </button>
              <button className="ghost-button" type="button" onClick={() => navigate('/demo-session')}>
                예시 문제 풀어보기
              </button>
            </div>
            <div className="hero-meta">
              <span className="pill">스킬 선택 → 문제 목록 → 문제 풀이</span>
              <span className="pill">진행도와 정답률 표시</span>
            </div>
          </div>

          <div className="hero-preview">
            <div className="preview-card">
              <div className="preview-header">
                <span>스킬 트리 미리보기</span>
                <span className="pill">예시</span>
              </div>
              <div className="preview-graph">
                <div className="preview-node">덧셈 기초</div>
                <div className="preview-node">곱셈 도입</div>
                <div className="preview-node">항등식</div>
                <div className="preview-node">미분 준비</div>
                <div className="preview-node">분수 계산</div>
                <div className="preview-node">지수 규칙</div>
                <div className="preview-node">함수 개념</div>
                <div className="preview-node">미분 초입</div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <h3>어떻게 공부하나요?</h3>
          <div className="section-grid">
            <div className="section-card">
              <h4>1) 트리에서 개념 선택</h4>
              <p>배우고 싶은 스킬을 누르면 설명과 선행 스킬이 오른쪽 패널에 나타납니다.</p>
            </div>
            <div className="section-card">
              <h4>2) 선행 스킬 확인</h4>
              <p>바로 풀어도 되는지, 먼저 복습이 필요한지 상태 배지로 확인합니다.</p>
            </div>
            <div className="section-card">
              <h4>3) 문제 풀고 다음 이동</h4>
              <p>문제 목록에서 한 문제씩 풀고, 정답률/진행도를 보고 다음 스킬로 이동합니다.</p>
            </div>
          </div>
        </section>

        <section className="landing-section">
          <h3>예시 경로</h3>
          <p className="muted">덧셈 기초 → 곱셈 도입 → 항등식 → 미분 준비</p>
          <p className="muted">필요하면 아무 때나 문제 목록으로 돌아가서 복습할 수 있어요.</p>
        </section>
      </main>
    </div>
  );
};

export default LandingPage;
