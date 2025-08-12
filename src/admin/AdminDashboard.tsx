import React from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type Site = { id: number; name: string };

export default function AdminDashboard() {
  const [sites, setSites] = React.useState<Site[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string>('');

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data, error } = await supabase.from('app_sites').select('id,name').order('name');
        if (error) throw error;
        if (!mounted) return;
        // Hide duplicates client-side by normalized name
        const uniqueByNorm = new Map<string, Site>();
        (data || []).forEach((s: any) => {
          const norm = String(s.name || '').trim().toLowerCase();
          if (!uniqueByNorm.has(norm)) uniqueByNorm.set(norm, s as Site);
        });
        setSites(Array.from(uniqueByNorm.values()));
      } catch (e: any) {
        setError(e.message || 'Failed to load sites');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Sites</h2>
        <Link to="/admin/sites/new" className="px-3 py-1 bg-blue-600 text-white rounded">Add site</Link>
      </div>
      {loading && <div className="p-3">Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}
      <ul className="divide-y border rounded">
        {sites.map(s => (
          <li key={s.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
            <Link to={`/admin/sites/${s.id}`} className="font-medium">{s.name}</Link>
          </li>
        ))}
        {sites.length === 0 && !loading && (
          <li className="p-3 text-gray-500">No sites yet</li>
        )}
      </ul>
    </div>
  );
}


