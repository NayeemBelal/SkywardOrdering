import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import RequestPage from './pages/RequestPage';
import SuccessPage from './pages/SuccessPage';
import AdminApp from './admin/AdminApp';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route path="request" element={<RequestPage />} />
          <Route path="success" element={<SuccessPage />} />
          <Route path="admin/*" element={<AdminApp />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
