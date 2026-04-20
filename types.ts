
export enum CallPriority {
  EMERGENCY = 'EMERGENCY',
  NURSE_CALL = 'NURSE_CALL',
  MEDICATION = 'MEDICATION',
  OTHER = 'OTHER'
}

export const derivePriority = (serviceType: string): CallPriority => {
  if (serviceType === 'طلب ممرض (نداء استغاثة)' || serviceType === 'طلب تنويم طارئ') {
    return CallPriority.EMERGENCY;
  }
  if (serviceType === 'طلب دواء') {
    return CallPriority.MEDICATION;
  }
  if (
    serviceType === 'طلب مساعدة حركية' ||
    serviceType === 'متابعة العلامات الحيوية' ||
    serviceType === 'استشارة طبية' ||
    serviceType === 'طلب نقل المريض' ||
    serviceType === 'طلب فحص مخبري'
  ) {
    return CallPriority.NURSE_CALL;
  }
  return CallPriority.OTHER;
};

export const HOSPITAL_SLUGS: Record<string, string> = {
  'مستشفى أبها للولادة والأطفال': 'abha-women-children',
  'مستشفى عسير المركزي': 'aseer-central',
  'مستشفى خميس مشيط العام': 'khamis-mushait',
  'مستشفى محايل العام': 'muhayil',
  'مستشفى الصحة النفسية بأبها': 'abha-mental-health',
  'مستشفى أحد رفيدة العام': 'ahad-rafidah',
  'مستشفى سراة عبيدة العام': 'sarat-ubaidah',
  'مستشفى رجال ألمع العام': 'rijal-almaa',
  'مستشفى النماص العام': 'al-namas',
  'مستشفى بللسمر العام': 'balasmar'
};

export const DEPARTMENT_SLUGS: Record<string, string> = {
  'الطوارئ': 'emergency',
  'العناية المركزة': 'icu',
  'قسم التنويم': 'inpatient',
  'العيادات الخارجية': 'outpatient',
  'الجراحة': 'surgery',
  'الباطنة': 'internal-medicine',
  'الأطفال': 'pediatrics',
  'النساء والولادة': 'obstetrics',
  'القلب': 'cardiology',
  'الكلى': 'nephrology',
  'العلاج الطبيعي': 'physical-therapy',
  'المختبر': 'laboratory'
};

export const SLUG_TO_HOSPITAL: Record<string, string> = Object.fromEntries(
  Object.entries(HOSPITAL_SLUGS).map(([k, v]) => [v, k])
);

export const SLUG_TO_DEPARTMENT: Record<string, string> = Object.fromEntries(
  Object.entries(DEPARTMENT_SLUGS).map(([k, v]) => [v, k])
);

export enum UserRole {
  PATIENT = 'PATIENT',
  ADMIN = 'ADMIN',
  ADMISSION = 'ADMISSION', // مكتب الدخول
  NURSE = 'NURSE', // التمريض / مستقبل البلاغ
  OWNER = 'OWNER' // مالك النظام (الصلاحية الكاملة)
}

export enum RequestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface PatientAdmission {
  fileNumber: string;
  patientName: string;
  roomNumber: string;
  bedNumber: string;
  hospitalName: string;
  department: string;
  admittedAt: number;
}

export interface HealthRequest {
  id: string;
  fileNumber: string; // Linked to patient admission
  patientName: string;
  roomNumber: string;
  bedNumber: string;
  hospitalName: string;
  department: string;
  serviceType: string;
  description: string;
  status: RequestStatus;
  createdAt: number;
  updatedAt?: number;
  respondedAt?: number;
  cancellationReason?: string;
  priority?: CallPriority;
  escalatedAt?: number;
  acceptedBy?: string;
  acceptedAt?: number;
}

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  password?: string;
  assignedDepartment?: string;
  assignedHospital?: string;
}

export const HOSPITALS = [
  'مستشفى أبها للولادة والأطفال',
  'مستشفى عسير المركزي',
  'مستشفى خميس مشيط العام',
  'مستشفى محايل العام',
  'مستشفى الصحة النفسية بأبها',
  'مستشفى أحد رفيدة العام',
  'مستشفى سراة عبيدة العام',
  'مستشفى رجال ألمع العام',
  'مستشفى النماص العام',
  'مستشفى بللسمر العام'
];

export const DEPARTMENTS = [
  'الطوارئ',
  'العناية المركزة',
  'قسم التنويم',
  'العيادات الخارجية',
  'الجراحة',
  'الباطنة',
  'الأطفال',
  'النساء والولادة',
  'القلب',
  'الكلى',
  'العلاج الطبيعي',
  'المختبر'
];

export const SERVICE_TYPES = [
  'طلب ممرض (نداء استغاثة)',
  'طلب دواء',
  'استشارة طبية',
  'طلب مساعدة حركية',
  'طلب نقل المريض',
  'طلب فحص مخبري',
  'متابعة العلامات الحيوية',
  'طلب تنويم طارئ',
  'أخرى'
];
