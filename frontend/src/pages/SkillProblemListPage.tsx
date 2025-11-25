import { Link, useParams } from 'react-router-dom';

import SkillProblemList from '../components/SkillProblemListPage';
import './pages.css';

const SkillProblemListPage = () => {
  const { skillId } = useParams();

  return (
    <div className="page-shell">
      <div className="page-topbar">
        <div className="page-topbar-left">
          <Link className="text-link" to="/skills">
            ← 스킬 트리
          </Link>
          <span className="page-title">{skillId ? `${skillId} 문제 목록` : '문제 목록'}</span>
        </div>
        <div className="page-topbar-actions">
          <Link className="ghost-button" to="/login">
            로그인
          </Link>
          <Link className="primary-button" to="/signup">
            회원가입
          </Link>
        </div>
      </div>

      <div className="page-content">
        <SkillProblemList />
      </div>
    </div>
  );
};

export default SkillProblemListPage;
