import React, { useEffect, useState } from 'react';
import { DEPARTMENTS, HOSPITALS, PatientAdmission, RequestStatus, User } from '../types';
import { storageService } from '../services/storage';
import {
  Language,
  departmentLabel,
  departmentOptions,
  hospitalLabel,
  hospitalOptions,
  pick
} from '../services/i18n';

interface AdmissionDashboardProps {
  user: User;
  language?: Language;
}

const AdmissionDashboard: React.FC<AdmissionDashboardProps> = ({ user, language = 'ar' }) => {
  const t = (ar: string, en: string) => pick(language, ar, en);
  const translatedHospitals = hospitalOptions(language);
  const translatedDepartments = departmentOptions(language);
  const [formData, setFormData] = useState({
    fileNumber: '',
    patientName: '',
    roomNumber: '',
    bedNumber: '',
    hospitalName: user.assignedHospital || HOSPITALS[0],
    department: DEPARTMENTS[0]
  });
  const [success, setSuccess] = useState(false);
  const [admissions, setAdmissions] = useState<PatientAdmission[]>([]);

  const fetchAdmissions = () => {
    const all = storageService.getAdmissions();
    const scoped = user.assignedHospital
      ? all.filter(r => r.hospitalName === user.assignedHospital)
      : all;
    setAdmissions(scoped.slice(0, 10));
  };

  useEffect(() => {
    fetchAdmissions();
    window.addEventListener('storage', fetchAdmissions);
    return () => window.removeEventListener('storage', fetchAdmissions);
  }, [user.assignedHospital]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    storageService.admitPatient({
      ...formData,
      hospitalName: user.assignedHospital || formData.hospitalName,
      admittedAt: Date.now()
    });
    setSuccess(true);
    setFormData(prev => ({ ...prev, fileNumber: '', patientName: '', roomNumber: '', bedNumber: '' }));
    setTimeout(() => setSuccess(false), 3000);
    fetchAdmissions();
  };

  const hasActiveCall = (fileNumber: string): boolean => {
    return storageService.getRequests().some(
      r => r.fileNumber === fileNumber &&
        (r.status === RequestStatus.PENDING || r.status === RequestStatus.IN_PROGRESS)
    );
  };

  const handleDelete = (record: PatientAdmission) => {
    if (hasActiveCall(record.fileNumber)) {
      window.alert(t(
        `لا يمكن حذف المريض "${record.patientName}" — يوجد نداء نشط لم يكتمل بعد. أكمل النداء أولاً.`,
        `Cannot discharge "${record.patientName}" — there is an active call that hasn't been completed yet.`
      ));
      return;
    }
    if (!window.confirm(t(
      `هل تريد إنهاء تنويم "${record.patientName}" وحذف سجله؟`,
      `Discharge "${record.patientName}" and delete their record?`
    ))) return;
    try {
      storageService.deletePatientRecord(record.fileNumber, user.assignedHospital);
      fetchAdmissions();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : t('خطأ في الحذف', 'Delete failed'));
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-4 sm:py-8 px-3 sm:px-4 grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 animate-fade-up">
      {/* Registration Form */}
      <div className="lg:col-span-3 bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100 motion-card">
        <div className="animated-gradient bg-sky-700 p-5 sm:p-8 text-white">
          <h2 className="text-xl sm:text-2xl font-bold">{t('شاشة مكتب الدخول', 'Admission Desk')}</h2>
          <p className="opacity-80 mt-1 text-sm">
            {t('تسجيل المرضى المنومين وربطهم بالغرفة والقسم.', 'Register admitted patients and assign room and department.')}
          </p>
          {user.assignedHospital && (
            <span className="mt-3 inline-block bg-white/20 px-3 py-1 rounded-full text-xs font-bold">
              {hospitalLabel(user.assignedHospital, language)}
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-8 space-y-5 sm:space-y-6">
          {success && (
            <div className="bg-emerald-50 text-emerald-700 p-4 rounded-xl font-bold border border-emerald-200">
              ✅ {t('تم تسجيل المريض بنجاح.', 'Patient registered successfully.')}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('رقم ملف المريض', 'Patient File Number')}</label>
              <input
                type="text" required
                value={formData.fileNumber}
                onChange={e => setFormData({ ...formData, fileNumber: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none font-bold"
                placeholder={t('مثال: 450912', 'e.g. 450912')}
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('اسم المريض', 'Patient Name')}</label>
              <input
                type="text" required
                value={formData.patientName}
                onChange={e => setFormData({ ...formData, patientName: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder={t('الاسم الكامل', 'Full name')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('المستشفى', 'Hospital')}</label>
              <select
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none disabled:bg-slate-100"
                value={user.assignedHospital || formData.hospitalName}
                onChange={e => setFormData({ ...formData, hospitalName: e.target.value })}
                disabled={Boolean(user.assignedHospital)}
              >
                {translatedHospitals.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-1">
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('القسم', 'Department')}</label>
              <select
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none"
                value={formData.department}
                onChange={e => setFormData({ ...formData, department: e.target.value })}
              >
                {translatedDepartments.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('رقم الغرفة', 'Room')}</label>
              <input
                type="text" required
                value={formData.roomNumber}
                onChange={e => setFormData({ ...formData, roomNumber: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="304"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('رقم السرير', 'Bed')}</label>
              <input
                type="text" required
                value={formData.bedNumber}
                onChange={e => setFormData({ ...formData, bedNumber: e.target.value })}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-500 outline-none"
                placeholder="B-2"
              />
            </div>
          </div>

          <button type="submit" className="w-full bg-sky-700 text-white font-bold py-4 rounded-xl hover:bg-sky-800 transition-all shadow-lg text-lg">
            {t('تأكيد دخول المريض', 'Confirm Admission')}
          </button>
        </form>
      </div>

      {/* Recent Admissions */}
      <div className="lg:col-span-2">
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 motion-card h-full">
          <h3 className="font-black text-slate-800 text-lg mb-1">{t('آخر حالات التنويم', 'Recent Admissions')}</h3>
          <p className="text-xs text-slate-500 mb-4">{t('آخر 10 سجلات', 'Last 10 records')}</p>
          <div className="space-y-3 max-h-[400px] sm:max-h-[560px] overflow-auto">
            {admissions.length === 0 && (
              <div className="border border-dashed border-slate-200 rounded-2xl p-6 text-center text-slate-400 text-sm">
                {t('لا توجد سجلات حتى الآن.', 'No records yet.')}
              </div>
            )}
            {admissions.map(record => (
              <div key={`${record.fileNumber}-${record.admittedAt}`} className="rounded-2xl border border-slate-100 p-4 bg-slate-50/60">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{record.patientName}</p>
                    <p className="text-xs text-slate-500">{t('ملف', 'File')}: <span className="font-bold">{record.fileNumber}</span></p>
                    <p className="text-xs text-sky-700 font-bold mt-1">{departmentLabel(record.department, language)}</p>
                    <p className="text-xs text-slate-600">{t(`غرفة ${record.roomNumber} - سرير ${record.bedNumber}`, `Room ${record.roomNumber} - Bed ${record.bedNumber}`)}</p>
                  </div>
                  {(() => {
                    const active = hasActiveCall(record.fileNumber);
                    return (
                      <button
                        onClick={() => handleDelete(record)}
                        disabled={active}
                        className={`flex-shrink-0 p-2 rounded-xl text-xs font-bold transition-all ${
                          active
                            ? 'bg-amber-50 text-amber-500 cursor-not-allowed opacity-60'
                            : 'bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer'
                        }`}
                        title={active
                          ? t('يوجد نداء نشط — أكمله أولاً', 'Active call — complete it first')
                          : t('إنهاء التنويم', 'Discharge patient')
                        }
                      >
                        {active ? '⏳' : '✕'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdmissionDashboard;
