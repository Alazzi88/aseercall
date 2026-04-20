import React, { useEffect, useMemo, useState } from 'react';
import { User, UserRole } from '../types';
import { storageService } from '../services/storage';
import { Language, getInitialLanguage, hospitalOptions, departmentOptions, persistLanguage, pick } from '../services/i18n';
import Header from './Header';
import AdminDashboard from './AdminDashboard';
import NurseDashboard from './NurseDashboard';
import AdmissionDashboard from './AdmissionDashboard';

interface StaffAuthGateProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const StaffAuthGate: React.FC<StaffAuthGateProps> = ({ language, onLanguageChange }) => {
  const t = (ar: string, en: string) => pick(language, ar, en);
  const [user, setUser] = useState<User | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Restore session from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('aseer_staff_user');
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as User;
      const active = storageService.getUsers().find(u => u.id === parsed.id);
      if (active) {
        setUser(active);
        localStorage.setItem('aseer_staff_user', JSON.stringify(active));
      } else {
        localStorage.removeItem('aseer_staff_user');
      }
    } catch {
      localStorage.removeItem('aseer_staff_user');
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const found = storageService.getUsers().find(u => u.username === identifier.trim() && u.password === password);
    if (!found) {
      setError(t('خطأ في بيانات الدخول. تحقق من اسم المستخدم وكلمة المرور.', 'Invalid credentials. Check username and password.'));
      return;
    }
    if (found.role === UserRole.PATIENT) {
      setError(t('هذا الحساب لمريض. استخدم بوابة المراجع.', 'This is a patient account. Use the patient portal.'));
      return;
    }
    setUser(found);
    localStorage.setItem('aseer_staff_user', JSON.stringify(found));
  };

  const handleLogout = () => {
    setUser(null);
    setIdentifier('');
    setPassword('');
    setError('');
    localStorage.removeItem('aseer_staff_user');
  };

  // Login screen
  if (!user) {
    return (
      <div className="app-shell flex items-center justify-center p-4 md:p-7 min-h-screen">
        <div className="w-full max-w-md animate-fade-up">
          <div className="auth-shell-card motion-card">
            <div className="relative overflow-hidden animated-gradient bg-gradient-to-br from-slate-700 via-sky-800 to-teal-700 p-8 text-center text-white">
              <div className="absolute -top-10 -left-10 h-44 w-44 rounded-full bg-white/10 blur-xl" />
              <img
                src="/aseer-health-cluster-logo.png"
                alt="Aseer Health"
                className="relative z-10 mx-auto h-20 w-auto object-contain drop-shadow-[0_8px_20px_rgba(0,0,0,0.24)]"
              />
              <p className="relative z-10 text-sky-50/85 font-semibold text-sm mt-3">
                {t('بوابة الموظفين والإدارة', 'Staff & Admin Portal')}
              </p>
            </div>

            <div className="p-6 md:p-8">
              {/* Language toggle */}
              <div className="flex justify-end mb-6">
                <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm">
                  <button onClick={() => onLanguageChange('ar')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${language === 'ar' ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>العربية</button>
                  <button onClick={() => onLanguageChange('en')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${language === 'en' ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>English</button>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 mb-1">{t('تسجيل دخول الموظف', 'Staff Login')}</h2>
                  <p className="text-sm text-slate-500">{t('للموظفين والإداريين فقط', 'For staff and administrators only')}</p>
                </div>
                <input
                  type="text" required
                  className="input-field"
                  placeholder={t('اسم المستخدم أو البريد الإلكتروني', 'Username or email')}
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                />
                <input
                  type="password" required
                  className="input-field"
                  placeholder={t('كلمة المرور', 'Password')}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                {error && <p className="text-red-600 text-sm font-bold">{error}</p>}
                <button className="primary-action w-full py-4 rounded-2xl shadow-lg text-lg font-black">
                  {t('دخول', 'Login')}
                </button>
              </form>

              <div className="mt-6 pt-5 border-t border-slate-100 text-center">
                <a href="/patient" className="text-xs font-bold text-sky-700 hover:text-sky-900 underline underline-offset-2">
                  {t('← بوابة المريض', '← Patient Portal')}
                </a>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-slate-500 font-semibold mt-4">Developed by Yahya Alizzi</p>
        </div>
      </div>
    );
  }

  // Render correct dashboard
  const renderDashboard = () => {
    switch (user.role) {
      case UserRole.NURSE:
        return <NurseDashboard user={user} language={language} />;
      case UserRole.ADMISSION:
        return <AdmissionDashboard user={user} language={language} />;
      case UserRole.ADMIN:
      case UserRole.OWNER:
        return (
          <AdminDashboard
            currentUser={user}
            liveLocation={null}
            locationError=""
            language={language}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-shell">
      <Header user={user} onLogout={handleLogout} language={language} onLanguageChange={onLanguageChange} />
      <main className="container mx-auto px-2 md:px-4 pb-6">
        {renderDashboard()}
      </main>
      <footer className="mx-3 mb-3 panel-glass rounded-2xl py-4 text-center text-xs font-semibold text-slate-600">
        Developed by Yahya Alizzi
      </footer>
    </div>
  );
};

export default StaffAuthGate;
