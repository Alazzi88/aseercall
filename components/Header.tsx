import React, { useState, useEffect } from 'react';
import { UserRole, User } from '../types';
import { storageService } from '../services/storage';
import { Language, pick, roleLabel } from '../services/i18n';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  onOpenProfile?: () => void;
  language: Language;
  onLanguageChange: (language: Language) => void;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  onOpenProfile,
  language,
  onLanguageChange
}) => {
  const [newCount, setNewCount] = useState(0);
  const isEnglish = language === 'en';

  useEffect(() => {
    if (!user) return;
    const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.OWNER;
    const isNurse = user.role === UserRole.NURSE;
    if (!isAdmin && !isNurse) return;

    const checkNew = () => {
      if (isAdmin) {
        const lastView = storageService.getAdminLastView();
        setNewCount(storageService.getRequests().filter(r => r.createdAt > lastView).length);
      } else if (isNurse && user.assignedHospital) {
        setNewCount(storageService.getActiveRequestsByDepartment(user.assignedHospital).length);
      }
    };
    checkNew();
    const interval = setInterval(checkNew, 5000);
    return () => clearInterval(interval);
  }, [user]);

  const languageButtonClass = (target: Language) =>
    `rounded-lg px-2.5 py-1 text-xs font-bold border transition-colors ${
      language === target
        ? 'bg-sky-700 text-white border-sky-700'
        : 'bg-white text-slate-600 border-slate-200 hover:border-sky-200'
    }`;

  return (
    <header className="sticky top-0 z-50 px-3 pt-3">
      <div className="max-w-7xl mx-auto panel-glass motion-card rounded-2xl overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-sky-500 to-cyan-400" />
        <div className="px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.2)]" />
              <img
                src="/aseer-health-cluster-logo.png"
                alt={pick(language, 'شعار تجمع عسير الصحي', 'Aseer Health Cluster Logo')}
                className="h-9 sm:h-12 md:h-14 w-auto max-w-[140px] sm:max-w-[200px] object-contain"
              />
            </div>

            {user && (
              <div className={`flex items-center ${isEnglish ? 'space-x-4' : 'space-x-4 space-x-reverse'}`}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onLanguageChange('ar')}
                    className={languageButtonClass('ar')}
                  >
                    العربية
                  </button>
                  <button
                    type="button"
                    onClick={() => onLanguageChange('en')}
                    className={languageButtonClass('en')}
                  >
                    English
                  </button>
                </div>

                {(user.role === UserRole.ADMIN || user.role === UserRole.OWNER || user.role === UserRole.NURSE) && newCount > 0 && (
                  <div className="relative">
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[10px] text-white items-center justify-center font-bold">
                        {newCount}
                      </span>
                    </span>
                    <svg className="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                )}

                <div
                  className="hidden lg:flex flex-col items-start cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={onOpenProfile}
                >
                  <p className="text-sm font-bold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{roleLabel(user.role, language)}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="bg-red-50 text-red-700 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold hover:bg-red-100 transition-colors border border-red-100"
                >
                  {isEnglish ? 'Logout' : 'تسجيل الخروج'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
