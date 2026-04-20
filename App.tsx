import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Language, getInitialLanguage, persistLanguage } from './services/i18n';
import PatientPortal from './components/PatientPortal';
import StaffAuthGate from './components/StaffAuthGate';
import DepartmentDisplayScreen from './components/DepartmentDisplayScreen';
import HospitalDisplayScreen from './components/HospitalDisplayScreen';
import NurseStationGuard from './components/NurseStationGuard';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());

  useEffect(() => {
    persistLanguage(language);
  }, [language]);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/patient" replace />} />
      <Route
        path="/patient"
        element={<PatientPortal language={language} onLanguageChange={setLanguage} />}
      />
      {/* Legacy reviewer route redirect */}
      <Route path="/reviewer" element={<Navigate to="/patient" replace />} />

      {/* Staff portal (Admin, Nurse, Admission) */}
      <Route
        path="/admin"
        element={<StaffAuthGate language={language} onLanguageChange={setLanguage} />}
      />
      <Route
        path="/admin/*"
        element={<StaffAuthGate language={language} onLanguageChange={setLanguage} />}
      />

      {/* Department display screen (TV) — no auth */}
      <Route
        path="/display/:hospitalSlug/:deptSlug"
        element={<DepartmentDisplayScreen language={language} onLanguageChange={setLanguage} />}
      />

      {/* Hospital display screen (TV) — no auth */}
      <Route
        path="/display/:hospitalSlug"
        element={<HospitalDisplayScreen language={language} onLanguageChange={setLanguage} />}
      />

      {/* Nursing station — auth required */}
      <Route
        path="/nurse/:hospitalSlug"
        element={<NurseStationGuard language={language} onLanguageChange={setLanguage} />}
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/patient" replace />} />
    </Routes>
  );
};

export default App;
