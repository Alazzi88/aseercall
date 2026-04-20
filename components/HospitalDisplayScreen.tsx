import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SLUG_TO_HOSPITAL, DEPARTMENT_SLUGS, DEPARTMENTS, HOSPITAL_SLUGS } from '../types';
import { storageService } from '../services/storage';
import { Language, pick, departmentLabel, hospitalLabel } from '../services/i18n';
import { priorityBadge, sortByPriority, playTone, toneForPriority } from '../services/sound';
import { useRealTimeData } from '../hooks/useRealTimeData';

interface Props {
  language: Language;
  onLanguageChange: (l: Language) => void;
}

const HospitalDisplayScreen: React.FC<Props> = ({ language, onLanguageChange }) => {
  const { hospitalSlug } = useParams<{ hospitalSlug: string }>();
  const navigate = useNavigate();
  const t = (ar: string, en: string) => pick(language, ar, en);

  const hospitalName = SLUG_TO_HOSPITAL[hospitalSlug ?? ''] ?? '';
  const audioUnlockedRef = useRef(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [now, setNow] = useState(Date.now());
  const prevCountRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // All active requests for this hospital
  const requests = useRealTimeData(
    () => {
      if (!hospitalName) return [];
      return sortByPriority(storageService.getActiveRequestsByDepartment(hospitalName));
    },
    [hospitalName]
  );

  // All admissions for this hospital
  const admissions = useRealTimeData(
    () => {
      if (!hospitalName) return [];
      return storageService.getAdmissions().filter(a => a.hospitalName === hospitalName);
    },
    [hospitalName]
  );

  // Play sound for new requests
  useEffect(() => {
    if (!audioUnlockedRef.current) {
      prevCountRef.current = requests.length;
      return;
    }
    if (requests.length > prevCountRef.current && requests[0]) {
      playTone(toneForPriority(requests[0].priority));
    }
    prevCountRef.current = requests.length;
  }, [requests.length]);

  // Build per-department stats
  const deptStats = DEPARTMENTS.map(dept => {
    const deptAdmissions = admissions.filter(a => a.department === dept);
    const deptRequests = requests.filter(r => r.department === dept);
    const slug = DEPARTMENT_SLUGS[dept] ?? '';
    return { dept, slug, admissions: deptAdmissions.length, requests: deptRequests.length, topRequest: deptRequests[0] };
  }).filter(s => s.admissions > 0 || s.requests > 0);

  const unlockAudio = () => {
    audioUnlockedRef.current = true;
    setSoundUnlocked(true);
    playTone('other');
  };

  const timeStr = new Date(now).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  if (!hospitalName) {
    return (
      <div className="display-screen flex items-center justify-center min-h-screen">
        <div className="text-center text-slate-400">
          <p className="text-2xl font-bold">{t('مستشفى غير موجود', 'Hospital not found')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="display-screen min-h-screen p-4 sm:p-6 md:p-8" dir="rtl">
      {!soundUnlocked && (
        <button onClick={unlockAudio} className="sound-unlock-banner">
          🔊 {t('انقر لتفعيل الصوت', 'Click to enable sound')}
        </button>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <img src="/aseer-health-cluster-logo.png" alt="Aseer Health" className="h-14 w-auto object-contain opacity-90" />
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white">
              {hospitalLabel(hospitalName, language)}
            </h1>
            <p className="text-slate-400 text-sm font-bold">{t('لوحة متابعة المستشفى', 'Hospital Overview Board')}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-black text-white">{admissions.length}</p>
            <p className="text-slate-400 text-xs font-bold">{t('إجمالي المرضى', 'Total Patients')}</p>
          </div>
          <div className={`text-center px-5 py-2 rounded-2xl ${requests.length > 0 ? 'bg-red-900/40 border border-red-500/40' : 'bg-slate-800/60'}`}>
            <p className={`text-4xl font-black ${requests.length > 0 ? 'text-red-400' : 'text-white'}`}>{requests.length}</p>
            <p className="text-slate-400 text-xs font-bold">{t('نداءات نشطة', 'Active Calls')}</p>
          </div>
          <p className="text-2xl font-black text-slate-300">{timeStr}</p>
        </div>
      </div>

      {/* Department Grid */}
      {deptStats.length === 0 ? (
        <div className="display-card p-16 text-center text-slate-500">
          <p className="text-2xl font-bold">{t('لا يوجد بيانات حالياً', 'No data available')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {deptStats.map(({ dept, slug, admissions: deptAd, requests: deptReq, topRequest }) => {
            const badge = topRequest ? priorityBadge(topRequest.priority) : null;
            return (
              <button
                key={dept}
                onClick={() => navigate(`/display/${hospitalSlug}/${slug}`)}
                className={`display-card p-5 text-start transition-all hover:scale-105 hover:border-sky-500/40 cursor-pointer ${deptReq > 0 && topRequest?.priority === 'EMERGENCY' ? 'emergency-pulse' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-4">
                  <h3 className="text-lg font-black text-white">{departmentLabel(dept, language)}</h3>
                  {deptReq > 0 && badge && (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-black ${badge.bg} ${badge.text}`}>
                      {deptReq} {language === 'en' ? badge.labelEn : badge.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-3xl font-black text-white">{deptAd}</p>
                    <p className="text-slate-400 text-xs">{t('مريض', 'patients')}</p>
                  </div>
                  {deptReq > 0 && (
                    <div>
                      <p className="text-3xl font-black text-red-400">{deptReq}</p>
                      <p className="text-red-400 text-xs">{t('نداء', 'calls')}</p>
                    </div>
                  )}
                </div>
                {topRequest && (
                  <div className="mt-3 bg-white/5 rounded-xl p-2">
                    <p className="text-white text-xs font-bold truncate">{topRequest.patientName}</p>
                    <p className="text-slate-400 text-[10px]">{topRequest.serviceType}</p>
                  </div>
                )}
                <p className="mt-3 text-sky-400 text-xs font-bold">{t('انقر للتفاصيل ←', 'Tap for details →')}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Navigation links to all departments */}
      <div className="mt-8">
        <h3 className="text-slate-500 text-xs font-bold mb-3 uppercase">{t('روابط الأقسام', 'Department Links')}</h3>
        <div className="flex flex-wrap gap-2">
          {DEPARTMENTS.map(dept => {
            const slug = DEPARTMENT_SLUGS[dept];
            if (!slug) return null;
            return (
              <a
                key={dept}
                href={`/display/${hospitalSlug}/${slug}`}
                className="px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
              >
                {departmentLabel(dept, language)}
              </a>
            );
          })}
        </div>
      </div>

      <div className="mt-6 text-center text-slate-600 text-xs font-bold">
        Aseer Health Cluster — Smart Call System | Developed by Yahya Alizzi
      </div>
    </div>
  );
};

export default HospitalDisplayScreen;
