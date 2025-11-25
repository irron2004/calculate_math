import { Link } from 'react-router-dom';

import SkillTreeExperience from '../components/SkillTreePage';
import './pages.css';

const SkillTreePage = () => {
  return (
    <div className="page-shell">
      <div className="page-topbar">
        <div className="page-topbar-left">
          <Link className="text-link" to="/">
            ← 랜딩으로
          </Link>
          <span className="page-title">스킬 트리</span>
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
        <SkillTreeExperience />
      </div>
    </div>
  );
};

export default SkillTreePage;
