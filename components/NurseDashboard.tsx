import React, { useEffect, useRef, useState } from 'react';
import { CallPriority, HealthRequest, RequestStatus, User } from '../types';
import { storageService } from '../services/storage';
import { Language, departmentLabel, hospitalLabel, pick, requestStatusLabel, serviceTypeLabel } from '../services/i18n';
import { priorityBadge, sortByPriority, playTone } from '../services/sound';
import { startEscalationWatcher, isEscalated, elapsedMinutes } from '../services/escalation';
import { useCallAlerts } from '../hooks/useCallAlerts';

interface NurseDashboardProps {
  user: User;
  language?: Language;
}

const matchesScope = (req: HealthRequest, user: User) =>
  !user.assignedHospital || req.hospitalName === user.assignedHospital;

const NurseDashboard: React.FC<NurseDashboardProps> = ({ user, language = 'ar' }) => {
  const t = (ar: string, en: string) => pick(language, ar, en);
  const [requests, setRequests] = useState<HealthRequest[]>([]);
  const [incomingNotice, setIncomingNotice] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');
  const audioUnlockedRef = useRef(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionReason, setCompletionReason] = useState('');

  const fetchData = () => {
    const all = storageService.getRequests();
    const active = all.filter(r => r.status !== RequestStatus.COMPLETED && r.status !== RequestStatus.CANCELLED);
    const scoped = active.filter(r => matchesScope(r, user));
    setRequests(sortByPriority(scoped));
  };

  useCallAlerts(requests, language, setIncomingNotice);

  useEffect(() => {
    fetchData();
    const onStorage = () => fetchData();
    window.addEventListener('storage', onStorage);
    const interval = setInterval(fetchData, 4000);

    const stopEscalation = startEscalationWatcher(req => {
      playTone('emergency');
      setIncomingNotice(t(
        `⚠️ تنبيه: نداء من ${req.patientName} لم يُستجب له منذ أكثر من 5 دقائق!`,
        `⚠️ Alert: Call from ${req.patientName} unanswered for over 5 minutes!`
      ));
    });

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(interval);
      stopEscalation();
    };
  }, [user.assignedHospital]);

  const handleUpdate = (id: string, status: RequestStatus) => {
    audioUnlockedRef.current = true;
    storageService.updateRequestStatus(id, status);
    fetchData();
  };

  const handleCompleteClick = (id: string) => {
    setCompletingId(id);
    setCompletionReason('');
  };

  const handleCompleteConfirm = () => {
    if (!completionReason.trim() || !completingId) return;
    audioUnlockedRef.current = true;
    storageService.updateRequestStatus(completingId, RequestStatus.COMPLETED, completionReason.trim());
    playTone('dismiss');
    setCompletingId(null);
    setCompletionReason('');
    fetchData();
  };

  const unlockAudio = () => {
    audioUnlockedRef.current = true;
    playTone('other');
  };

  const departments = Array.from(new Set(requests.map(r => r.department)));
  const filtered = deptFilter === 'ALL' ? requests : requests.filter(r => r.department === deptFilter);
  const scopeLabel = user.assignedHospital ? hospitalLabel(user.assignedHospital, language) : t('جميع المستشفيات', 'All Hospitals');

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-4 animate-fade-up">
      {!audioUnlockedRef.current && (
        <button onClick={unlockAudio} className="sound-unlock-banner mb-4 block">
          🔊 {t('انقر لتفعيل تنبيهات الصوت', 'Click to enable sound alerts')}
        </button>
      )}

      {incomingNotice && (
        <div className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-sky-800">🔔 {incomingNotice}</p>
          <button onClick={() => setIncomingNotice('')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-sky-200 text-sky-700 hover:bg-sky-100">
            {t('إخفاء', 'Dismiss')}
          </button>
        </div>
      )}

      {/* Header */}
      <div className="motion-card animated-gradient bg-slate-800 rounded-[2.5rem] p-5 sm:p-8 mb-6 sm:mb-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2">{t('شاشة التمريض — استقبال النداءات', 'Nursing Dashboard')}</h2>
          <p className="opacity-70 text-sm">{scopeLabel}</p>
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          {([CallPriority.EMERGENCY, CallPriority.NURSE_CALL, CallPriority.MEDICATION] as CallPriority[]).map(priority => {
            const badge = priorityBadge(priority);
            const count = requests.filter(r => (r.priority ?? 'OTHER') === priority).length;
            return (
              <div key={priority} className={`px-4 py-3 rounded-2xl text-center min-w-[68px] ${badge.bg} border ${badge.border}`}>
                <p className={`text-2xl font-black ${badge.text}`}>{count}</p>
                <p className={`text-[10px] font-bold ${badge.text}`}>{language === 'en' ? badge.labelEn : badge.label}</p>
              </div>
            );
          })}
          <div className="bg-white/10 px-4 py-3 rounded-2xl text-center min-w-[68px] border border-white/20">
            <p className="text-2xl font-black">{requests.length}</p>
            <p className="text-[10px] font-bold opacity-70">{t('إجمالي', 'Total')}</p>
          </div>
        </div>
      </div>

      {/* Department filter */}
      {departments.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setDeptFilter('ALL')}
            className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${deptFilter === 'ALL' ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200'}`}
          >
            {t('الكل', 'All')} ({requests.length})
          </button>
          {departments.map(dept => (
            <button key={dept} onClick={() => setDeptFilter(dept)}
              className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${deptFilter === dept ? 'bg-sky-700 text-white border-sky-700' : 'bg-white text-slate-600 border-slate-200'}`}
            >
              {departmentLabel(dept, language)} ({requests.filter(r => r.department === dept).length})
            </button>
          ))}
        </div>
      )}

      {/* Requests Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full py-24 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 text-slate-400">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-lg font-bold">{t('لا يوجد نداءات نشطة حالياً.', 'No active calls right now.')}</p>
          </div>
        ) : (
          filtered.map(req => {
            const badge = priorityBadge(req.priority);
            const escalated = isEscalated(req);
            const elapsed = elapsedMinutes(req.createdAt);
            return (
              <div key={req.id}
                className={`bg-white rounded-[2rem] shadow-sm p-6 border-2 flex flex-col justify-between ${badge.border} ${req.priority === CallPriority.EMERGENCY ? 'emergency-pulse' : req.priority === CallPriority.NURSE_CALL ? 'nurse-pulse' : ''}`}
              >
                <div>
                  <div className="flex justify-between items-start mb-4 gap-2 flex-wrap">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                      {language === 'en' ? badge.labelEn : badge.label}
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {escalated && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-black bg-red-600 text-white animate-pulse">
                          ⚠️ {t('+5 دقائق', '+5min')}
                        </span>
                      )}
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${req.status === RequestStatus.PENDING ? 'bg-red-100 text-red-600' : 'bg-sky-100 text-sky-700'}`}>
                        {requestStatusLabel(req.status, language)}
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900 mb-1">{req.patientName}</h3>
                  <p className="text-xs text-slate-500 mb-1">{hospitalLabel(req.hospitalName, language)}</p>
                  <p className="text-sky-700 font-bold text-sm mb-3">
                    {departmentLabel(req.department, language)} — {t('غرفة', 'Rm')} {req.roomNumber} / {t('سرير', 'Bed')} {req.bedNumber}
                  </p>

                  <div className="bg-slate-50 p-3 rounded-xl mb-4 border border-slate-100">
                    <p className="font-bold text-slate-800 text-sm">{serviceTypeLabel(req.serviceType, language)}</p>
                    {req.description && (
                      <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        <p className="text-[10px] font-black text-amber-600 mb-0.5">{t('ملاحظة المريض', 'Patient Note')}</p>
                        <p className="text-sm text-amber-900 font-bold">"{req.description}"</p>
                      </div>
                    )}
                    <p className={`text-[10px] mt-2 font-bold ${elapsed >= 5 ? 'text-red-500' : 'text-slate-400'}`}>
                      {t(`منذ ${elapsed} دقيقة`, `${elapsed} min ago`)}
                    </p>
                  </div>
                </div>

                <button onClick={() => handleCompleteClick(req.id)}
                  className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold hover:bg-emerald-700">
                  {t('إغلاق التنبيه ✓', 'Close Alert ✓')}
                </button>
              </div>
            );
          })
        )}
      </div>

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

export default NurseDashboard;
