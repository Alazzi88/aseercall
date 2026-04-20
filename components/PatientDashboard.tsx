import React, { useEffect, useMemo, useState } from 'react';
import { HealthRequest, RequestStatus, SERVICE_TYPES, PatientAdmission } from '../types';
import { storageService } from '../services/storage';
import { derivePriority } from '../types';
import { priorityBadge } from '../services/sound';
import {
  Language,
  departmentLabel,
  formatDateTime,
  hospitalLabel,
  pick,
  requestStatusLabel,
  serviceTypeLabel,
  serviceTypeOptions
} from '../services/i18n';

interface PatientDashboardProps {
  admission: PatientAdmission;
  language?: Language;
  onBack?: () => void;
}

const PatientDashboard: React.FC<PatientDashboardProps> = ({
  admission,
  language = 'ar',
  onBack
}) => {
  const t = (ar: string, en: string) => pick(language, ar, en);
  const [requests, setRequests] = useState<HealthRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'LIST' | 'NEW'>('LIST');
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const translatedServiceTypes = useMemo(() => serviceTypeOptions(language), [language]);

  const fetchData = () => {
    const all = storageService.getRequests().filter(r => r.fileNumber === admission.fileNumber);
    setRequests(all);
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('storage', fetchData);
    return () => window.removeEventListener('storage', fetchData);
  }, [admission.fileNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 300));
    storageService.saveRequest({
      fileNumber: admission.fileNumber,
      patientName: admission.patientName,
      roomNumber: admission.roomNumber,
      bedNumber: admission.bedNumber,
      hospitalName: admission.hospitalName,
      department: admission.department,
      serviceType,
      description
    });
    setServiceType(SERVICE_TYPES[0]);
    setDescription('');
    setIsSubmitting(false);
    setActiveTab('LIST');
    setSuccessMsg(t('تم إرسال نداءك. سيصلك الرد قريباً.', 'Your call was sent. You will be attended to shortly.'));
    setTimeout(() => setSuccessMsg(''), 5000);
    fetchData();
  };

  const activeCount = requests.filter(r => r.status === RequestStatus.PENDING || r.status === RequestStatus.IN_PROGRESS).length;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-fade-up">
      {/* Admission Banner */}
      <div className="motion-card animated-gradient bg-gradient-to-l from-sky-700 to-sky-900 rounded-[2.5rem] p-8 text-white mb-8 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-sky-200 text-sm font-bold uppercase tracking-widest mb-2">
              {t('بوابة المريض', 'Patient Portal')}
            </p>
            <h2 className="text-3xl font-bold mb-3">{admission.patientName}</h2>
            <div className="flex flex-wrap gap-2">
              <span className="bg-white/20 px-4 py-1 rounded-full text-xs font-bold">
                {t('ملف', 'File')}: {admission.fileNumber}
              </span>
              <span className="bg-white/20 px-4 py-1 rounded-full text-xs font-bold">
                {hospitalLabel(admission.hospitalName, language)}
              </span>
            </div>
          </div>
          <div className="bg-white/10 p-5 rounded-[1.5rem] backdrop-blur-md border border-white/20 text-center min-w-[160px]">
            <p className="text-xs opacity-70 mb-1">{t('موقعك', 'Your Location')}</p>
            <p className="text-2xl font-black">{t('غرفة', 'Room')} {admission.roomNumber}</p>
            <p className="text-sm font-bold mt-1">{t('سرير', 'Bed')} {admission.bedNumber}</p>
            <p className="text-xs mt-2 opacity-80">{departmentLabel(admission.department, language)}</p>
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 animate-fade-up">
          <p className="text-sm font-bold text-emerald-800">{successMsg}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-white rounded-t-[2rem] border-b overflow-hidden shadow-sm p-1">
        <button
          onClick={() => setActiveTab('LIST')}
          className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${activeTab === 'LIST' ? 'bg-sky-50 text-sky-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {t('بلاغاتي', 'My Requests')}
          {activeCount > 0 && (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-white text-[10px] font-black">{activeCount}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('NEW')}
          className={`flex-1 py-4 rounded-2xl font-bold transition-all ${activeTab === 'NEW' ? 'bg-sky-50 text-sky-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
        >
          {t('إرسال نداء', 'Send Call')}
        </button>
      </div>

      <div className="bg-white rounded-b-[2rem] shadow-sm p-8 min-h-[400px]">
        {activeTab === 'LIST' ? (
          <div className="space-y-4">
            {requests.length === 0 ? (
              <div className="py-16 text-center text-slate-400">
                <p className="text-5xl mb-4">🔔</p>
                <p className="font-bold text-lg">{t('لا توجد بلاغات حالياً', 'No requests yet')}</p>
                <p className="text-sm mt-1">{t('اضغط على "إرسال نداء" للطلب', 'Tap "Send Call" to request help')}</p>
              </div>
            ) : (
              requests.map(req => {
                const badge = priorityBadge(req.priority ?? derivePriority(req.serviceType));
                return (
                  <div key={req.id} className="border border-gray-100 bg-gray-50/40 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-gray-900">{serviceTypeLabel(req.serviceType, language)}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
                          {language === 'en' ? badge.labelEn : badge.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{formatDateTime(req.createdAt, language)}</p>
                      {req.description && (
                        <p className="text-sm text-gray-500 mt-2 bg-white p-3 rounded-xl italic border border-gray-100">"{req.description}"</p>
                      )}
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold flex-shrink-0 ${
                      req.status === RequestStatus.PENDING ? 'bg-amber-100 text-amber-700'
                      : req.status === RequestStatus.IN_PROGRESS ? 'bg-sky-100 text-sky-700'
                      : req.status === RequestStatus.COMPLETED ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                    }`}>
                      {requestStatusLabel(req.status, language)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">{t('نوع الطلب', 'Request Type')}</label>
              <div className="grid grid-cols-2 gap-3">
                {translatedServiceTypes.map(service => {
                  const badge = priorityBadge(derivePriority(service.value));
                  const selected = serviceType === service.value;
                  return (
                    <button
                      key={service.value}
                      type="button"
                      onClick={() => setServiceType(service.value)}
                      className={`p-3 rounded-xl text-xs font-bold border-2 transition-all text-start relative ${
                        selected ? `${badge.border} ${badge.bg} ${badge.text}` : 'border-gray-100 bg-white text-gray-500 hover:border-sky-100'
                      }`}
                    >
                      {service.label}
                      {selected && (
                        <span className={`absolute top-1 end-1 text-[9px] font-black px-1 py-0.5 rounded-full ${badge.bg} ${badge.text} border ${badge.border}`}>
                          {language === 'en' ? badge.labelEn : badge.label}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-3">{t('تفاصيل إضافية (اختياري)', 'Details (Optional)')}</label>
              <textarea
                className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 h-28 resize-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 outline-none transition-all"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder={t('مثال: أحتاج مساعدة للحركة', 'Example: I need mobility assistance')}
              />
            </div>
            <button
              disabled={isSubmitting}
              className={`w-full bg-sky-600 text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-sky-700 transition-all text-lg ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? t('جاري الإرسال...', 'Sending...') : t('إرسال النداء الآن 🔔', 'Send Call Now 🔔')}
            </button>
          </form>
        )}
      </div>

      {onBack && (
        <div className="mt-4 text-center">
          <button onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700 font-medium underline underline-offset-2">
            {t('← رجوع', '← Back')}
          </button>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
