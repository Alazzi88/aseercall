import {
  CallPriority,
  DEPARTMENTS,
  HOSPITALS,
  RequestStatus,
  SERVICE_TYPES,
  UserRole
} from '../types';

export type Language = 'ar' | 'en';

const LANGUAGE_KEY = 'aseer_ui_language';

const isLanguage = (value: string | null): value is Language => {
  return value === 'ar' || value === 'en';
};

export const pick = (language: Language, arText: string, enText: string): string => {
  return language === 'en' ? enText : arText;
};

export const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'ar';

  const saved = localStorage.getItem(LANGUAGE_KEY);
  if (isLanguage(saved)) return saved;

  return navigator.language.toLowerCase().startsWith('ar') ? 'ar' : 'en';
};

export const persistLanguage = (language: Language): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LANGUAGE_KEY, language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'en' ? 'ltr' : 'rtl';
};

export const roleLabel = (role: UserRole, language: Language): string => {
  if (role === UserRole.OWNER) {
    return pick(language, 'مالك النظام', 'System Owner');
  }
  if (role === UserRole.ADMIN) {
    return pick(language, 'مدير النظام', 'System Admin');
  }
  if (role === UserRole.NURSE) {
    return pick(language, 'موظف تمريض', 'Nursing Staff');
  }
  if (role === UserRole.ADMISSION) {
    return pick(language, 'موظف دخول', 'Admission Staff');
  }
  return pick(language, 'مراجع', 'Reviewer');
};

type BilingualDictionary = Record<string, { ar: string; en: string }>;

const HOSPITAL_LABELS: BilingualDictionary = {
  'مستشفى أبها للولادة والأطفال': {
    ar: 'مستشفى أبها للولادة والأطفال',
    en: 'Abha Women and Children Hospital'
  },
  'مستشفى عسير المركزي': {
    ar: 'مستشفى عسير المركزي',
    en: 'Aseer Central Hospital'
  },
  'مستشفى خميس مشيط العام': {
    ar: 'مستشفى خميس مشيط العام',
    en: 'Khamis Mushait General Hospital'
  },
  'مستشفى محايل العام': {
    ar: 'مستشفى محايل العام',
    en: 'Muhayil General Hospital'
  },
  'مستشفى الصحة النفسية بأبها': {
    ar: 'مستشفى الصحة النفسية بأبها',
    en: 'Abha Mental Health Hospital'
  },
  'مستشفى أحد رفيدة العام': {
    ar: 'مستشفى أحد رفيدة العام',
    en: 'Ahad Rafidah General Hospital'
  },
  'مستشفى سراة عبيدة العام': {
    ar: 'مستشفى سراة عبيدة العام',
    en: 'Sarat Ubaidah General Hospital'
  },
  'مستشفى رجال ألمع العام': {
    ar: 'مستشفى رجال ألمع العام',
    en: 'Rijal Almaa General Hospital'
  },
  'مستشفى النماص العام': {
    ar: 'مستشفى النماص العام',
    en: 'Al Namas General Hospital'
  },
  'مستشفى بللسمر العام': {
    ar: 'مستشفى بللسمر العام',
    en: 'Balasmar General Hospital'
  }
};

const DEPARTMENT_LABELS: BilingualDictionary = {
  الطوارئ: { ar: 'الطوارئ', en: 'Emergency' },
  'العناية المركزة': { ar: 'العناية المركزة', en: 'Intensive Care Unit' },
  'قسم التنويم': { ar: 'قسم التنويم', en: 'Inpatient Department' },
  'العيادات الخارجية': { ar: 'العيادات الخارجية', en: 'Outpatient Clinics' },
  الجراحة: { ar: 'الجراحة', en: 'Surgery' },
  الباطنة: { ar: 'الباطنة', en: 'Internal Medicine' },
  الأطفال: { ar: 'الأطفال', en: 'Pediatrics' },
  'النساء والولادة': { ar: 'النساء والولادة', en: 'Obstetrics and Gynecology' },
  القلب: { ar: 'القلب', en: 'Cardiology' },
  الكلى: { ar: 'الكلى', en: 'Nephrology' },
  'العلاج الطبيعي': { ar: 'العلاج الطبيعي', en: 'Physical Therapy' },
  المختبر: { ar: 'المختبر', en: 'Laboratory' }
};

const SERVICE_LABELS: BilingualDictionary = {
  'طلب ممرض (نداء استغاثة)': {
    ar: 'طلب ممرض (نداء استغاثة)',
    en: 'Nurse Call (Emergency)'
  },
  'طلب دواء': { ar: 'طلب دواء', en: 'Medication Request' },
  'استشارة طبية': { ar: 'استشارة طبية', en: 'Medical Consultation' },
  'طلب مساعدة حركية': { ar: 'طلب مساعدة حركية', en: 'Mobility Assistance' },
  'طلب نقل المريض': { ar: 'طلب نقل المريض', en: 'Patient Transfer Request' },
  'طلب فحص مخبري': { ar: 'طلب فحص مخبري', en: 'Laboratory Test Request' },
  'متابعة العلامات الحيوية': { ar: 'متابعة العلامات الحيوية', en: 'Vitals Monitoring' },
  'طلب تنويم طارئ': { ar: 'طلب تنويم طارئ', en: 'Emergency Admission Request' },
  أخرى: { ar: 'أخرى', en: 'Other' }
};

const fallbackLabel = (value: string): { ar: string; en: string } => ({
  ar: value,
  en: value
});

const labelFromDictionary = (
  dictionary: BilingualDictionary,
  value: string
): { ar: string; en: string } => {
  return dictionary[value] || fallbackLabel(value);
};

export const hospitalLabel = (hospitalName: string, language: Language): string => {
  const value = labelFromDictionary(HOSPITAL_LABELS, hospitalName);
  return pick(language, value.ar, value.en);
};

export const departmentLabel = (department: string, language: Language): string => {
  const value = labelFromDictionary(DEPARTMENT_LABELS, department);
  return pick(language, value.ar, value.en);
};

export const serviceTypeLabel = (serviceType: string, language: Language): string => {
  const value = labelFromDictionary(SERVICE_LABELS, serviceType);
  return pick(language, value.ar, value.en);
};

export const requestStatusLabel = (status: RequestStatus, language: Language): string => {
  if (status === RequestStatus.PENDING) return pick(language, 'قيد الانتظار', 'Pending');
  if (status === RequestStatus.IN_PROGRESS) return pick(language, 'جاري التنفيذ', 'In Progress');
  if (status === RequestStatus.COMPLETED) return pick(language, 'مكتمل', 'Completed');
  return pick(language, 'ملغي', 'Cancelled');
};

export const formatDateTime = (value: number, language: Language): string => {
  return new Date(value).toLocaleString(language === 'en' ? 'en-US' : 'ar-SA');
};

export const hospitalOptions = (language: Language): Array<{ value: string; label: string }> => {
  return HOSPITALS.map(hospital => ({
    value: hospital,
    label: hospitalLabel(hospital, language)
  }));
};

export const departmentOptions = (language: Language): Array<{ value: string; label: string }> => {
  return DEPARTMENTS.map(department => ({
    value: department,
    label: departmentLabel(department, language)
  }));
};

export const serviceTypeOptions = (language: Language): Array<{ value: string; label: string }> => {
  return SERVICE_TYPES.map(serviceType => ({
    value: serviceType,
    label: serviceTypeLabel(serviceType, language)
  }));
};

export const priorityLabel = (priority: CallPriority, language: Language): string => {
  switch (priority) {
    case CallPriority.EMERGENCY:
      return pick(language, 'طارئ', 'Emergency');
    case CallPriority.NURSE_CALL:
      return pick(language, 'نداء ممرض', 'Nurse Call');
    case CallPriority.MEDICATION:
      return pick(language, 'دواء', 'Medication');
    case CallPriority.OTHER:
      return pick(language, 'أخرى', 'Other');
  }
};
