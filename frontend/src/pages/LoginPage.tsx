import { Link } from 'react-router-dom';

import Login from '../components/Login';
import './pages.css';

const LoginPage = () => {
  return (
    <div className="page-shell">
      <div className="page-topbar">
        <div className="page-topbar-left">
          <Link className="text-link" to="/">
            ← 홈으로
          </Link>
          <span className="page-title">로그인</span>
        </div>
        <div className="page-topbar-actions">
          <Link className="ghost-button" to="/signup">
            회원가입
          </Link>
        </div>
      </div>

      <div className="page-content">
        <Login />
      </div>
    </div>
  );
};

export default LoginPage;
