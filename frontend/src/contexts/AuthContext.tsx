import type { ReactNode } from 'react';
import React, { createContext, useContext, useState } from 'react';
import type { User } from '../types';
import { API_BASE_URL } from '../utils/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  error: string | null;
  login: (nickname: string, password: string) => Promise<LoginResult>;
  register: (nickname: string, password: string) => Promise<LoginResult>;
  loginAsGuest: () => LoginResult;
  logout: () => void;
  loading: boolean;
}

interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authenticate = async (
    nickname: string,
    password: string,
    intent: 'login' | 'register',
  ): Promise<LoginResult> => {
    try {
      setLoading(true);
      setError(null);
      // NOTE: Backend creates the account on first login, so signup reuses the same endpoint.
      const response = await fetch(`${API_BASE_URL}/v1/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          nickname: nickname,
          password: password
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const userData: User = {
          id: data.user_id.toString(),
          username: data.nickname,
          role: data.role,
          name: data.nickname
        };

        setUser(userData);
        setToken(data.session_token ?? null);
        setError(null);
        return { success: true, user: userData };
      } else {
        const errorData = await response.json();
        const fallback =
          intent === 'register'
            ? '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.'
            : '로그인에 실패했습니다. 닉네임과 비밀번호를 확인해주세요.';
        const message =
          (errorData?.detail && errorData.detail.message) ||
          errorData?.message ||
          fallback;
        setError(message);
        return { success: false, error: message };
      }
    } catch (error) {
      console.error('Auth error:', error);
      const message =
        intent === 'register'
          ? '회원가입 중 오류가 발생했습니다.'
          : '로그인 중 오류가 발생했습니다.';
      setError(message);
      return { success: false, error: message };
    } finally {
      setLoading(false);
    }
  };

  const login = async (nickname: string, password: string) =>
    authenticate(nickname, password, 'login');

  const register = async (nickname: string, password: string) =>
    authenticate(nickname, password, 'register');

  const logout = () => {
    setUser(null);
    setToken(null);
    setError(null);
  };

  const loginAsGuest = (): LoginResult => {
    const guestUser: User = {
      id: 'guest',
      username: 'guest',
      role: 'guest',
      name: '게스트 사용자',
    };

    setUser(guestUser);
    setToken(null);
    setError(null);
    return { success: true, user: guestUser };
  };

  const value = {
    user,
    token,
    error,
    login,
    register,
    loginAsGuest,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 
