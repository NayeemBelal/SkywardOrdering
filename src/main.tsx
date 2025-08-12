import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import RequestPage from './pages/RequestPage';
import SuccessPage from './pages/SuccessPage';
import SuppliesPage from './pages/SuppliesPage';
import AdminApp from './admin/AdminApp';
import { supabase } from './lib/supabase';
import './i18n';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<Navigate to="/request" replace />} />
          <Route path="request" element={<RequestPage />} />
          <Route path="supplies" element={<SuppliesPage />} />
          <Route path="success" element={<SuccessPage />} />
          <Route
            path="admin/*"
            element={<AuthGate><AdminApp /></AuthGate>}
          />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  const [authed, setAuthed] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      if (!mounted) return;
      setAuthed(!!sess);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  if (!ready) return null;
  return authed ? <>{children}</> : <Navigate to="/request" replace />;
}
