import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [accountType, setAccountType] = useState('student');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');

  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/menu'} replace />;

  const update = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      if (mode === 'login') await login(form.email, form.password, accountType);
      else await register(form.name, form.email, form.password);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-form-panel">
          <Link className="auth-brand" to="/login" aria-label="College Canteen home">
            <span className="auth-brand-mark">CC</span>
            <span>College Canteen</span>
          </Link>
          <div className="auth-form-content">
            <span className="auth-eyebrow">{mode === 'login' ? 'LUNCH, MADE SIMPLE' : 'JOIN THE TABLE'}</span>
            <h1>{mode === 'login' ? <>A better lunch<br />starts here.</> : 'Come on in.'}</h1>
            <p className="auth-intro">
              {mode === 'login'
                ? 'Sign in to see what’s cooking and have your campus lunch ready when you are.'
                : 'Create an account and make your next campus meal a little easier.'}
            </p>
            {mode === 'login' && (
              <div className="auth-hours-card">
                <span className="auth-hours-icon" aria-hidden="true">◷</span>
                <span><small>CANTEEN LUNCH HOURS</small><strong>12:00 noon – 2:00 p.m.</strong><em>Preorder before 12:00 noon</em></span>
              </div>
            )}
            <div className="auth-role-options" role="group" aria-label="Choose sign in type">
              <button
                type="button"
                className={`auth-role-option ${accountType === 'student' ? 'active' : ''}`}
                aria-pressed={accountType === 'student'}
                onClick={() => { setAccountType('student'); setMode('login'); setError(''); }}
              >
                <span className="auth-role-icon" aria-hidden="true">↗</span>
                <span><strong>Student</strong><small>Order your lunch</small></span>
                <span className="auth-role-arrow" aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                className={`auth-role-option ${accountType === 'admin' ? 'active' : ''}`}
                aria-pressed={accountType === 'admin'}
                onClick={() => { setAccountType('admin'); setMode('login'); setError(''); }}
              >
                <span className="auth-role-icon" aria-hidden="true">✳</span>
                <span><strong>Admin</strong><small>Manage the canteen</small></span>
                <span className="auth-role-arrow" aria-hidden="true">→</span>
              </button>
            </div>
            {accountType === 'student' && (
              <div className="tabs auth-tabs" role="tablist" aria-label="Student account options">
                <button type="button" role="tab" aria-selected={mode === 'login'} className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => { setMode('login'); setError(''); }}>
                  Log in
                </button>
                <button type="button" role="tab" aria-selected={mode === 'register'} className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => { setMode('register'); setError(''); }}>
                  Create account
                </button>
              </div>
            )}
            <form className="auth-form" onSubmit={submit}>
              {mode === 'register' && (
                <label htmlFor="auth-name">
                  Full name
                  <input id="auth-name" name="name" type="text" autoComplete="name" placeholder="Your name" value={form.name} onChange={update} required />
                </label>
              )}
              <label htmlFor="auth-email">
                College email
                <input id="auth-email" name="email" type="email" autoComplete="email" placeholder="you@college.edu" value={form.email} onChange={update} required />
              </label>
              <label htmlFor="auth-password">
                Password
                <input id="auth-password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder={mode === 'login' ? 'Enter your password' : 'At least 6 characters'} value={form.password} onChange={update} required minLength={6} />
              </label>
              <button className="btn full auth-submit" type="submit">{mode === 'login' ? 'Sign in' : 'Create your account'} <span aria-hidden="true">→</span></button>
              {error && <p className="error auth-error" role="alert">{error}</p>}
            </form>
            <p className="auth-footnote">{accountType === 'admin' ? 'Authorized canteen staff only.' : 'Made for the moments between classes.'}</p>
          </div>
        </section>
        <aside className="auth-photo-panel">
          <img
            src="https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=1500&q=90"
            alt="A freshly plated biryani lunch"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1500&q=85';
            }}
          />
          <div className="auth-photo-overlay" />
          <div className="auth-photo-topline"><span>THE CAMPUS TABLE</span><span>FRESH DAILY</span></div>
          <div className="auth-photo-copy">
            <span className="auth-photo-kicker">FRESH FROM THE CANTEEN</span>
            <p>Take a break.<br />Eat something lovely.</p>
            <span className="auth-photo-caption">Preorder before noon. Pick up at lunch.</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
