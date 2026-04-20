import React, { useEffect, useRef, useState } from 'react';
import { CallPriority, HealthRequest, RequestStatus, User } from '../types';
import { storageService } from '../services/storage';
import { Language, departmentLabel, hospitalLabel, pick, requestStatusLabel, serviceTypeLabel } from '../services/i18n';
import { priorityBadge, sortByPriority, playTone } from '../services/sound';
import { startEscalationWatcher, isEscalated, elapsedMinutes } from '../services/escalation';
import { useCallAlerts } from '../hooks/useCallAlerts';

interface Props {
  user: User;
  language: Language;
  onLogout: () => void;
  onLanguageChange: (l: Language) => void;
}

const NurseStationScreen: React.FC<Props> = ({ user, language, onLogout, onLanguageChange }) => {
  const t = (ar: string, en: string) => pick(language, ar, en);
  const [requests, setRequests] = useState<HealthRequest[]>([]);
  const [incomingNotice, setIncomingNotice] = useState('');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const audioUnlockedRef = useRef(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionReason, setCompletionReason] = useState('');

  const fetchData = () => {
    const all = storageService.getActiveRequestsByDepartment(user.assignedHospital ?? '');
    setRequests(sortByPriority(all));
  };

  useCallAlerts(requests, language, setIncomingNotice);

  useEffect(() => {
    fetchData();
    const onStorage = () => fetchData();
    window.addEventListener('storage', onStorage);
    const interval = setInterval(fetchData, 4000);
    const stopEscalation = startEscalationWatcher(req => {
      if (audioUnlockedRef.current) playTone('emergency');
      setIncomingNotice(t(
        `⚠️ ${req.patientName} — لم يُستجب له منذ أكثر من 5 دقائق`,
        `⚠️ ${req.patientName} — unanswered for over 5 minutes`
      ));
    });
    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
      stopEscalation();
    };
  }, [user.assignedHospital]);

  const handleAccept = (id: string) => {
    audioUnlockedRef.current = true;
    storageService.updateRequestStatus(id, RequestStatus.IN_PROGRESS);
    fetchData();
  };

  const handleCompleteClick = (id: string) => {
    setCompletingId(id);
    setCompletionReason('');
  };

  const handleCompleteConfirm = () => {
    if (!completionReason.trim() || !completingId) return;
    storageService.updateRequestStatus(completingId, RequestStatus.COMPLETED, completionReason.trim());
    playTone('dismiss');
    setCompletingId(null);
    setCompletionReason('');
    fetchData();
  };

  const handleCancel = (id: string) => {
    storageService.updateRequestStatus(id, RequestStatus.CANCELLED, t('إلغاء من شاشة التمريض', 'Cancelled from nursing station'));
    fetchData();
  };

  const unlockAudio = () => {
    audioUnlockedRef.current = true;
    setSoundUnlocked(true);
    playTone('other');
  };

  const departments = Array.from(new Set(requests.map(r => r.department)));
  const filtered = deptFilter === 'ALL' ? requests : requests.filter(r => r.department === deptFilter);
  const totalActive = requests.length;

  return (
    <div className="app-shell" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 px-3 pt-3">
        <div className="max-w-7xl mx-auto panel-glass rounded-2xl overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-teal-500 via-sky-500 to-cyan-400" />
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-20">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.2)]" />
                <img src="/aseer-health-cluster-logo.png" alt="Aseer Health" className="h-12 md:h-14 w-auto max-w-[120px] sm:max-w-[180px] object-contain" />
                <span className="hidden md:inline text-sm font-black text-slate-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                  {t('شاشة التمريض', 'Nursing Station')}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {/* Active calls badge */}
                {totalActive > 0 && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-3 py-1.5 rounded-full">
                    <span className="animate-ping inline-flex h-2 w-2 rounded-full bg-red-500 opacity-75" />
                    <span className="text-red-700 text-xs font-black">{totalActive} {t('نداء', 'calls')}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <button onClick={() => onLanguageChange('ar')} className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${language === 'ar' ? 'bg-sky-700 text-white border-sky-700' : 'text-slate-600 border-slate-200'}`}>ع</button>
                  <button onClick={() => onLanguageChange('en')} className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${language === 'en' ? 'bg-sky-700 text-white border-sky-700' : 'text-slate-600 border-slate-200'}`}>EN</button>
                </div>
                <div className="hidden md:block text-end">
                  <p className="text-sm font-bold text-slate-800">{user.name}</p>
                  <p className="text-xs text-slate-500">{hospitalLabel(user.assignedHospital ?? '', language)}</p>
                </div>
                <button onClick={onLogout} className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-red-100 border border-red-100">
                  {t('خروج', 'Logout')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-8 px-4">
        {/* Sound unlock */}
        {!soundUnlocked && (
          <button onClick={unlockAudio} className="sound-unlock-banner mb-6 block w-full">
            🔊 {t('انقر لتفعيل تنبيهات الصوت', 'Click to enable sound alerts')}
          </button>
        )}

        {/* Incoming notice */}
        {incomingNotice && (
          <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center justify-between gap-3 animate-fade-up">
            <p className="text-sm font-bold text-sky-800">🔔 {incomingNotice}</p>
            <button onClick={() => setIncomingNotice('')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-sky-200 text-sky-700">
              {t('إخفاء', 'Dismiss')}
            </button>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
          {([CallPriority.EMERGENCY, CallPriority.NURSE_CALL, CallPriority.MEDICATION, CallPriority.OTHER] as CallPriority[]).map(priority => {
            const badge = priorityBadge(priority);
            const count = requests.filter(r => (r.priority ?? 'OTHER') === priority).length;
            return (
              <div key={priority} className={`rounded-2xl p-4 text-center border ${badge.bg} ${badge.border}`}>
                <p className={`text-3xl font-black ${badge.text}`}>{count}</p>
                <p className={`text-xs font-bold ${badge.text}`}>{language === 'en' ? badge.labelEn : badge.label}</p>
              </div>
            );
          })}
        </div>

        {/* Department filter */}
        {departments.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button onClick={() => setDeptFilter('ALL')} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${deptFilter === 'ALL' ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200'}`}>
              {t('الكل', 'All')} ({requests.length})
            </button>
            {departments.map(dept => (
              <button key={dept} onClick={() => setDeptFilter(dept)} className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${deptFilter === dept ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200'}`}>
                {departmentLabel(dept, language)} ({requests.filter(r => r.department === dept).length})
              </button>
            ))}
          </div>
        )}

        {/* Requests */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {filtered.length === 0 ? (
            <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400">
              <p className="text-5xl mb-3">✅</p>
              <p className="text-lg font-bold">{t('لا توجد نداءات نشطة', 'No active calls')}</p>
            </div>
          ) : (
            filtered.map(req => {
              const badge = priorityBadge(req.priority);
              const escalated = isEscalated(req);
              const elapsed = elapsedMinutes(req.createdAt);
              return (
                <div key={req.id}
                  className={`bg-white rounded-[2rem] shadow-sm p-6 border-2 flex flex-col gap-3 ${badge.border} ${req.priority === CallPriority.EMERGENCY ? 'emergency-pulse' : req.priority === CallPriority.NURSE_CALL ? 'nurse-pulse' : ''}`}
                >
                  {/* Priority + status */}
                  <div className="flex justify-between items-start gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black ${badge.bg} ${badge.text}`}>
                      {language === 'en' ? badge.labelEn : badge.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {escalated && <span className="px-2 py-1 rounded-full text-[10px] font-black bg-red-600 text-white">⚠️ {t('+5د', '+5m')}</span>}
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${req.status === RequestStatus.PENDING ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700'}`}>
                        {requestStatusLabel(req.status, language)}
                      </span>
                    </div>
                  </div>

                  {/* Patient info */}
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{req.patientName}</h3>
                    <p className="text-sky-700 font-bold text-sm">
                      {departmentLabel(req.department, language)} — {t('غرفة', 'Rm')} {req.roomNumber} / {t('سرير', 'Bed')} {req.bedNumber}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <p className="font-bold text-slate-800 text-sm">{serviceTypeLabel(req.serviceType, language)}</p>
                    {req.description && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-black text-amber-600 mb-0.5">{t('ملاحظة المريض', 'Patient Note')}</p>
                        <p className="text-sm text-amber-900 font-bold">"{req.description}"</p>
                      </div>
                    )}
                    <p className={`text-[10px] mt-1.5 font-bold ${elapsed >= 5 ? 'text-red-500' : 'text-slate-400'}`}>
                      {t(`منذ ${elapsed} دقيقة`, `${elapsed} min ago`)}
                    </p>
                  </div>

                  {/* Actions */}
                  <button onClick={() => handleCompleteClick(req.id)} className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold hover:bg-emerald-700">
                    {t('إغلاق التنبيه ✓', 'Close Alert ✓')}
                  </button>
                  <button onClick={() => handleCancel(req.id)} className="w-full bg-slate-100 text-slate-600 py-2 rounded-2xl font-bold hover:bg-slate-200 text-sm">
                    {t('إلغاء النداء', 'Cancel Call')}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>

      <footer className="mx-3 mb-3 panel-glass rounded-2xl py-4 text-center text-xs font-semibold text-slate-600">
        Developed by Yahya Alizzi
      </footer>

      {/* Completion Reason Modal */}
      {completingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" dir="rtl">
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md animate-fade-up">
            <h3 className="text-lg font-black text-slate-800 mb-1">{t('سبب إغلاق التنبيه', 'Reason for Closing')}</h3>
            <p className="text-xs text-slate-500 mb-4">{t('يُحفظ السبب في سجل النداء لمراجعة المشرف', 'Reason is saved in the call record for supervisor review')}</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                t('تم حل الطلب', 'Request resolved'),
                t('النداء كان بالغلط', 'Call was accidental'),
                t('تم تحويل المريض', 'Patient transferred'),
                t('تمت الاستجابة من زميل', 'Colleague responded'),
              ].map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCompletionReason(preset)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${completionReason === preset ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 text-slate-600 border-slate-200 hover:border-emerald-400'}`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 h-24 resize-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none mb-4 text-sm"
              value={completionReason}
              onChange={e => setCompletionReason(e.target.value)}
              placeholder={t('أو اكتب السبب هنا...', 'Or type your reason here...')}
            />
            <div className="flex gap-3">
              <button
                onClick={handleCompleteConfirm}
                disabled={!completionReason.trim()}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('تأكيد الإغلاق', 'Confirm Close')}
              </button>
              <button
                onClick={() => setCompletingId(null)}
                className="px-5 py-3 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200"
              >
                {t('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NurseStationScreen;
