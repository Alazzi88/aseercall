import React, { useEffect, useMemo, useState } from 'react';
import { CallPriority, DEPARTMENTS, HOSPITALS, HealthRequest, RequestStatus, User, UserRole } from '../types';
import { storageService } from '../services/storage';
import {
  Language,
  departmentLabel,
  departmentOptions,
  formatDateTime,
  hospitalLabel,
  pick,
  priorityLabel,
  requestStatusLabel,
  roleLabel as translatedRoleLabel,
  serviceTypeLabel
} from '../services/i18n';

interface AdminDashboardProps {
  currentUser: User;
  liveLocation?: null;
  locationError?: string;
  language?: Language;
}

type AdminTab = 'OVERVIEW' | 'ANALYTICS' | 'USERS' | 'REQUESTS';

const createId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
};

const average = (values: number[]): number => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const formatDuration = (ms: number, language: Language): string => {
  if (!ms || !Number.isFinite(ms) || ms <= 0) return '—';
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return language === 'en' ? '< 1 min' : '< 1 دقيقة';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return language === 'en' ? `${minutes} min` : `${minutes} دقيقة`;
  if (!minutes) return language === 'en' ? `${hours} h` : `${hours} ساعة`;
  return language === 'en' ? `${hours} h ${minutes} min` : `${hours} س ${minutes} د`;
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  language = 'ar'
}) => {
  const t = (arText: string, enText: string) => pick(language, arText, enText);
  const [requests, setRequests] = useState<HealthRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('OVERVIEW');
  const [selectedHospital, setSelectedHospital] = useState('ALL');
  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userError, setUserError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: UserRole.NURSE,
    assignedHospital: HOSPITALS[0]
  });

  const fetchData = () => {
    setRequests(storageService.getRequests());
    setUsers(storageService.getUsers());
  };

  useEffect(() => {
    fetchData();
    storageService.setAdminLastView();
    window.addEventListener('storage', fetchData);
    return () => window.removeEventListener('storage', fetchData);
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      if (selectedHospital !== 'ALL' && req.hospitalName !== selectedHospital) return false;
      if (selectedDepartment !== 'ALL' && req.department !== selectedDepartment) return false;
      return true;
    });
  }, [requests, selectedHospital, selectedDepartment]);

  const exportCSV = () => {
    const BOM = '\uFEFF';
    const headers = [
      t('المريض', 'Patient'), t('رقم الملف', 'File No.'), t('المستشفى', 'Hospital'),
      t('القسم', 'Department'), t('نوع الخدمة', 'Service Type'), t('الأولوية', 'Priority'),
      t('الحالة', 'Status'), t('الغرفة', 'Room'), t('السرير', 'Bed'),
      t('تاريخ الإنشاء', 'Created At'),
      t('وقت أول استجابة (دقيقة)', 'First Response (min)'),
      t('وقت الإغلاق (دقيقة)', 'Closure Time (min)')
    ];
    const rows = filteredRequests.map(req => [
      req.patientName, req.fileNumber,
      hospitalLabel(req.hospitalName, language), departmentLabel(req.department, language),
      serviceTypeLabel(req.serviceType, language),
      req.priority ? priorityLabel(req.priority, language) : '',
      requestStatusLabel(req.status, language),
      req.roomNumber, req.bedNumber,
      formatDateTime(req.createdAt, language),
      req.respondedAt ? Math.round((req.respondedAt - req.createdAt) / 60000) : '',
      req.status === RequestStatus.COMPLETED && req.updatedAt ? Math.round((req.updatedAt - req.createdAt) / 60000) : ''
    ]);
    const csv = BOM + [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aseer-calls-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const stats = useMemo(
    () => ({
      total: filteredRequests.length,
      pending: filteredRequests.filter(request => request.status === RequestStatus.PENDING).length,
      active: filteredRequests.filter(request => request.status === RequestStatus.IN_PROGRESS).length,
      completed: filteredRequests.filter(request => request.status === RequestStatus.COMPLETED).length
    }),
    [filteredRequests]
  );

  const dashboardInsights = useMemo(() => {
    const now = Date.now();
    const responseTimes: number[] = [];
    const completionTimes: number[] = [];
    let fastResponses = 0;
    let mediumResponses = 0;
    let lateResponses = 0;
    let delayedPending = 0;

    const serviceMap = new Map<string, number>();
    const departmentMap = new Map<
      string,
      { total: number; pending: number; active: number; completed: number; responseTimes: number[] }
    >();

    const hourlyLoad = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));

    filteredRequests.forEach(request => {
      const hour = new Date(request.createdAt).getHours();
      hourlyLoad[hour].count += 1;

      serviceMap.set(request.serviceType, (serviceMap.get(request.serviceType) || 0) + 1);

      const dept = departmentMap.get(request.department) || {
        total: 0,
        pending: 0,
        active: 0,
        completed: 0,
        responseTimes: []
      };
      dept.total += 1;
      if (request.status === RequestStatus.PENDING) dept.pending += 1;
      if (request.status === RequestStatus.IN_PROGRESS) dept.active += 1;
      if (request.status === RequestStatus.COMPLETED) dept.completed += 1;

      if (
        typeof request.respondedAt === 'number' &&
        request.respondedAt >= request.createdAt
      ) {
        const responseMs = request.respondedAt - request.createdAt;
        responseTimes.push(responseMs);
        dept.responseTimes.push(responseMs);
        if (responseMs <= 5 * 60 * 1000) fastResponses += 1;
        else if (responseMs <= 15 * 60 * 1000) mediumResponses += 1;
        else lateResponses += 1;
      }

      if (
        request.status === RequestStatus.PENDING &&
        now - request.createdAt > 10 * 60 * 1000
      ) {
        delayedPending += 1;
      }

      if (
        request.status === RequestStatus.COMPLETED &&
        typeof request.updatedAt === 'number' &&
        request.updatedAt >= request.createdAt
      ) {
        completionTimes.push(request.updatedAt - request.createdAt);
      }

      departmentMap.set(request.department, dept);
    });

    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const todayCount = filteredRequests.filter(request => request.createdAt >= startToday.getTime()).length;

    const sevenDayLoad = Array.from({ length: 7 }, (_, idx) => {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - (6 - idx));
      return {
        key: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString(language === 'en' ? 'en-US' : 'ar-SA', { weekday: 'short' }),
        count: 0
      };
    });

    filteredRequests.forEach(request => {
      const day = new Date(request.createdAt);
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);
      const point = sevenDayLoad.find(item => item.key === key);
      if (point) point.count += 1;
    });

    const statusBreakdown = [
      { key: 'pending', label: pick(language, 'قيد الانتظار', 'Pending'), value: stats.pending, color: '#f59e0b' },
      { key: 'active', label: pick(language, 'قيد التنفيذ', 'In Progress'), value: stats.active, color: '#0284c7' },
      { key: 'completed', label: pick(language, 'مكتمل', 'Completed'), value: stats.completed, color: '#14b8a6' }
    ];
    const statusTotal = statusBreakdown.reduce((sum, item) => sum + item.value, 0) || 1;

    let progress = 0;
    const statusDonutGradient = `conic-gradient(${statusBreakdown
      .map(segment => {
        const start = progress;
        const size = (segment.value / statusTotal) * 100;
        progress += size;
        return `${segment.color} ${start}% ${progress}%`;
      })
      .join(', ')})`;

    const departmentRows = Array.from(departmentMap.entries())
      .map(([department, row]) => ({
        department,
        ...row,
        avgResponseMs: average(row.responseTimes)
      }))
      .sort((a, b) => b.total - a.total);

    const serviceRows = Array.from(serviceMap.entries())
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count);

    const busiestHour = hourlyLoad.reduce(
      (best, slot) => (slot.count > best.count ? slot : best),
      hourlyLoad[0]
    );

    // Priority breakdown
    const priorityMap = new Map<CallPriority, { count: number; responseTimes: number[]; completionTimes: number[] }>();
    Object.values(CallPriority).forEach(p => priorityMap.set(p, { count: 0, responseTimes: [], completionTimes: [] }));
    filteredRequests.forEach(req => {
      const p = req.priority ?? CallPriority.OTHER;
      const entry = priorityMap.get(p)!;
      entry.count += 1;
      if (typeof req.respondedAt === 'number' && req.respondedAt >= req.createdAt) {
        entry.responseTimes.push(req.respondedAt - req.createdAt);
      }
      if (req.status === RequestStatus.COMPLETED && typeof req.updatedAt === 'number') {
        entry.completionTimes.push(req.updatedAt - req.createdAt);
      }
    });

    const priorityRows = [
      { priority: CallPriority.EMERGENCY, label: pick(language, 'طارئ', 'Emergency'), color: '#ef4444', bg: 'bg-red-500', light: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' },
      { priority: CallPriority.NURSE_CALL, label: pick(language, 'نداء ممرض', 'Nurse Call'), color: '#f97316', bg: 'bg-orange-500', light: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
      { priority: CallPriority.MEDICATION, label: pick(language, 'دواء', 'Medication'), color: '#eab308', bg: 'bg-yellow-500', light: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700' },
      { priority: CallPriority.OTHER, label: pick(language, 'أخرى', 'Other'), color: '#64748b', bg: 'bg-slate-500', light: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-600' }
    ].map(row => {
      const data = priorityMap.get(row.priority)!;
      return {
        ...row,
        count: data.count,
        pct: stats.total ? Math.round((data.count / stats.total) * 100) : 0,
        avgResponse: average(data.responseTimes),
        avgCompletion: average(data.completionTimes)
      };
    });

    // Hospital breakdown
    const hospitalMap = new Map<string, { total: number; pending: number; completed: number; emergency: number }>();
    filteredRequests.forEach(req => {
      const h = hospitalMap.get(req.hospitalName) || { total: 0, pending: 0, completed: 0, emergency: 0 };
      h.total += 1;
      if (req.status === RequestStatus.PENDING) h.pending += 1;
      if (req.status === RequestStatus.COMPLETED) h.completed += 1;
      if (req.priority === CallPriority.EMERGENCY) h.emergency += 1;
      hospitalMap.set(req.hospitalName, h);
    });
    const hospitalRows = Array.from(hospitalMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.total - a.total);
    const maxHospitalCount = Math.max(1, ...hospitalRows.map(h => h.total));

    // Hourly heatmap (0-23)
    const maxHourlyCount = Math.max(1, ...hourlyLoad.map(h => h.count));

    return {
      avgResponseMs: average(responseTimes),
      avgCompletionMs: average(completionTimes),
      completionRate: stats.total ? (stats.completed / stats.total) * 100 : 0,
      todayCount,
      delayedPending,
      fastResponses,
      mediumResponses,
      lateResponses,
      sevenDayLoad,
      maxSevenDayLoad: Math.max(1, ...sevenDayLoad.map(day => day.count)),
      statusBreakdown,
      statusDonutGradient,
      departmentRows,
      serviceRows,
      busiestHour,
      priorityRows,
      hospitalRows,
      maxHospitalCount,
      hourlyLoad,
      maxHourlyCount
    };
  }, [filteredRequests, language, stats.active, stats.completed, stats.pending, stats.total]);

  const openCreateUserModal = () => {
    setEditingUser(null);
    setUserError('');
    setFormData({
      name: '',
      username: '',
      password: '',
      role: UserRole.NURSE,
      assignedHospital: HOSPITALS[0]
    });
    setShowUserModal(true);
  };

  const openEditUserModal = (user: User) => {
    if (user.role === UserRole.OWNER && currentUser.role !== UserRole.OWNER) {
      window.alert(t('تعديل مالك النظام مسموح فقط لمالك النظام.', 'Only the system owner can edit the owner account.'));
      return;
    }

    setEditingUser(user);
    setUserError('');
    setFormData({
      name: user.name,
      username: user.username,
      password: '',
      role: user.role,
      assignedHospital: user.assignedHospital || HOSPITALS[0]
    });
    setShowUserModal(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setUserError('');

    if (!formData.name.trim() || !formData.username.trim()) {
      setUserError(t('يرجى إدخال الاسم واسم المستخدم.', 'Please provide name and username.'));
      return;
    }

    if (!editingUser && !formData.password.trim()) {
      setUserError(t('كلمة المرور مطلوبة عند إضافة مستخدم جديد.', 'Password is required when creating a new user.'));
      return;
    }

    if (formData.role === UserRole.OWNER && currentUser.role !== UserRole.OWNER) {
      setUserError(t('إنشاء مالك نظام مسموح فقط لمالك النظام الحالي.', 'Only the current owner can create another owner account.'));
      return;
    }

    const nextUser: User = {
      id: editingUser?.id || createId(),
      name: formData.name.trim(),
      username: formData.username.trim(),
      role: formData.role,
      password: formData.password.trim() || editingUser?.password || ''
    };

    if (formData.role === UserRole.NURSE || formData.role === UserRole.ADMISSION) {
      nextUser.assignedHospital = formData.assignedHospital;
    }

    try {
      storageService.saveUser(nextUser);
      fetchData();
      setShowUserModal(false);
      setEditingUser(null);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : t('فشل حفظ المستخدم.', 'Failed to save user.'));
    }
  };

  const handleDeleteUser = (userToDelete: User) => {
    if (userToDelete.id === currentUser.id) {
      window.alert(t('لا يمكنك حذف الحساب المستخدم حالياً.', 'You cannot delete the currently signed-in account.'));
      return;
    }
    if (userToDelete.role === UserRole.OWNER && currentUser.role !== UserRole.OWNER) {
      window.alert(t('حذف مالك النظام يتطلب صلاحية مالك النظام.', 'Deleting the owner account requires owner privileges.'));
      return;
    }

    const ok = window.confirm(
      t(
        `سيتم حذف المستخدم "${userToDelete.name}" نهائياً. متابعة؟`,
        `The user "${userToDelete.name}" will be deleted permanently. Continue?`
      )
    );
    if (!ok) return;

    try {
      storageService.deleteUser(userToDelete.id);
      fetchData();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : t('تعذر حذف المستخدم.', 'Failed to delete user.'));
    }
  };

  const managedUsers = users.filter(user => user.role !== UserRole.PATIENT);

  return (
    <div className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-4 lg:px-8 grid grid-cols-1 xl:grid-cols-4 gap-6 animate-fade-up">
      <div className="xl:col-span-3">
        <div className="motion-card bg-white rounded-3xl shadow-sm mb-8 overflow-hidden border border-slate-100 p-1.5 flex flex-col md:flex-row gap-2 md:gap-0">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex-1 py-4 font-bold text-sm rounded-2xl transition-all ${
              activeTab === 'OVERVIEW' ? 'bg-sky-700 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t('شاشة مدير النظام', 'System Admin Dashboard')}
          </button>
          <button
            onClick={() => setActiveTab('ANALYTICS')}
            className={`flex-1 py-4 font-bold text-sm rounded-2xl transition-all ${
              activeTab === 'ANALYTICS' ? 'bg-sky-700 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t('الإحصائيات', 'Analytics')}
          </button>
          <button
            onClick={() => setActiveTab('USERS')}
            className={`flex-1 py-4 font-bold text-sm rounded-2xl transition-all ${
              activeTab === 'USERS' ? 'bg-sky-700 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t('إدارة مستخدمي الموظفين', 'Staff User Management')}
          </button>
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex-1 py-4 font-bold text-sm rounded-2xl transition-all ${
              activeTab === 'REQUESTS' ? 'bg-sky-700 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            {t('سجل النداءات', 'Call History')}
          </button>
        </div>

        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <div className="motion-card bg-white rounded-3xl border border-slate-100 p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="font-black text-slate-900 text-xl">
                    {t('لوحة مدير النظام', 'System Admin Overview')}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1">{currentUser.name}</p>
                </div>
                <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                  <div className="w-full md:min-w-[200px]">
                    <label className="text-xs font-bold text-slate-500">{t('المستشفى', 'Hospital')}</label>
                    <select
                      value={selectedHospital}
                      onChange={e => setSelectedHospital(e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="ALL">{t('كل المستشفيات', 'All Hospitals')}</option>
                      {HOSPITALS.map(h => <option key={h} value={h}>{hospitalLabel(h, language)}</option>)}
                    </select>
                  </div>
                  <div className="w-full md:min-w-[160px]">
                    <label className="text-xs font-bold text-slate-500">{t('القسم', 'Department')}</label>
                    <select
                      value={selectedDepartment}
                      onChange={e => setSelectedDepartment(e.target.value)}
                      className="mt-1 w-full border border-slate-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    >
                      <option value="ALL">{t('كل الأقسام', 'All Departments')}</option>
                      {departmentOptions(language).map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button onClick={exportCSV} className="px-4 py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors whitespace-nowrap">
                      ⬇ {t('تصدير CSV', 'Export CSV')}
                    </button>
                    <button onClick={handlePrint} className="px-4 py-3 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors whitespace-nowrap">
                      🖨 {t('طباعة', 'Print')}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-3xl p-6 bg-gradient-to-br from-sky-600 to-sky-800 text-white shadow-lg">
                <p className="text-xs font-bold opacity-90">{t('إجمالي النداءات', 'Total Calls')}</p>
                <p className="text-4xl font-black mt-2">{stats.total}</p>
              </div>
              <div className="rounded-3xl p-6 bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-lg">
                <p className="text-xs font-bold opacity-90">{t('قيد الانتظار', 'Pending')}</p>
                <p className="text-4xl font-black mt-2">{stats.pending}</p>
              </div>
              <div className="rounded-3xl p-6 bg-gradient-to-br from-blue-600 to-cyan-500 text-white shadow-lg">
                <p className="text-xs font-bold opacity-90">{t('قيد التنفيذ', 'In Progress')}</p>
                <p className="text-4xl font-black mt-2">{stats.active}</p>
              </div>
              <div className="rounded-3xl p-6 bg-gradient-to-br from-teal-500 to-emerald-500 text-white shadow-lg">
                <p className="text-xs font-bold opacity-90">{t('مكتمل', 'Completed')}</p>
                <p className="text-4xl font-black mt-2">{stats.completed}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="bg-white rounded-3xl border border-sky-100 p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-500">{t('متوسط زمن أول استجابة', 'Average First Response Time')}</p>
                <p className="text-2xl font-black text-sky-700 mt-2">{formatDuration(dashboardInsights.avgResponseMs, language)}</p>
              </div>
              <div className="bg-white rounded-3xl border border-teal-100 p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-500">{t('متوسط زمن إغلاق النداء', 'Average Call Closure Time')}</p>
                <p className="text-2xl font-black text-teal-600 mt-2">{formatDuration(dashboardInsights.avgCompletionMs, language)}</p>
              </div>
              <div className="bg-white rounded-3xl border border-violet-100 p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-500">{t('نسبة الإنجاز', 'Completion Rate')}</p>
                <p className="text-2xl font-black text-violet-600 mt-2">
                  {dashboardInsights.completionRate.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white rounded-3xl border border-rose-100 p-5 shadow-sm">
                <p className="text-xs font-bold text-slate-500">{t('نداءات اليوم / المتأخر', 'Today Calls / Delayed')}</p>
                <p className="text-2xl font-black text-rose-600 mt-2">
                  {dashboardInsights.todayCount} / {dashboardInsights.delayedPending}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-black text-slate-900 text-lg">{t('اتجاه النداءات - آخر 7 أيام', 'Call Trend - Last 7 Days')}</h4>
                  <span className="text-xs font-bold text-slate-500">
                    {t('ساعة الذروة', 'Peak Hour')}: {dashboardInsights.busiestHour.hour}:00
                  </span>
                </div>
                <div className="h-48 flex items-end gap-3">
                  {dashboardInsights.sevenDayLoad.map(day => {
                    const ratio = (day.count / dashboardInsights.maxSevenDayLoad) * 100;
                    return (
                      <div key={day.key} className="flex-1 flex flex-col items-center gap-2">
                        <div className="w-full h-36 flex items-end">
                          <div
                            className="w-full rounded-xl bg-gradient-to-t from-sky-700 via-cyan-500 to-blue-300 shadow-md"
                            style={{ height: `${Math.max(6, ratio)}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-slate-500 font-bold">{day.label}</span>
                        <span className="text-[11px] text-slate-700 font-black">{day.count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h4 className="font-black text-slate-900 text-lg mb-4">{t('توزيع حالات النداءات', 'Call Status Distribution')}</h4>
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="w-44 h-44 mx-auto rounded-full p-4" style={{ background: dashboardInsights.statusDonutGradient }}>
                    <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center border border-slate-100">
                      <p className="text-xs text-slate-500 font-bold">{t('الإجمالي', 'Total')}</p>
                      <p className="text-3xl font-black text-slate-900">{stats.total}</p>
                    </div>
                  </div>
                  <div className="flex-1 space-y-3">
                    {dashboardInsights.statusBreakdown.map(item => (
                      <div key={item.key}>
                        <div className="flex items-center justify-between text-xs font-bold text-slate-600 mb-1">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${(item.value / Math.max(1, stats.total)) * 100}%`,
                              backgroundColor: item.color
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h4 className="font-black text-slate-900 text-lg mb-4">{t('أداء الأقسام', 'Department Performance')}</h4>
                <div className="space-y-4">
                  {dashboardInsights.departmentRows.slice(0, 6).map(row => (
                    <div key={row.department} className="rounded-2xl border border-slate-100 p-4 bg-slate-50/60">
                      <div className="flex items-center justify-between text-sm font-bold text-slate-800">
                        <span>{departmentLabel(row.department, language)}</span>
                        <span>{row.total} {t('نداء', 'call')}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-600"
                          style={{ width: `${(row.total / Math.max(1, stats.total)) * 100}%` }}
                        />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-slate-500">
                        <span>{t('انتظار', 'Pending')}: {row.pending}</span>
                        <span>{t('تنفيذ', 'Active')}: {row.active}</span>
                        <span>{t('مكتمل', 'Completed')}: {row.completed}</span>
                        <span>{t('متوسط استجابة', 'Avg Response')}: {formatDuration(row.avgResponseMs, language)}</span>
                      </div>
                    </div>
                  ))}
                  {!dashboardInsights.departmentRows.length && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-bold text-slate-400 text-center">
                      {t('لا توجد بيانات أقسام لعرضها حالياً.', 'No department data is currently available.')}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h4 className="font-black text-slate-900 text-lg mb-4">{t('تفصيل الخدمات وSLA', 'Service Breakdown & SLA')}</h4>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="rounded-2xl p-3 bg-emerald-50 border border-emerald-100">
                    <p className="text-[11px] text-emerald-700 font-bold">{t('≤ 5 دقائق', '≤ 5 minutes')}</p>
                    <p className="text-xl text-emerald-700 font-black mt-1">{dashboardInsights.fastResponses}</p>
                  </div>
                  <div className="rounded-2xl p-3 bg-amber-50 border border-amber-100">
                    <p className="text-[11px] text-amber-700 font-bold">{t('5 - 15 دقيقة', '5 - 15 minutes')}</p>
                    <p className="text-xl text-amber-700 font-black mt-1">{dashboardInsights.mediumResponses}</p>
                  </div>
                  <div className="rounded-2xl p-3 bg-rose-50 border border-rose-100">
                    <p className="text-[11px] text-rose-700 font-bold">{t('> 15 دقيقة', '> 15 minutes')}</p>
                    <p className="text-xl text-rose-700 font-black mt-1">{dashboardInsights.lateResponses}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {dashboardInsights.serviceRows.slice(0, 6).map((service, idx) => (
                    <div key={service.service} className="rounded-2xl border border-slate-100 p-3">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
                        <span>{serviceTypeLabel(service.service, language)}</span>
                        <span>{service.count}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(service.count / Math.max(1, stats.total)) * 100}%`,
                            background:
                              idx % 3 === 0
                                ? 'linear-gradient(90deg, #0284c7, #06b6d4)'
                                : idx % 3 === 1
                                  ? 'linear-gradient(90deg, #0ea5e9, #6366f1)'
                                  : 'linear-gradient(90deg, #06b6d4, #14b8a6)'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {!dashboardInsights.serviceRows.length && (
                    <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm font-bold text-slate-400 text-center">
                      {t('لا توجد بيانات خدمات لعرضها حالياً.', 'No service data is currently available.')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ANALYTICS' && (
          <div className="space-y-6">
            {/* Export bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
              <p className="text-sm font-bold text-slate-600">
                {t('الفلتر الحالي', 'Current filter')}: {selectedHospital === 'ALL' ? t('كل المستشفيات', 'All Hospitals') : hospitalLabel(selectedHospital, language)}
                {selectedDepartment !== 'ALL' && ` / ${departmentLabel(selectedDepartment, language)}`}
                {' — '}{filteredRequests.length} {t('نداء', 'calls')}
              </p>
              <div className="flex items-center gap-2">
                <button onClick={exportCSV} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                  ⬇ {t('تصدير CSV', 'Export CSV')}
                </button>
                <button onClick={handlePrint} className="px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors">
                  🖨 {t('طباعة', 'Print')}
                </button>
              </div>
            </div>

            {/* Header KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: t('إجمالي النداءات', 'Total Calls'), value: stats.total, icon: '📊', color: 'from-sky-600 to-cyan-500' },
                { label: t('نداءات اليوم', 'Today'), value: dashboardInsights.todayCount, icon: '📅', color: 'from-violet-600 to-purple-500' },
                { label: t('نسبة الإنجاز', 'Completion Rate'), value: `${dashboardInsights.completionRate.toFixed(0)}%`, icon: '✅', color: 'from-emerald-600 to-teal-500' },
                { label: t('متأخر عن الرد', 'Delayed'), value: dashboardInsights.delayedPending, icon: '⚠️', color: 'from-rose-600 to-red-500' }
              ].map(card => (
                <div key={card.label} className={`rounded-3xl p-5 bg-gradient-to-br ${card.color} text-white shadow-lg`}>
                  <p className="text-2xl mb-1">{card.icon}</p>
                  <p className="text-3xl font-black">{card.value}</p>
                  <p className="text-xs font-bold opacity-85 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Priority Infographic */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <h4 className="font-black text-slate-900 text-lg mb-5">
                🎯 {t('توزيع النداءات حسب الأولوية', 'Calls by Priority')}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
                {dashboardInsights.priorityRows.map(row => {
                  const circumference = 2 * Math.PI * 36;
                  const dash = (row.pct / 100) * circumference;
                  return (
                    <div key={row.priority} className={`rounded-2xl border ${row.border} ${row.light} p-5 flex flex-col items-center gap-3`}>
                      <div className="relative w-24 h-24">
                        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 80 80">
                          <circle cx="40" cy="40" r="36" fill="none" stroke="#e2e8f0" strokeWidth="7" />
                          <circle cx="40" cy="40" r="36" fill="none" stroke={row.color} strokeWidth="7"
                            strokeDasharray={`${dash} ${circumference}`} strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className={`text-2xl font-black ${row.text}`}>{row.pct}%</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className={`text-3xl font-black ${row.text}`}>{row.count}</p>
                        <p className="text-sm font-black text-slate-700 mt-1">{row.label}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {t('متوسط الاستجابة', 'Avg Response')}: {formatDuration(row.avgResponse, language)}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {t('متوسط الإغلاق', 'Avg Closure')}: {formatDuration(row.avgCompletion, language)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Priority bar */}
              {stats.total > 0 && (
                <div className="h-5 rounded-full overflow-hidden flex gap-0.5">
                  {dashboardInsights.priorityRows.filter(r => r.count > 0).map(row => (
                    <div
                      key={row.priority}
                      className={`h-full ${row.bg} transition-all`}
                      style={{ width: `${row.pct}%` }}
                      title={`${row.label}: ${row.count}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Time metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-3xl border border-sky-100 p-6 text-center shadow-sm">
                <p className="text-4xl mb-2">⚡</p>
                <p className="text-3xl font-black text-sky-700">{formatDuration(dashboardInsights.avgResponseMs, language)}</p>
                <p className="text-xs font-bold text-slate-500 mt-2">{t('متوسط أول استجابة', 'Avg First Response')}</p>
              </div>
              <div className="bg-white rounded-3xl border border-teal-100 p-6 text-center shadow-sm">
                <p className="text-4xl mb-2">🏁</p>
                <p className="text-3xl font-black text-teal-600">{formatDuration(dashboardInsights.avgCompletionMs, language)}</p>
                <p className="text-xs font-bold text-slate-500 mt-2">{t('متوسط وقت الإغلاق', 'Avg Closure Time')}</p>
              </div>
              <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                <p className="text-xs font-bold text-slate-500 mb-3">{t('الاستجابة حسب SLA', 'Response by SLA')}</p>
                {[
                  { label: t('سريع ≤5 د', 'Fast ≤5m'), count: dashboardInsights.fastResponses, color: 'bg-emerald-500' },
                  { label: t('متوسط 5-15 د', 'Medium 5-15m'), count: dashboardInsights.mediumResponses, color: 'bg-amber-400' },
                  { label: t('بطيء >15 د', 'Slow >15m'), count: dashboardInsights.lateResponses, color: 'bg-rose-500' }
                ].map(sla => {
                  const total = dashboardInsights.fastResponses + dashboardInsights.mediumResponses + dashboardInsights.lateResponses || 1;
                  return (
                    <div key={sla.label} className="mb-2">
                      <div className="flex justify-between text-xs font-bold text-slate-600 mb-1">
                        <span>{sla.label}</span><span>{sla.count}</span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${sla.color}`} style={{ width: `${(sla.count / total) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hospital KPI Cards */}
            {dashboardInsights.hospitalRows.length > 0 && (
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <h4 className="font-black text-slate-900 text-lg mb-5">
                  🏥 {t('مؤشرات الأداء لكل مستشفى', 'Hospital KPIs')}
                </h4>
                {/* Bar comparison */}
                <div className="space-y-3 mb-6">
                  {dashboardInsights.hospitalRows.map(h => {
                    const completionPct = h.total ? Math.round((h.completed / h.total) * 100) : 0;
                    return (
                      <div key={h.name} className="rounded-2xl border border-slate-100 p-4 bg-slate-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-black text-slate-800 truncate max-w-[55%]">{hospitalLabel(h.name, language)}</span>
                          <div className="flex items-center gap-2 text-xs font-bold flex-shrink-0">
                            {h.emergency > 0 && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">🔴 {h.emergency}</span>}
                            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">⏳ {h.pending}</span>
                            <span className="bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">✓ {h.completed}</span>
                            <span className="bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full font-black">{h.total}</span>
                          </div>
                        </div>
                        <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex gap-0.5">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${(h.emergency / dashboardInsights.maxHospitalCount) * 100}%` }} />
                          <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(h.pending / dashboardInsights.maxHospitalCount) * 100}%` }} />
                          <div className="h-full bg-teal-400 rounded-full" style={{ width: `${(h.completed / dashboardInsights.maxHospitalCount) * 100}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-1.5 text-[11px] font-bold text-slate-400">
                          <span>{t('نسبة الإنجاز', 'Completion')}: <span className={completionPct >= 70 ? 'text-teal-600' : completionPct >= 40 ? 'text-amber-600' : 'text-red-500'}>{completionPct}%</span></span>
                          <span>{t('من إجمالي', 'of total')}: {h.total ? Math.round((h.total / Math.max(1, stats.total)) * 100) : 0}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" />{t('طارئ', 'Emergency')}</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />{t('انتظار', 'Pending')}</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-teal-400 inline-block" />{t('مكتمل', 'Completed')}</span>
                </div>
              </div>
            )}

            {/* Hourly heatmap */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h4 className="font-black text-slate-900 text-lg">
                  🕐 {t('التوزيع الساعي للنداءات', 'Hourly Call Distribution')}
                </h4>
                <span className="text-xs font-bold text-slate-500 bg-sky-50 px-3 py-1 rounded-full">
                  {t('ساعة الذروة', 'Peak hour')}: {dashboardInsights.busiestHour.hour}:00
                </span>
              </div>
              <div className="flex items-end gap-1 h-24">
                {dashboardInsights.hourlyLoad.map(slot => {
                  const ratio = slot.count / dashboardInsights.maxHourlyCount;
                  const isPeak = slot.hour === dashboardInsights.busiestHour.hour;
                  return (
                    <div key={slot.hour} className="flex-1 flex flex-col items-center gap-1" title={`${slot.hour}:00 — ${slot.count}`}>
                      <div className="w-full flex items-end justify-center" style={{ height: '72px' }}>
                        <div
                          className={`w-full rounded-t-md transition-all ${isPeak ? 'bg-sky-600' : 'bg-sky-200'}`}
                          style={{ height: `${Math.max(4, ratio * 72)}px` }}
                        />
                      </div>
                      {slot.hour % 4 === 0 && (
                        <span className="text-[9px] text-slate-400 font-bold">{slot.hour}</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400 font-bold mt-2 text-center">{t('الساعة (0-23)', 'Hour (0-23)')}</p>
            </div>
          </div>
        )}

        {activeTab === 'USERS' && (
          <div className="motion-card bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-slate-900 text-xl">
                  {t('صلاحيات المستخدمين', 'User Access Permissions')}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {t(
                    'مدير النظام ينشئ ويعدل ويحذف حسابات الموظفين مع تحديد المستشفى فقط.',
                    'System admin can create, edit, and delete staff accounts with hospital assignment only.'
                  )}
                </p>
              </div>
              <button
                onClick={openCreateUserModal}
                className="bg-sky-700 text-white px-6 py-3 rounded-xl font-bold hover:bg-sky-800 transition-colors"
              >
                {t('إضافة مستخدم +', 'Add User +')}
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold">
                  <tr>
                    <th className="px-6 py-4">{t('الاسم', 'Name')}</th>
                    <th className="px-6 py-4">{t('اسم الدخول', 'Username')}</th>
                    <th className="px-6 py-4">{t('الدور', 'Role')}</th>
                    <th className="px-6 py-4">{t('النطاق', 'Scope')}</th>
                    <th className="px-6 py-4 text-left">{t('العمليات', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {managedUsers.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-slate-900">{user.name}</td>
                      <td className="px-6 py-4 text-slate-600">{user.username}</td>
                      <td className="px-6 py-4">
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-sky-50 text-sky-800">
                          {translatedRoleLabel(user.role, language)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {user.role === UserRole.NURSE || user.role === UserRole.ADMISSION
                          ? user.assignedHospital
                            ? hospitalLabel(user.assignedHospital, language)
                            : t('غير محدد', 'Unassigned')
                          : t('صلاحية إدارية', 'Administrative Access')}
                      </td>
                      <td className="px-6 py-4 text-left">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditUserModal(user)}
                            disabled={
                              user.role === UserRole.OWNER && currentUser.role !== UserRole.OWNER
                            }
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {t('تعديل', 'Edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-700 hover:bg-red-100"
                          >
                            {t('حذف', 'Delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'REQUESTS' && (
          <div className="motion-card bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900 text-xl">{t('سجل نداءات المرضى', 'Patient Calls Log')}</h3>
                <span className="text-xs text-slate-500 font-bold">{filteredRequests.length} {t('نداء', 'call')}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportCSV} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                  ⬇ {t('تصدير CSV', 'Export CSV')}
                </button>
                <button onClick={handlePrint} className="px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors">
                  🖨 {t('طباعة', 'Print')}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-bold">
                  <tr>
                    <th className="px-6 py-4">{t('المريض', 'Patient')}</th>
                    <th className="px-6 py-4">{t('الأولوية', 'Priority')}</th>
                    <th className="px-6 py-4">{t('الخدمة', 'Service')}</th>
                    <th className="px-6 py-4">{t('الحالة', 'Status')}</th>
                    <th className="px-6 py-4">{t('الموقع', 'Location')}</th>
                    <th className="px-6 py-4">{t('التاريخ', 'Date')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequests.map(request => (
                    <tr key={request.id}>
                      <td className="px-6 py-4 font-bold text-slate-900">{request.patientName}</td>
                      <td className="px-6 py-4">
                        {request.priority && (
                          <span className={`px-2 py-1 rounded-full text-[10px] font-black ${
                            request.priority === CallPriority.EMERGENCY ? 'bg-red-100 text-red-700' :
                            request.priority === CallPriority.NURSE_CALL ? 'bg-orange-100 text-orange-700' :
                            request.priority === CallPriority.MEDICATION ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {priorityLabel(request.priority, language)}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-700">{serviceTypeLabel(request.serviceType, language)}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">
                        {requestStatusLabel(request.status, language)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        {t(
                          `${hospitalLabel(request.hospitalName, language)} - ${departmentLabel(request.department, language)} - غرفة ${request.roomNumber} - سرير ${request.bedNumber}`,
                          `${hospitalLabel(request.hospitalName, language)} - ${departmentLabel(request.department, language)} - Room ${request.roomNumber} - Bed ${request.bedNumber}`
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500">
                        {formatDateTime(request.createdAt, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showUserModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-lg p-7 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900 mb-6">
              {editingUser ? t('تعديل مستخدم', 'Edit User') : t('إضافة مستخدم جديد', 'Add New User')}
            </h3>

            <form onSubmit={handleSaveUser} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{t('الاسم', 'Name')}</label>
                <input
                  required
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t('اسم الدخول', 'Username')}</label>
                  <input
                    required
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t('كلمة المرور', 'Password')}</label>
                  <input
                    type="password"
                    placeholder={editingUser ? t('اتركها فارغة للإبقاء على الحالية', 'Leave empty to keep current password') : ''}
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">{t('الدور', 'Role')}</label>
                <select
                  className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                >
                  {currentUser.role === UserRole.OWNER && (
                    <option value={UserRole.OWNER}>{translatedRoleLabel(UserRole.OWNER, language)}</option>
                  )}
                  <option value={UserRole.ADMIN}>{translatedRoleLabel(UserRole.ADMIN, language)}</option>
                  <option value={UserRole.NURSE}>{translatedRoleLabel(UserRole.NURSE, language)}</option>
                  <option value={UserRole.ADMISSION}>{translatedRoleLabel(UserRole.ADMISSION, language)}</option>
                </select>
              </div>

              {(formData.role === UserRole.NURSE || formData.role === UserRole.ADMISSION) && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">{t('المستشفى', 'Hospital')}</label>
                  <select
                    className="w-full border border-slate-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-sky-400"
                    value={formData.assignedHospital}
                    onChange={e => setFormData({ ...formData, assignedHospital: e.target.value })}
                  >
                    {HOSPITALS.map(hospital => (
                      <option key={hospital} value={hospital}>
                        {hospitalLabel(hospital, language)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {userError && <p className="text-red-600 text-sm font-bold">{userError}</p>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="flex-1 py-3 bg-slate-100 rounded-xl font-bold hover:bg-slate-200"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-sky-700 text-white rounded-xl font-bold hover:bg-sky-800"
                >
                  {t('حفظ', 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
