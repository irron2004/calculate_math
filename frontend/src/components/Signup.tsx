import { Lock, ShieldCheck, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

const Signup: React.FC = () => {
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register, loading, error: authError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const normalizedNickname = nickname.trim();

    if (!normalizedNickname) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    if (password.length < 4) {
      setError('비밀번호를 4자 이상 입력해주세요.');
      return;
    }
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    const result = await register(normalizedNickname, password);
    if (result.success && result.user) {
      const role = result.user.role;
      setSuccess('가입이 완료되었습니다! 대시보드로 이동합니다.');
      if (role === 'teacher') {
        navigate('/teacher');
      } else if (role === 'parent') {
        navigate('/parent');
      } else {
        navigate('/student');
      }
    } else {
      setError(result.error ?? '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <UserPlus className="logo-icon" />
          <h1>계정 만들기</h1>
          <p>닉네임과 비밀번호로 바로 시작하세요.</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <div className="input-wrapper">
              <ShieldCheck className="input-icon" />
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
                placeholder="비밀번호 (4자 이상)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
                placeholder="비밀번호 확인"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="login-input"
              />
            </div>
          </div>

          {(error || authError) && (
            <div className="error-message">{error || authError}</div>
          )}

          {success && <div className="success-message">{success}</div>}

          <button type="submit" disabled={loading} className="login-button">
            {loading ? '처리 중...' : '회원가입'}
          </button>
        </form>

        <div className="helper-text">
          <p>계정은 기본적으로 학생 역할로 생성되며, 같은 닉네임으로 다시 로그인하면 계정이 복원됩니다.</p>
        </div>

        <div className="auth-switch">
          <span>이미 계정이 있으신가요?</span>
          <button
            type="button"
            className="link-button"
            onClick={() => navigate('/')}
          >
            로그인하기
          </button>
        </div>
      </div>
    </div>
  );
};

export default Signup;
