import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface Item { id: number; name_es: string; name_en: string; }
interface Site { id: number; name: string; }
interface Employee { id: number; full_name: string; }

export default function RequestPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState<number>();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState<number>();
  const [items, setItems] = useState<Item[]>([]);
  const [onHand, setOnHand] = useState<Record<number, number>>({});
  const [orderQty, setOrderQty] = useState<Record<number, number>>({});

  useEffect(() => {
    supabase.from('sites').select('*').then(r => setSites(r.data || []));
  }, []);

  useEffect(() => {
    if (!siteId) return;
    supabase.from('site_employees').select('employees(*)').eq('site_id', siteId).then(r =>
      setEmployees((r.data || []).map((x:any)=>x.employees)));
    supabase.from('site_items').select('items(*)').eq('site_id', siteId).then(r =>
      setItems((r.data || []).map((x:any)=>x.items)));
  }, [siteId]);

  const canSubmit = employeeId && Object.values(orderQty).some(q => (q||0) > 0);

  const submit = async () => {
    const { data: req } = await supabase
      .from('requests')
      .insert({ site_id: siteId, employee_id: employeeId })
      .select('*').single();
    const rows = items.map(it => ({
      request_id: req.id,
      item_id: it.id,
      on_hand: onHand[it.id] || 0,
      order_qty: orderQty[it.id] || 0,
    }));
    await supabase.from('request_items').insert(rows);
    await supabase.functions.invoke('send-request-email', { body: { requestId: req.id } });
    navigate('/success');
  };

  return (
    <div className="space-y-4">
      <select className="w-full border" value={siteId} onChange={e=>setSiteId(Number(e.target.value))}>
        <option value="">Site</option>
        {sites.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <select className="w-full border" value={employeeId} onChange={e=>setEmployeeId(Number(e.target.value))}>
        <option value="">Empleado</option>
        {employees.map(e=> <option key={e.id} value={e.id}>{e.full_name}</option>)}
      </select>
      <div className="space-y-2">
        {items.map(it => (
          <div key={it.id} className="flex items-center space-x-2 p-2 bg-white rounded">
            <img src={`https://placehold.co/80x80`} alt="" />
            <div className="flex-1">{i18n.language === 'es' ? it.name_es : it.name_en}</div>
            <input type="number" min={0} className="w-16 border" value={onHand[it.id]||''}
              onChange={e=>setOnHand({...onHand,[it.id]:Number(e.target.value)})} />
            <input type="number" min={0} className="w-16 border" value={orderQty[it.id]||''}
              onChange={e=>setOrderQty({...orderQty,[it.id]:Number(e.target.value)})} />
          </div>
        ))}
      </div>
      <button disabled={!canSubmit} onClick={submit} className="w-full bg-blue-500 text-white p-2 disabled:bg-gray-300">
        {t('submit')}
      </button>
    </div>
  );
}
