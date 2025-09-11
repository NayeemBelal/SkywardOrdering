import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation } from 'react-router-dom';
import { FEATURES } from '../config/features';

interface Site { id: number; name: string; }
interface Employee { id: number; full_name: string; }

export default function RequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { sessionExpired?: boolean } };

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
  // PIN state
  const [showPinPrompt, setShowPinPrompt] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [pinLoading, setPinLoading] = useState<boolean>(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number>(5);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockTimeRemaining, setLockTimeRemaining] = useState<number>(0);
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
    if (FEATURES.ENABLE_SITE_PINS) {
      // Show PIN prompt
      setShowPinPrompt(true);
      setPinError('');
      setPin('');
    } else {
      // Direct navigation (feature flag disabled)
      proceedToSupplies();
    }
  };

  const proceedToSupplies = () => {
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

  const validatePin = async () => {
    if (!pin || pin.length !== 6) {
      setPinError('PIN must be 6 digits');
      return;
    }

    setPinLoading(true);
    setPinError('');

    try {
      const { data, error } = await supabase.functions.invoke('validate-site-pin', {
        body: { siteId, pin }
      });

      if (error) {
        console.error('PIN validation error:', error);
        
        // Check if it's a service error (5xx) vs validation error (4xx)
        if (error.status >= 500) {
          // Service is down - allow fallback access
          setPinError('Service temporarily unavailable. Proceeding without PIN validation.');
          setTimeout(() => {
            setShowPinPrompt(false);
            proceedToSupplies();
          }, 2000);
          return;
        } else {
          // Validation error (4xx) - PIN is wrong or other client error
          setPinError('Invalid PIN. Please try again.');
          setPin(''); // Clear PIN input
          return;
        }
      }

      if (data?.valid) {
        // PIN is correct
        setShowPinPrompt(false);
        proceedToSupplies();
      } else {
        // PIN is incorrect
        if (data?.locked) {
          setIsLocked(true);
          setLockTimeRemaining(data.remainingTime || 60);
          setPinError(`Too many failed attempts. Try again in ${data.remainingTime || 60} seconds.`);
          startCountdown(data.remainingTime || 60);
        } else {
          setRemainingAttempts(data?.remainingAttempts || 0);
          setPinError(`Invalid PIN. ${data?.remainingAttempts || 0} attempts remaining.`);
        }
        setPin(''); // Clear PIN input
      }
    } catch (err) {
      console.error('PIN validation failed:', err);
      // Network or parsing error - show error but don't auto-proceed
      setPinError('Unable to validate PIN. Please try again.');
      setPin(''); // Clear PIN input
    } finally {
      setPinLoading(false);
    }
  };

  const startCountdown = (seconds: number) => {
    const interval = setInterval(() => {
      setLockTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsLocked(false);
          setRemainingAttempts(5);
          setPinError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handlePinInput = (value: string) => {
    // Only allow digits and max 6 characters
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    setPin(digitsOnly);
    setPinError('');
  };

  const closePinPrompt = () => {
    setShowPinPrompt(false);
    setPin('');
    setPinError('');
    setIsLocked(false);
    setLockTimeRemaining(0);
    setRemainingAttempts(5);
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

      {/* Session expired notification */}
      {location.state?.sessionExpired && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <div className="flex items-center gap-2 text-orange-800">
            <span>⏰</span>
            <div>
              <div className="font-medium">Session Expired</div>
              <div className="text-sm">Your session has expired due to inactivity. Please select your site and employee again.</div>
            </div>
          </div>
        </div>
      )}

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

      {/* PIN prompt modal */}
      {showPinPrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-sm mx-4">
            <div className="text-center mb-4">
              <h3 className="text-lg font-medium mb-1">Site PIN Required</h3>
              <p className="text-sm text-gray-600">
                Enter the 6-digit PIN for {sites.find(s => s.id === siteId)?.name}
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  className="w-full text-center text-2xl font-mono border-2 border-gray-300 rounded-lg p-3 tracking-widest focus:border-blue-500 focus:outline-none"
                  placeholder="••••••"
                  value={pin}
                  onChange={(e) => handlePinInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && pin.length === 6 && !isLocked && !pinLoading) {
                      validatePin();
                    }
                  }}
                  disabled={isLocked || pinLoading}
                />
              </div>

              {pinError && (
                <div className="text-sm text-red-600 text-center">
                  {pinError}
                </div>
              )}

              {isLocked && lockTimeRemaining > 0 && (
                <div className="text-sm text-orange-600 text-center">
                  Locked for {lockTimeRemaining} seconds
                </div>
              )}

              {!isLocked && remainingAttempts < 5 && remainingAttempts > 0 && (
                <div className="text-sm text-yellow-600 text-center">
                  {remainingAttempts} attempts remaining
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  onClick={closePinPrompt} 
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  disabled={pinLoading}
                >
                  {t('cancel')}
                </button>
                <button 
                  disabled={pin.length !== 6 || isLocked || pinLoading} 
                  onClick={validatePin} 
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700"
                >
                  {pinLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Verifying...
                    </div>
                  ) : (
                    'Submit'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
