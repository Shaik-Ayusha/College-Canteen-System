import { createContext, useContext, useState } from 'react';
import { api, setToken } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('canteen_user') || 'null'));

  function saveSession(data) {
    setToken(data.token);
    localStorage.setItem('canteen_user', JSON.stringify(data.user));
    setUser(data.user);
  }

  async function login(email, password, expectedRole) {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    if (expectedRole && data.user.role !== expectedRole) {
      throw new Error(`This account is not registered for ${expectedRole === 'admin' ? 'admin' : 'student'} sign in.`);
    }
    saveSession(data);
  }

  async function register(name, email, password) {
    saveSession(await api('/auth/register', { method: 'POST', body: { name, email, password } }));
  }

  function logout() {
    setToken(null);
    localStorage.removeItem('canteen_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
