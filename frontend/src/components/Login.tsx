import { BookOpen, Lock, User } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Login: React.FC = () => {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(nickname, password);
      if (success) {
        // 사용자 역할에 따라 다른 페이지로 이동
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        switch (user.role) {
          case 'student':
            navigate('/student');
            break;
          case 'parent':
            navigate('/parent');
            break;
          case 'teacher':
            navigate('/teacher');
            break;
          default:
            navigate('/student');
        }
      } else {
        setError('로그인에 실패했습니다. 닉네임과 비밀번호를 확인해주세요.');
      }
    } catch (err) {
      setError('로그인 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    // 게스트 계정 정보
    const guestUser = {
      id: 'guest',
      username: 'guest',
      role: 'guest',
      name: '게스트'
    };
    localStorage.setItem('user', JSON.stringify(guestUser));
    // 게스트는 학생 대시보드로 이동(원하면 별도 페이지로 변경 가능)
    navigate('/student');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <BookOpen className="logo-icon" />
          <h1>수학 놀이터</h1>
          <p>재미있는 수학 학습을 시작해보세요!</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <div className="input-wrapper">
              <User className="input-icon" />
              <input
                type="text"
                placeholder="닉네임"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                required
                className="login-input"
              />
            </div>
          </div>

          <div className="input-group">
            <div className="input-wrapper">
              <Lock className="input-icon" />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="login-input"
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button 
            type="submit" 
            disabled={loading}
            className="login-button"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <button 
          className="login-button" 
          style={{ marginTop: 8, background: '#eee', color: '#333' }}
          onClick={handleGuestLogin}
        >
          게스트로 시작
        </button>

        <div className="login-info">
          <p>처음 사용하시는 경우 닉네임과 비밀번호를 입력하면 자동으로 계정이 생성됩니다.</p>
        </div>
      </div>
    </div>
  );
};

export default Login; 