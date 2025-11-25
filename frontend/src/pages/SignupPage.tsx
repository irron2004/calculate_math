import { Link } from 'react-router-dom';

import Signup from '../components/Signup';
import './pages.css';

const SignupPage = () => {
  return (
    <div className="page-shell">
      <div className="page-topbar">
        <div className="page-topbar-left">
          <Link className="text-link" to="/">
            ← 홈으로
          </Link>
          <span className="page-title">회원가입</span>
        </div>
        <div className="page-topbar-actions">
          <Link className="ghost-button" to="/login">
            로그인
          </Link>
        </div>
      </div>

      <div className="page-content">
        <Signup />
      </div>
    </div>
  );
};

export default SignupPage;
