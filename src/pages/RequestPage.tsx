import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface Site { id: number; name: string; }
interface Employee { id: number; full_name: string; }

export default function RequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<number>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<number>();
  // Auth state
  const [session, setSession] = useState<unknown | null>(null);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [showLogin, setShowLogin] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  // Date/Time input pre-populated with "now"
  const [dateTime, setDateTime] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    // Format for input[type="datetime-local"]
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
  });

  useEffect(() => {
    // Auth session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setCheckingAuth(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Load sites from Supabase
    if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.log('[RequestPage] ENV present', {
        VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY_len: String(import.meta.env.VITE_SUPABASE_ANON_KEY).length,
      });
      console.log('[RequestPage] Fetching sites from app_sites ...');
      (async () => {
        try {
          const r = await supabase
            .from('app_sites')
            .select('id,name')
            .order('name', { ascending: true });
          if (r.error) {
            console.error('[RequestPage] Failed to load sites', r.error);
            setSites([]);
          } else {
            const rows = (r.data as Site[]) || [];
            console.log('[RequestPage] Sites loaded', rows.length, rows.slice(0, 5));
            setSites(rows);
          }
        } catch (error) {
          console.error('[RequestPage] Sites fetch threw', error);
          setSites([]);
        }
      })();
    } else {
      console.warn('[RequestPage] Missing env vars for Supabase');
    }
  }, []);

  useEffect(() => {
    if (!siteId) { setEmployees([]); return; }
    console.log('[RequestPage] siteId changed', siteId);
    // Load employees for selected site from Supabase
    if (siteId && import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.log('[RequestPage] Fetching employees via app_site_employees for site', siteId);
      (async () => {
        try {
          const r = await supabase
            .from('app_site_employees')
            .select('app_employees ( id, full_name )')
            .eq('site_id', siteId);
          if (r.error) {
            console.error('[RequestPage] Employees load error', r.error);
            setEmployees([]);
            return;
          }
          const rows = (r.data as any[]) || [];
          console.log('[RequestPage] Raw employee join rows', rows.slice(0, 5));
          const list: Employee[] = rows
            .map((row) => row.app_employees)
            .filter(Boolean);
          console.log('[RequestPage] Employees derived', list.length, list.slice(0, 5));
          setEmployees(list);
        } catch (error) {
          console.error('[RequestPage] Employees fetch threw', error);
          setEmployees([]);
        }
      })();
    }
  }, [siteId, sites]);

  // Enable submit when a site and employee are selected
  const canSubmit = Boolean(siteId) && Boolean(employeeId);

  const submit = async () => {
    // Navigate to supplies page with selected site and employee in state
    const site = sites.find(s => s.id === siteId);
    const siteName = site?.name || '';
    navigate('/supplies', {
      state: {
        siteId,
        siteName,
        employeeId,
        employeeName: employees.find(e => e.id === employeeId)?.full_name || ''
      }
    });
  };

  const login = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: password });
      if (error) {
        setAuthError(error.message);
        return;
      }
      setShowLogin(false);
      navigate('/admin');
    } catch (e: any) {
      setAuthError(e?.message || 'Login failed');
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  // Check if Supabase is configured
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
    return (
      <div className="text-center p-8">
        <h2 className="text-xl font-bold mb-4">{t('configuration required')}</h2>
        <p className="mb-4">{t('missing env vars')}</p>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">{t('please create env file')}</p>
          <pre className="mt-2 text-sm">
            VITE_SUPABASE_URL=https://tmlhbsjpzszeodwxnjcl.supabase.co<br/>
            VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRtbGhic2pwenN6ZW9kd3huamNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwMTE1MTIsImV4cCI6MjA3MDU4NzUxMn0.baNVcOvLhlG-Gluu9yjaxt9j51EYW4hUiR-YbXOGfPM
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Admin actions */}
      <div className="flex justify-end gap-2">
        {checkingAuth ? null : session ? (
          <>
            <button onClick={() => navigate('/admin')} className="px-3 py-1 border rounded">{t('admin')}</button>
            <button onClick={logout} className="px-3 py-1 border rounded">{t('logout')}</button>
          </>
        ) : (
          <button onClick={() => setShowLogin(true)} className="px-3 py-1 border rounded">{t('admin login')}</button>
        )}
      </div>

      <select className="w-full border" value={siteId} onChange={e=>{ setSiteId(Number(e.target.value)); setEmployeeId(undefined); }}>
        <option value="">{t('site')}</option>
        {sites.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select className="w-full border" value={employeeId} onChange={e=>setEmployeeId(Number(e.target.value))}>
        <option value="">{t('employee')}</option>
        {employees.map(e=> <option key={e.id} value={e.id}>{e.full_name}</option>)}
      </select>
      <input
        type="datetime-local"
        className="w-full border"
        value={dateTime}
        onChange={e => setDateTime(e.target.value)}
      />
      <button disabled={!canSubmit} onClick={submit} className="w-full bg-blue-500 text-white p-2 disabled:bg-gray-300">
        {t('submit')}
      </button>

      {/* Login modal */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white rounded shadow p-4 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-2">{t('admin login')}</h3>
            <div className="space-y-2">
              <input
                type="email"
                placeholder="Email"
                className="w-full border p-2 rounded"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full border p-2 rounded"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
              />
              {authError && (
                <div className="text-sm text-red-600">{authError}</div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={()=>setShowLogin(false)} className="px-3 py-1 border rounded">{t('cancel')}</button>
                <button disabled={authLoading} onClick={login} className="px-3 py-1 bg-blue-600 text-white rounded disabled:bg-blue-300">
                  {authLoading ? t('loading') : t('submit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
