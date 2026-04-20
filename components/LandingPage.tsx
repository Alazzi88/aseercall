import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HOSPITAL_SLUGS, DEPARTMENT_SLUGS } from '../types';
import { Language, pick, hospitalLabel } from '../services/i18n';

interface Props {
  language: Language;
  onLanguageChange: (l: Language) => void;
}

const LandingPage: React.FC<Props> = ({ language, onLanguageChange }) => {
  const navigate = useNavigate();
  const t = (ar: string, en: string) => pick(language, ar, en);

  const cards = [
    {
      icon: '🏥',
      title: t('بوابة المرضى', 'Patient Portal'),
      subtitle: t('للمراجع — أدخل رقم ملفك', 'For patients — enter your file number'),
      color: 'from-sky-600 to-cyan-500',
      border: 'border-sky-200',
      path: '/patient'
    },
    {
      icon: '🔐',
      title: t('لوحة الموظفين', 'Staff Dashboard'),
      subtitle: t('للإداريين وموظفي الدخول والتمريض', 'For admins, admission & nursing staff'),
      color: 'from-violet-600 to-purple-500',
      border: 'border-violet-200',
      path: '/admin'
    }
  ];

  // Pick first hospital slug for quick display links
  const firstHospitalSlug = Object.values(HOSPITAL_SLUGS)[0];
  const firstDeptSlug = Object.values(DEPARTMENT_SLUGS)[0];

  const displayCards = Object.entries(HOSPITAL_SLUGS).map(([name, slug]) => ({
    name,
    slug,
    label: hospitalLabel(name, language)
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-sky-950 to-slate-900 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-4">
          <img src="/aseer-health-cluster-logo.png" alt="Aseer Health" className="h-14 w-auto object-contain opacity-90" />
          <div>
            <h1 className="text-white font-black text-xl leading-tight">
              {t('تكتل صحة عسير', 'Aseer Health Cluster')}
            </h1>
            <p className="text-sky-300 text-xs font-bold">
              {t('نظام النداء الذكي', 'Smart Call System')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onLanguageChange('ar')}
            className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all ${language === 'ar' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            ع
          </button>
          <button
            onClick={() => onLanguageChange('en')}
            className={`text-xs font-black px-3 py-1.5 rounded-lg transition-all ${language === 'en' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center py-10 px-4">
        <p className="text-sky-400 text-xs font-black tracking-widest uppercase mb-3">
          {t('منصة إدارة النداءات الطبية', 'Medical Call Management Platform')}
        </p>
        <h2 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
          {t('اختر وجهتك', 'Choose your destination')}
        </h2>
        <p className="text-slate-400 text-sm font-bold max-w-md mx-auto">
          {t('كل قسم بوابته الخاصة — انقر مباشرة للوصول', 'Each section has its own portal — click to access directly')}
        </p>
      </div>

      {/* Main cards */}
      <div className="flex flex-col md:flex-row gap-5 justify-center px-6 md:px-16 mb-10">
        {cards.map(card => (
          <button
            key={card.path}
            onClick={() => navigate(card.path)}
            className={`flex-1 max-w-sm mx-auto md:mx-0 bg-gradient-to-br ${card.color} text-white rounded-3xl p-8 shadow-2xl hover:scale-105 transition-all duration-200 text-right`}
          >
            <p className="text-5xl mb-4">{card.icon}</p>
            <h3 className="text-2xl font-black mb-2">{card.title}</h3>
            <p className="text-sm opacity-85 font-bold">{card.subtitle}</p>
            <div className="mt-6 flex items-center gap-2 opacity-80">
              <span className="text-xs font-black">{t('انتقل الآن', 'Go now')}</span>
              <span className="text-lg">←</span>
            </div>
          </button>
        ))}
      </div>

      {/* Display screens section */}
      <div className="px-6 md:px-16 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl">📺</span>
            <div>
              <h3 className="text-white font-black text-lg">
                {t('شاشات العرض (للتلفزيون)', 'Display Screens (for TV)')}
              </h3>
              <p className="text-slate-400 text-xs font-bold">
                {t('شاشات تعرض النداءات النشطة بكل قسم — لا تحتاج تسجيل دخول', 'Shows active calls per department — no login required')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {displayCards.map(h => (
              <button
                key={h.slug}
                onClick={() => navigate(`/display/${h.slug}`)}
                className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-2xl p-3 text-right transition-all hover:scale-105"
              >
                <p className="text-xs text-sky-300 font-black mb-1">📺 {t('شاشة', 'Screen')}</p>
                <p className="text-white text-xs font-black leading-snug truncate">{h.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Nurse station section */}
      <div className="px-6 md:px-16 mb-10">
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-2xl">🩺</span>
            <div>
              <h3 className="text-white font-black text-lg">
                {t('محطات التمريض', 'Nursing Stations')}
              </h3>
              <p className="text-slate-400 text-xs font-bold">
                {t('للممرضين — قبول وإغلاق النداءات', 'For nurses — accept and close calls')}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {displayCards.map(h => (
              <button
                key={h.slug}
                onClick={() => navigate(`/nurse/${h.slug}`)}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-2xl p-3 text-right transition-all hover:scale-105"
              >
                <p className="text-xs text-emerald-300 font-black mb-1">🩺 {t('تمريض', 'Nursing')}</p>
                <p className="text-white text-xs font-black leading-snug truncate">{h.label}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-slate-600 text-xs font-bold pb-6">
        Aseer Health Cluster — Smart Call System | Developed by Yahya Alizzi
      </div>
    </div>
  );
};

export default LandingPage;
