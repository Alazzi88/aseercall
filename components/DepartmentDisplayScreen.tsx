import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CallPriority, HealthRequest, PatientAdmission, SLUG_TO_DEPARTMENT, SLUG_TO_HOSPITAL } from '../types';
import { storageService } from '../services/storage';
import { Language, pick, departmentLabel, hospitalLabel } from '../services/i18n';
import { priorityBadge, sortByPriority, playTone, toneForPriority } from '../services/sound';
import { isEscalated, elapsedMinutes } from '../services/escalation';
import { useRealTimeData } from '../hooks/useRealTimeData';

interface Props {
  language: Language;
  onLanguageChange: (l: Language) => void;
}

const DepartmentDisplayScreen: React.FC<Props> = ({ language, onLanguageChange }) => {
  const { hospitalSlug, deptSlug } = useParams<{ hospitalSlug: string; deptSlug: string }>();
  const t = (ar: string, en: string) => pick(language, ar, en);

  const hospitalName = SLUG_TO_HOSPITAL[hospitalSlug ?? ''] ?? '';
  const department = SLUG_TO_DEPARTMENT[deptSlug ?? ''] ?? '';

  const audioUnlockedRef = useRef(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const prevRequestsCountRef = useRef(0);
  const [now, setNow] = useState(Date.now());

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const requests = useRealTimeData<HealthRequest[]>(
    () => {
      const all = storageService.getActiveRequestsByDepartment(hospitalName, department);
      return sortByPriority(all);
    },
    [hospitalName, department]
  );

  const admissions = useRealTimeData<PatientAdmission[]>(
    () => storageService.getAdmissions().filter(a => a.hospitalName === hospitalName && a.department === department),
    [hospitalName, department]
  );

  // Play sound for new requests
  useEffect(() => {
    if (!audioUnlockedRef.current) {
      prevRequestsCountRef.current = requests.length;
      return;
    }
    if (requests.length > prevRequestsCountRef.current) {
      const topNew = requests[0];
      if (topNew) playTone(toneForPriority(topNew.priority));
    }
    prevRequestsCountRef.current = requests.length;
  }, [requests.length]);

  const unlockAudio = () => {
    audioUnlockedRef.current = true;
    setSoundUnlocked(true);
    playTone('other');
  };

  // Room grid: combine admissions + active requests
  const roomMap = new Map<string, { admission: PatientAdmission; request?: HealthRequest }>();
  admissions.forEach(a => roomMap.set(a.roomNumber, { admission: a }));
  requests.forEach(req => {
    const existing = roomMap.get(req.roomNumber);
    if (existing) existing.request = req;
  });

  const timeStr = new Date(now).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

  if (!hospitalName || !department) {
    return (
      <div className="display-screen flex items-center justify-center min-h-screen">
        <div className="text-center text-slate-400">
          <p className="text-2xl font-bold mb-2">{t('الرابط غير صحيح', 'Invalid URL')}</p>
          <p className="text-sm">{t('تحقق من اسم المستشفى والقسم', 'Check hospital and department names')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="display-screen min-h-screen p-4 sm:p-6 md:p-8" dir="rtl">
      {/* Sound unlock overlay */}
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
              {departmentLabel(department, language)}
            </h1>
            <p className="text-slate-400 text-sm font-bold">
              {hospitalLabel(hospitalName, language)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-black text-white">{admissions.length}</p>
            <p className="text-slate-400 text-xs font-bold">{t('مريض', 'Patients')}</p>
          </div>
          <div className={`text-center px-5 py-2 rounded-2xl ${requests.length > 0 ? 'bg-red-900/40 border border-red-500/40' : 'bg-slate-800/60'}`}>
            <p className={`text-4xl font-black ${requests.length > 0 ? 'text-red-400' : 'text-white'}`}>{requests.length}</p>
            <p className="text-slate-400 text-xs font-bold">{t('نداء نشط', 'Active Calls')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-black text-slate-300">{timeStr}</p>
            <div className="flex items-center gap-1.5 mt-1 justify-center">
              <button onClick={() => onLanguageChange('ar')} className={`text-xs font-bold px-2 py-0.5 rounded ${language === 'ar' ? 'bg-sky-700 text-white' : 'text-slate-400'}`}>ع</button>
              <button onClick={() => onLanguageChange('en')} className={`text-xs font-bold px-2 py-0.5 rounded ${language === 'en' ? 'bg-sky-700 text-white' : 'text-slate-400'}`}>EN</button>
            </div>
          </div>
        </div>
      </div>

      {/* Active Calls Section */}
      {requests.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-black text-slate-300 mb-4 uppercase tracking-wider">
            🔔 {t('النداءات النشطة', 'Active Calls')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {requests.map(req => {
              const badge = priorityBadge(req.priority);
              const escalated = isEscalated(req);
              const elapsed = elapsedMinutes(req.createdAt);
              return (
                <div
                  key={req.id}
                  className={`display-card p-5 flex flex-col gap-3 ${
                    req.priority === CallPriority.EMERGENCY ? 'display-card-emergency emergency-pulse'
                    : req.priority === CallPriority.NURSE_CALL ? 'display-card-nurse nurse-pulse'
                    : req.priority === CallPriority.MEDICATION ? 'display-card-medication'
                    : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-black ${badge.bg} ${badge.text} mb-2`}>
                        {language === 'en' ? badge.labelEn : badge.label}
                      </span>
                      <h3 className="text-xl font-black text-white">{req.patientName}</h3>
                      <p className="text-slate-400 text-sm font-bold">
                        {t(`غرفة ${req.roomNumber} — سرير ${req.bedNumber}`, `Room ${req.roomNumber} — Bed ${req.bedNumber}`)}
                      </p>
                    </div>
                    <div className="text-end flex-shrink-0">
                      <p className={`text-2xl font-black ${elapsed >= 5 ? 'text-red-400' : 'text-slate-400'}`}>{elapsed}'</p>
                      {escalated && <p className="text-[10px] text-red-400 font-black">⚠️ {t('تأخر', 'Delayed')}</p>}
                    </div>
                  </div>

                  <div className="bg-white/5 rounded-xl p-3">
                    <p className="text-white font-bold text-sm">{req.serviceType}</p>
                    {req.description && (
                      <div className="mt-2 bg-amber-500/10 border border-amber-400/30 rounded-lg px-3 py-2">
                        <p className="text-amber-300 text-[10px] font-black mb-0.5">{t('ملاحظة المريض', 'Patient Note')}</p>
                        <p className="text-amber-100 text-xs font-bold">"{req.description}"</p>
                      </div>
                    )}
                  </div>

                  <div className="w-full bg-slate-700/60 text-slate-400 py-3 rounded-xl font-bold text-sm text-center select-none">
                    ⏳ {t('تم تلقي النداء — بانتظار الاستجابة', 'Call received — awaiting response')}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Room Grid */}
      <section>
        <h2 className="text-lg font-black text-slate-300 mb-4 uppercase tracking-wider">
          🛏 {t('شبكة الغرف', 'Room Grid')} ({admissions.length})
        </h2>
        {admissions.length === 0 ? (
          <div className="display-card p-8 text-center text-slate-500">
            <p className="text-xl font-bold">{t('لا يوجد مرضى منومين في هذا القسم حالياً', 'No admitted patients in this department')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from(roomMap.values()).map(({ admission, request }) => {
              const badge = request ? priorityBadge(request.priority) : null;
              return (
                <div
                  key={admission.roomNumber}
                  className={`display-card p-3 text-center ${request ? `border-2 ${badge?.border ?? ''}` : ''} ${request?.priority === CallPriority.EMERGENCY ? 'emergency-pulse' : ''}`}
                >
                  <p className="text-2xl font-black text-white">{admission.roomNumber}</p>
                  <p className="text-slate-400 text-xs mt-1 truncate">{admission.patientName.split(' ')[0]}</p>
                  <p className="text-slate-500 text-[10px]">{t('سرير', 'Bed')} {admission.bedNumber}</p>
                  {request && badge && (
                    <span className={`mt-2 inline-block px-2 py-0.5 rounded-full text-[9px] font-black ${badge.bg} ${badge.text}`}>
                      {language === 'en' ? badge.labelEn : badge.label}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Footer */}
      <div className="mt-8 text-center text-slate-600 text-xs font-bold">
        Aseer Health Cluster — Smart Call System | Developed by Yahya Alizzi
      </div>
    </div>
  );
};

export default DepartmentDisplayScreen;
