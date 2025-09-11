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
    <div className="min-h-screen">
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
