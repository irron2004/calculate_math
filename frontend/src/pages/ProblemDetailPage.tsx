import { Link } from 'react-router-dom';

import ProblemDetail from '../components/ProblemDetailPage';
import './pages.css';

const ProblemDetailPage = () => {
  return (
    <div className="page-shell">
      <div className="page-topbar">
        <div className="page-topbar-left">
          <Link className="text-link" to="/skills">
            ← 문제 목록으로
          </Link>
          <span className="page-title">문제 풀이</span>
        </div>
        <div className="page-topbar-actions">
          <Link className="ghost-button" to="/skills">
            스킬 트리
          </Link>
          <Link className="primary-button" to="/login">
            내 학습 보기
          </Link>
        </div>
      </div>

      <div className="page-content">
        <ProblemDetail />
      </div>
    </div>
  );
};

export default ProblemDetailPage;
