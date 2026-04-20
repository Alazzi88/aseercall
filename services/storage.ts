import {
  HealthRequest,
  RequestStatus,
  PatientAdmission,
  User,
  UserRole,
  HOSPITALS,
  DEPARTMENTS,
  SERVICE_TYPES,
  CallPriority,
  derivePriority
} from '../types';
import { syncService } from './sync';

const REQUESTS_KEY = 'aseer_health_requests';
const ADMISSIONS_KEY = 'aseer_health_admissions';
const USERS_KEY = 'aseer_health_users';
const LAST_ADMIN_VIEW_KEY = 'aseer_last_admin_view';
const ADMIN_SYSTEM_USER_ID = 'admin-1';
const DEFAULT_PASSWORD = '1234';
const LOCKED_SYSTEM_USER_IDS = new Set([ADMIN_SYSTEM_USER_ID]);
const LEGACY_SYSTEM_USER_IDS = new Set(['owner-1', 'admit-1', 'nurse-1', 'receiver-1']);
const LEGACY_SYSTEM_USERNAMES = new Set(['8111', 'admit', 'nurse', 'yalazzi88@gmail.com', 'os@gmail.com', 'admin@gmail.com']);

const DEFAULT_USERS: User[] = [
  // ===== مدير النظام (محمي) =====
  {
    id: ADMIN_SYSTEM_USER_ID,
    name: 'مدير النظام',
    username: 'admin',
    role: UserRole.ADMIN,
    password: DEFAULT_PASSWORD
  },

  // ===== مستشفى عسير المركزي =====
  { id: 'nurse-aseer-1', name: 'تمريض عسير المركزي', username: 'nurse.aseer', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى عسير المركزي' },
  { id: 'admit-aseer-1', name: 'دخول عسير المركزي', username: 'admit.aseer', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى عسير المركزي' },

  // ===== مستشفى أبها للولادة والأطفال =====
  { id: 'nurse-abha-1', name: 'تمريض أبها للولادة', username: 'nurse.abha', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى أبها للولادة والأطفال' },
  { id: 'admit-abha-1', name: 'دخول أبها للولادة', username: 'admit.abha', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى أبها للولادة والأطفال' },

  // ===== مستشفى خميس مشيط العام =====
  { id: 'nurse-khamis-1', name: 'تمريض خميس مشيط', username: 'nurse.khamis', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى خميس مشيط العام' },
  { id: 'admit-khamis-1', name: 'دخول خميس مشيط', username: 'admit.khamis', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى خميس مشيط العام' },

  // ===== مستشفى محايل العام =====
  { id: 'nurse-muhayil-1', name: 'تمريض محايل', username: 'nurse.muhayil', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى محايل العام' },
  { id: 'admit-muhayil-1', name: 'دخول محايل', username: 'admit.muhayil', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى محايل العام' },

  // ===== مستشفى الصحة النفسية بأبها =====
  { id: 'nurse-mental-1', name: 'تمريض الصحة النفسية', username: 'nurse.mental', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى الصحة النفسية بأبها' },
  { id: 'admit-mental-1', name: 'دخول الصحة النفسية', username: 'admit.mental', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى الصحة النفسية بأبها' },

  // ===== مستشفى أحد رفيدة العام =====
  { id: 'nurse-ahad-1', name: 'تمريض أحد رفيدة', username: 'nurse.ahad', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى أحد رفيدة العام' },
  { id: 'admit-ahad-1', name: 'دخول أحد رفيدة', username: 'admit.ahad', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى أحد رفيدة العام' },

  // ===== مستشفى سراة عبيدة العام =====
  { id: 'nurse-sarat-1', name: 'تمريض سراة عبيدة', username: 'nurse.sarat', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى سراة عبيدة العام' },
  { id: 'admit-sarat-1', name: 'دخول سراة عبيدة', username: 'admit.sarat', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى سراة عبيدة العام' },

  // ===== مستشفى رجال ألمع العام =====
  { id: 'nurse-rijal-1', name: 'تمريض رجال ألمع', username: 'nurse.rijal', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى رجال ألمع العام' },
  { id: 'admit-rijal-1', name: 'دخول رجال ألمع', username: 'admit.rijal', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى رجال ألمع العام' },

  // ===== مستشفى النماص العام =====
  { id: 'nurse-namas-1', name: 'تمريض النماص', username: 'nurse.namas', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى النماص العام' },
  { id: 'admit-namas-1', name: 'دخول النماص', username: 'admit.namas', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى النماص العام' },

  // ===== مستشفى بللسمر العام =====
  { id: 'nurse-balasmar-1', name: 'تمريض بللسمر', username: 'nurse.balasmar', role: UserRole.NURSE, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى بللسمر العام' },
  { id: 'admit-balasmar-1', name: 'دخول بللسمر', username: 'admit.balasmar', role: UserRole.ADMISSION, password: DEFAULT_PASSWORD, assignedHospital: 'مستشفى بللسمر العام' }
];

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

const normalizeStatus = (status: unknown): RequestStatus => {
  if (status === RequestStatus.PENDING || status === RequestStatus.IN_PROGRESS || status === RequestStatus.COMPLETED || status === RequestStatus.CANCELLED) {
    return status;
  }
  return RequestStatus.PENDING;
};

const normalizeFromList = (value: unknown, list: string[], fallback: string): string => {
  const normalized = String(value ?? '').trim();
  if (list.includes(normalized)) return normalized;
  return fallback;
};

const normalizeAdmission = (admission: any): PatientAdmission => ({
  fileNumber: String(admission?.fileNumber ?? ''),
  patientName: String(admission?.patientName ?? ''),
  roomNumber: String(admission?.roomNumber ?? admission?.room ?? ''),
  bedNumber: String(admission?.bedNumber ?? 'غير محدد'),
  hospitalName: normalizeFromList(admission?.hospitalName, HOSPITALS, HOSPITALS[0]),
  department: normalizeFromList(
    admission?.department,
    DEPARTMENTS,
    DEPARTMENTS[2] ?? DEPARTMENTS[0]
  ),
  admittedAt: Number(admission?.admittedAt ?? Date.now())
});

const normalizeRequest = (request: any): HealthRequest => {
  const serviceType = normalizeFromList(request?.serviceType, SERVICE_TYPES, SERVICE_TYPES[0]);
  const storedPriority = request?.priority;
  const priority: CallPriority = Object.values(CallPriority).includes(storedPriority as CallPriority)
    ? (storedPriority as CallPriority)
    : derivePriority(serviceType);

  return {
    id: String(request?.id ?? createId()),
    fileNumber: String(request?.fileNumber ?? ''),
    patientName: String(request?.patientName ?? ''),
    roomNumber: String(request?.roomNumber ?? ''),
    bedNumber: String(request?.bedNumber ?? 'غير محدد'),
    hospitalName: normalizeFromList(request?.hospitalName, HOSPITALS, HOSPITALS[0]),
    department: normalizeFromList(request?.department, DEPARTMENTS, DEPARTMENTS[0]),
    serviceType,
    description: String(request?.description ?? ''),
    status: normalizeStatus(request?.status),
    createdAt: Number(request?.createdAt ?? Date.now()),
    updatedAt: Number(request?.updatedAt ?? request?.createdAt ?? Date.now()),
    respondedAt: request?.respondedAt ? Number(request.respondedAt) : undefined,
    cancellationReason: request?.cancellationReason ? String(request.cancellationReason) : undefined,
    priority,
    escalatedAt: request?.escalatedAt ? Number(request.escalatedAt) : undefined,
    acceptedBy: request?.acceptedBy ? String(request.acceptedBy) : undefined,
    acceptedAt: request?.acceptedAt ? Number(request.acceptedAt) : undefined
  };
};

const normalizeUser = (user: any): User => {
  const role = Object.values(UserRole).includes(user?.role as UserRole) ? (user.role as UserRole) : UserRole.NURSE;
  const normalized: User = {
    id: String(user?.id ?? createId()),
    name: String(user?.name ?? ''),
    username: String(user?.username ?? ''),
    role,
    password: typeof user?.password === 'string' ? user.password : ''
  };

  if (role === UserRole.NURSE || role === UserRole.ADMISSION) {
    normalized.assignedHospital = normalizeFromList(user?.assignedHospital, HOSPITALS, HOSPITALS[0]);
  } else {
    if (user?.assignedDepartment) {
      normalized.assignedDepartment = String(user.assignedDepartment);
    }
    if (user?.assignedHospital) {
      normalized.assignedHospital = normalizeFromList(user.assignedHospital, HOSPITALS, HOSPITALS[0]);
    }
  }
  return normalized;
};

const emitStorageSync = (type?: import('./sync').SyncEventType, payload?: import('./sync').SyncPayload) => {
  syncService.emit(type ?? 'REQUEST_UPDATED', payload);
};

const isSameUser = (a: User, b: User): boolean => {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.username === b.username &&
    a.role === b.role &&
    (a.password || '') === (b.password || '') &&
    (a.assignedHospital || '') === (b.assignedHospital || '') &&
    (a.assignedDepartment || '') === (b.assignedDepartment || '')
  );
};

const syncSystemUsers = (users: User[]): { users: User[]; changed: boolean } => {
  const systemIds = new Set(DEFAULT_USERS.map(user => user.id));
  const systemUsernames = new Set(DEFAULT_USERS.map(user => user.username));

  const customUsers = users.filter(user => {
    if (user.role === UserRole.OWNER) return false;
    if (LEGACY_SYSTEM_USER_IDS.has(user.id)) return false;
    if (LEGACY_SYSTEM_USERNAMES.has(user.username)) return false;
    if (systemIds.has(user.id)) return false;
    if (systemUsernames.has(user.username)) return false;
    return true;
  });

  const nextUsers = [...DEFAULT_USERS, ...customUsers];
  const changed =
    nextUsers.length !== users.length ||
    nextUsers.some((user, index) => !users[index] || !isSameUser(user, users[index]));

  return { users: nextUsers, changed };
};

export const storageService = {
  getRequests: (): HealthRequest[] => {
    const rows = safeParse<any[]>(localStorage.getItem(REQUESTS_KEY), []);
    return rows.map(normalizeRequest);
  },

  saveRequest: (request: Omit<HealthRequest, 'id' | 'createdAt' | 'status'>): HealthRequest => {
    const requests = storageService.getRequests();
    const now = Date.now();
    const priority = request.priority ?? derivePriority(request.serviceType);
    const newRequest: HealthRequest = {
      ...request,
      id: createId(),
      createdAt: now,
      updatedAt: now,
      status: RequestStatus.IN_PROGRESS,
      respondedAt: now,
      priority
    };
    requests.unshift(newRequest);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    emitStorageSync('REQUEST_CREATED', { id: newRequest.id, priority });
    return newRequest;
  },

  updateRequestStatus: (id: string, status: RequestStatus, reason?: string): HealthRequest[] => {
    const requests = storageService.getRequests();
    const now = Date.now();
    const updated = requests.map(req => {
      if (req.id !== id) return req;
      const respondedAt = req.status === RequestStatus.PENDING && status === RequestStatus.IN_PROGRESS ? now : req.respondedAt;
      return { ...req, status, cancellationReason: reason, updatedAt: now, respondedAt };
    });
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
    emitStorageSync('REQUEST_UPDATED', { id });
    return updated;
  },

  markEscalated: (id: string): void => {
    const requests = storageService.getRequests();
    const updated = requests.map(req =>
      req.id === id ? { ...req, escalatedAt: Date.now(), updatedAt: Date.now() } : req
    );
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(updated));
    emitStorageSync('REQUEST_UPDATED', { id });
  },

  getActiveRequestsByDepartment: (hospitalName: string, department?: string): HealthRequest[] => {
    return storageService.getRequests().filter(req => {
      if (req.status === RequestStatus.COMPLETED || req.status === RequestStatus.CANCELLED) return false;
      if (req.hospitalName !== hospitalName) return false;
      if (department && req.department !== department) return false;
      return true;
    });
  },

  admitPatient: (admission: PatientAdmission) => {
    const admissions = storageService.getAdmissions();
    const nextRecord = normalizeAdmission(admission);
    const filtered = admissions.filter(a => a.fileNumber !== nextRecord.fileNumber);
    filtered.unshift(nextRecord);
    localStorage.setItem(ADMISSIONS_KEY, JSON.stringify(filtered));
    emitStorageSync('ADMISSION_CREATED');
  },

  getAdmissions: (): PatientAdmission[] => {
    const rows = safeParse<any[]>(localStorage.getItem(ADMISSIONS_KEY), []);
    return rows.map(normalizeAdmission);
  },

  getAdmissionByFile: (fileNumber: string): PatientAdmission | undefined => {
    return storageService.getAdmissions().find(a => a.fileNumber === fileNumber);
  },

  deletePatientRecord: (fileNumber: string, hospitalName?: string) => {
    const admissions = storageService.getAdmissions();
    const target = admissions.find(admission => admission.fileNumber === fileNumber);
    if (!target) {
      throw new Error('لم يتم العثور على ملف المراجع.');
    }
    if (hospitalName && target.hospitalName !== hospitalName) {
      throw new Error('غير مسموح بحذف مراجع من مستشفى أخرى.');
    }

    const nextAdmissions = admissions.filter(admission => admission.fileNumber !== fileNumber);
    const nextRequests = storageService.getRequests().filter(request => request.fileNumber !== fileNumber);

    localStorage.setItem(ADMISSIONS_KEY, JSON.stringify(nextAdmissions));
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(nextRequests));
    emitStorageSync('ADMISSION_DELETED');
  },

  getUsers: (): User[] => {
    const rows = safeParse<any[]>(localStorage.getItem(USERS_KEY), []);
    if (!rows.length) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }

    let normalized = rows.map(normalizeUser);
    const synced = syncSystemUsers(normalized);
    normalized = synced.users;

    if (synced.changed) {
      localStorage.setItem(USERS_KEY, JSON.stringify(normalized));
    }

    return normalized;
  },

  saveUser: (user: User) => {
    const normalized = normalizeUser(user);
    if (LOCKED_SYSTEM_USER_IDS.has(normalized.id)) {
      throw new Error('هذا الحساب الأساسي ثابت ولا يمكن تعديله.');
    }
    if (normalized.role === UserRole.OWNER) {
      throw new Error('دور مالك النظام غير متاح في هذا الإصدار.');
    }
    if ((normalized.role === UserRole.NURSE || normalized.role === UserRole.ADMISSION) && !normalized.assignedHospital) {
      throw new Error('يجب تحديد المستشفى للموظف.');
    }
    if (normalized.role === UserRole.NURSE || normalized.role === UserRole.ADMISSION) {
      delete normalized.assignedDepartment;
    }

    const users = storageService.getUsers();
    const usernameTaken = users.some(existing => existing.username === normalized.username && existing.id !== normalized.id);
    if (usernameTaken) {
      throw new Error('اسم المستخدم مستخدم مسبقاً. اختر اسم دخول آخر.');
    }

    const existingIdx = users.findIndex(u => u.id === normalized.id);
    if (existingIdx > -1) {
      users[existingIdx] = normalized;
    } else {
      users.push(normalized);
    }
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
    emitStorageSync('USER_CHANGED');
  },

  deleteUser: (id: string) => {
    if (LOCKED_SYSTEM_USER_IDS.has(id)) {
      throw new Error('لا يمكن حذف الحسابات الأساسية للنظام.');
    }
    const users = storageService.getUsers();
    const target = users.find(u => u.id === id);
    if (target?.role === UserRole.OWNER) {
      throw new Error('لا يمكن حذف مالك النظام.');
    }
    const nextUsers = users.filter(u => u.id !== id);
    localStorage.setItem(USERS_KEY, JSON.stringify(nextUsers));
    emitStorageSync('USER_CHANGED');
  },

  setAdminLastView: () => localStorage.setItem(LAST_ADMIN_VIEW_KEY, Date.now().toString()),
  getAdminLastView: (): number => parseInt(localStorage.getItem(LAST_ADMIN_VIEW_KEY) || '0', 10)
};
