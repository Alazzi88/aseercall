import React, { useState } from 'react';
import { PatientAdmission } from '../types';
import { storageService } from '../services/storage';
import { Language, pick } from '../services/i18n';
import PatientDashboard from './PatientDashboard';

interface PatientPortalProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

const PatientPortal: React.FC<PatientPortalProps> = ({ language, onLanguageChange }) => {
  const t = (ar: string, en: string) => pick(language, ar, en);
  const [fileNumber, setFileNumber] = useState('');
  const [admission, setAdmission] = useState<PatientAdmission | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = fileNumber.trim();
    if (!trimmed) return;
    const found = storageService.getAdmissionByFile(trimmed);
    setSubmitted(true);
    if (found) {
      setAdmission(found);
      setNotFound(false);
    } else {
      setAdmission(null);
      setNotFound(true);
    }
  };

  const handleBack = () => {
    setAdmission(null);
    setNotFound(false);
    setSubmitted(false);
    setFileNumber('');
  };

  if (admission) {
    return (
      <div className="app-shell">
        <header className="sticky top-0 z-50 px-3 pt-3">
          <div className="max-w-7xl mx-auto panel-glass motion-card rounded-2xl overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-sky-500 to-cyan-400" />
            <div className="px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-20">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.2)]" />
                  <img
                    src="/aseer-health-cluster-logo.png"
                    alt={t('شعار تجمع عسير الصحي', 'Aseer Health Cluster Logo')}
                    className="h-12 md:h-14 w-auto max-w-[230px] object-contain"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onLanguageChange('ar')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors ${language === 'ar' ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-200'}`}
                    >
                      العربية
                    </button>
                    <button
                      onClick={() => onLanguageChange('en')}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors ${language === 'en' ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200 hover:border-sky-200'}`}
                    >
                      English
                    </button>
                  </div>
                  <button
                    onClick={handleBack}
                    className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition-colors border border-slate-200"
                  >
                    {t('خروج', 'Exit')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="container mx-auto px-2 md:px-4 pb-6">
          <PatientDashboard
            admission={admission}
            language={language}
            onBack={handleBack}
          />
        </main>
        <footer className="mx-3 mb-3 panel-glass rounded-2xl py-4 text-center text-xs font-semibold text-slate-600">
          Developed by Yahya Alizzi
        </footer>
      </div>
    );
  }

  return (
    <div className="app-shell flex items-center justify-center p-4 md:p-7 min-h-screen">
      <div className="w-full max-w-lg animate-fade-up">
        <div className="auth-shell-card motion-card w-full">
          {/* Header Banner */}
          <div className="relative overflow-hidden animated-gradient bg-gradient-to-br from-teal-700 via-sky-700 to-cyan-700 p-8 md:p-10 text-center text-white">
            <div className="absolute -top-10 -left-10 h-44 w-44 rounded-full bg-white/15 blur-xl" />
            <div className="absolute -bottom-12 right-16 h-44 w-44 rounded-full bg-cyan-200/20 blur-xl" />
            <img
              src="/aseer-health-cluster-logo.png"
              alt={t('شعار تجمع عسير الصحي', 'Aseer Health Cluster Logo')}
              className="relative z-10 mx-auto h-24 md:h-28 w-auto max-w-[420px] object-contain drop-shadow-[0_10px_24px_rgba(0,0,0,0.24)]"
            />
            <p className="relative z-10 text-sky-50/85 font-semibold text-sm mt-4">
              {t('بوابة المراجع — النداء الذكي', 'Patient Portal — Smart Call')}
            </p>
          </div>

          <div className="p-6 md:p-8">
            {/* Language Toggle */}
            <div className="flex justify-end mb-6">
              <div className="inline-flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm">
                <button
                  onClick={() => onLanguageChange('ar')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${language === 'ar' ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  العربية
                </button>
                <button
                  onClick={() => onLanguageChange('en')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${language === 'en' ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  English
                </button>
              </div>
            </div>

            <form onSubmit={handleLookup} className="space-y-5">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-1">
                  {t('بوابة المريض', 'Patient Portal')}
                </h2>
                <p className="text-sm text-slate-500 font-medium">
                  {t(
                    'أدخل رقم ملفك الطبي للوصول إلى خدمات النداء.',
                    'Enter your medical file number to access call services.'
                  )}
                </p>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {t('رقم الملف الطبي', 'Medical File Number')}
                </label>
                <input
                  type="text"
                  required
                  dir="ltr"
                  className="input-field text-center text-xl font-black tracking-widest"
                  placeholder={t('أدخل رقم ملفك', 'Enter your file number')}
                  value={fileNumber}
                  onChange={e => {
                    setFileNumber(e.target.value);
                    setNotFound(false);
                  }}
                />
              </div>

              {/* Not found error */}
              {notFound && submitted && (
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-center animate-fade-up">
                  <p className="text-red-700 font-bold text-sm mb-1">
                    {t('لم يتم إيجاد تنويمك', 'Admission not found')}
                  </p>
                  <p className="text-red-500 text-xs">
                    {t(
                      'رقم الملف غير موجود في سجلات التنويم. يرجى مراجعة مكتب القبول والدخول.',
                      'File number not found in admission records. Please contact the admission desk.'
                    )}
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="primary-action w-full py-4 rounded-2xl shadow-lg text-lg font-black"
              >
                {t('تحقق من التنويم', 'Check Admission')}
              </button>
            </form>

            {/* Staff link */}
            <div className="mt-6 pt-5 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-500 font-medium mb-2">
                {t('هل أنت موظف؟', 'Are you staff?')}
              </p>
              <a
                href="/admin"
                className="inline-block text-xs font-bold text-sky-700 hover:text-sky-900 underline underline-offset-2"
              >
                {t('دخول صفحة الأدمن والموظفين ←', 'Go to Admin / Staff Portal →')}
              </a>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500 font-semibold mt-4">
          Developed by Yahya Alizzi
        </p>
      </div>
    </div>
  );
};

export default PatientPortal;
