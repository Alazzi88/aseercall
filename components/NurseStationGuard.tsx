import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { User, UserRole, SLUG_TO_HOSPITAL } from '../types';
import { storageService } from '../services/storage';
import { Language, pick, hospitalLabel } from '../services/i18n';
import NurseStationScreen from './NurseStationScreen';

interface Props {
  language: Language;
  onLanguageChange: (l: Language) => void;
}

const SESSION_KEY = 'aseer_nurse_session';

const NurseStationGuard: React.FC<Props> = ({ language, onLanguageChange }) => {
  const { hospitalSlug } = useParams<{ hospitalSlug: string }>();
  const t = (ar: string, en: string) => pick(language, ar, en);

  const hospitalName = SLUG_TO_HOSPITAL[hospitalSlug ?? ''] ?? '';
  const [user, setUser] = useState<User | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Restore sessionStorage session
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as User;
      const active = storageService.getUsers().find(u => u.id === parsed.id && u.role === UserRole.NURSE);
      if (active && (!hospitalName || active.assignedHospital === hospitalName)) {
        setUser(active);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, [hospitalName]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const found = storageService.getUsers().find(u =>
      u.username === identifier.trim() &&
      u.password === password &&
      u.role === UserRole.NURSE
    );
    if (!found) {
      setError(t('خطأ في بيانات الدخول. يجب أن يكون الحساب بدور ممرض/ة.', 'Invalid credentials. Account must have nurse role.'));
      return;
    }
    if (hospitalName && found.assignedHospital !== hospitalName) {
      setError(t(
        `هذا الحساب مخصص لمستشفى مختلفة. تحقق من الرابط.`,
        `This account is assigned to a different hospital. Check the URL.`
      ));
      return;
    }
    setUser(found);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(found));
  };

  const handleLogout = () => {
    setUser(null);
    setIdentifier('');
    setPassword('');
    sessionStorage.removeItem(SESSION_KEY);
  };

  if (user) {
    return <NurseStationScreen user={user} language={language} onLogout={handleLogout} onLanguageChange={onLanguageChange} />;
  }

  return (
    <div className="app-shell flex items-center justify-center p-4 min-h-screen">
      <div className="w-full max-w-md animate-fade-up">
        <div className="auth-shell-card motion-card">
          <div className="relative overflow-hidden animated-gradient bg-gradient-to-br from-sky-700 via-teal-700 to-cyan-700 p-8 text-center text-white">
            <img src="/aseer-health-cluster-logo.png" alt="Aseer Health" className="mx-auto h-20 w-auto object-contain drop-shadow-lg mb-3" />
            <p className="text-sky-100 font-bold text-sm">{t('شاشة التمريض', 'Nursing Station')}</p>
            {hospitalName && (
              <p className="mt-1 text-sky-200/80 text-xs">{hospitalLabel(hospitalName, language)}</p>
            )}
          </div>

          <div className="p-6 md:p-8">
            {/* Language toggle */}
            <div className="flex justify-end mb-5">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm">
                <button onClick={() => onLanguageChange('ar')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${language === 'ar' ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>العربية</button>
                <button onClick={() => onLanguageChange('en')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${language === 'en' ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>English</button>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <h2 className="text-xl font-black text-slate-900 mb-1">{t('دخول الممرض/ة', 'Nurse Login')}</h2>
                <p className="text-xs text-slate-500">{t('يُستخدم هذا الرابط على جهاز القسم فقط', 'This URL is for the ward device only')}</p>
              </div>
              <input
                type="text" required autoComplete="username"
                className="input-field"
                placeholder={t('اسم المستخدم', 'Username')}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
              />
              <input
                type="password" required autoComplete="current-password"
                className="input-field"
                placeholder={t('كلمة المرور', 'Password')}
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {error && <p className="text-red-600 text-sm font-bold">{error}</p>}
              <button className="primary-action w-full py-4 rounded-2xl font-black text-lg">
                {t('دخول شاشة التمريض', 'Enter Nursing Station')}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-100 text-center">
              <a href="/admin" className="text-xs font-bold text-sky-700 hover:text-sky-900 underline underline-offset-2">
                {t('← بوابة الموظفين', '← Staff Portal')}
              </a>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 font-semibold mt-4">Developed by Yahya Alizzi</p>
      </div>
    </div>
  );
};

export default NurseStationGuard;
