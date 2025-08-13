import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import AddSite from './AddSite';
import SiteDetail from './SiteDetail';
import { useTranslation } from 'react-i18next';

export default function AdminApp() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [overlay, setOverlay] = React.useState(false);
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">{t('admin')}</h1>
        <div className="flex gap-2">
          <Link to="/request" className="px-3 py-1 border rounded">{t('back to request')}</Link>
          <button onClick={() => navigate('/admin')} className="px-3 py-1 border rounded">{t('dashboard')}</button>
        </div>
      </div>
      {overlay && (
        <div className="loading-overlay"><div className="spinner" /></div>
      )}
      <Routes>
        <Route index element={<AdminDashboard />} />
        <Route path="sites/new" element={<AddSite />} />
        <Route path="sites/:siteId" element={<SiteDetail />} />
      </Routes>
    </div>
  );
}
