import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';

interface Item { id: number; name: string; sku: string; category?: string; }

export default function SuppliesPage() {
  const navigate = useNavigate();
  const location = useLocation() as { state?: { siteId?: number; siteName?: string; employeeName?: string } };
  const siteId = location.state?.siteId;
  const siteName = location.state?.siteName || '';
  const employeeName = location.state?.employeeName || '';

  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New: capture per-item inputs
  const [onHand, setOnHand] = useState<Record<number, number>>({});
  const [orderQty, setOrderQty] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { t } = useTranslation();

  useEffect(() => {
    if (!siteId) return;
    console.log('[SuppliesPage] Loading items for site', siteId);
    // Load items for the selected site from Supabase via app_site_items join
    supabase
      .from('app_site_items')
      .select('app_items ( id, name, sku, category )')
      .eq('site_id', siteId)
      .then((r) => {
        if (r.error) {
          console.error('[SuppliesPage] Items load error', r.error);
          setError('Failed to load items');
          setItems([]);
          return;
        }
        const rows = (r.data as any[]) || [];
        console.log('[SuppliesPage] Raw item join rows', rows.slice(0, 5));
        const list: Item[] = rows.map((row) => row.app_items).filter(Boolean);
        console.log('[SuppliesPage] Items derived', list.length, list.slice(0, 5));
        // Sort categories: Consumables, Supply, Equipment
        const order: Record<string, number> = { consumables: 0, supply: 1, equipment: 2 };
        list.sort((a, b) => {
          const ca = order[String(a.category || 'supply')];
          const cb = order[String(b.category || 'supply')];
          if (ca !== cb) return ca - cb;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
        setItems(list);
      });
  }, [siteId]);

  const siteItems = items || [];
  const grouped = useMemo(() => {
    const g: Record<string, Item[]> = { consumables: [], supply: [], equipment: [] };
    for (const it of siteItems) {
      const key = (it.category as string) || 'supply';
      if (!g[key]) g[key] = [];
      g[key].push(it);
    }
    return g;
  }, [siteItems]);

  const [activeCat, setActiveCat] = useState<'consumables' | 'supply' | 'equipment'>('consumables');

  // Helpers to manage numeric inputs
  const parseNum = (v: string) => {
    if (v === '') return NaN;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('supplies for')}: {siteName || t('unknown site')}</h1>
        <button
          className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => navigate(-1)}
        >
          {t('back')}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-300 text-red-800 rounded">
          {error}
        </div>
      )}

      {items === null && !error && (
        <div className="text-gray-600">{t('loading supplies')}</div>
      )}

      {items && siteItems.length === 0 && !error && (
        <div className="p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded">{t('no supplies found')}</div>
      )}

      {siteItems.length > 0 && (
        <>
          <div className="flex gap-2 mb-2">
            {(['consumables','supply','equipment'] as const).map((k) => (
              <button
                key={k}
                onClick={() => setActiveCat(k)}
                className={`px-3 py-1 rounded border ${activeCat === k ? 'bg-blue-600 text-white' : 'bg-white'}`}
              >
                {k === 'consumables' ? t('consumables') : k === 'supply' ? t('supply') : t('equipment')} ({grouped[k]?.length || 0})
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full border border-gray-200 bg-white rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 border-b">{t('item')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('sku')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('on hand')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('order qty')}</th>
                </tr>
              </thead>
              <tbody>
                {(grouped[activeCat] || []).map((row) => (
                  <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-4 py-2 border-b">{row.name}</td>
                    <td className="px-4 py-2 border-b font-mono">{row.sku}</td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border rounded px-2 py-1"
                        value={Number.isFinite(onHand[row.id]) ? onHand[row.id] : ''}
                        onChange={(e) => {
                          const n = parseNum(e.target.value);
                          setOnHand((prev) => ({ ...prev, [row.id]: Number.isNaN(n) ? NaN : n }));
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border rounded px-2 py-1"
                        value={Number.isFinite(orderQty[row.id]) ? orderQty[row.id] : ''}
                        onChange={(e) => {
                          const n = parseNum(e.target.value);
                          setOrderQty((prev) => ({ ...prev, [row.id]: Number.isNaN(n) ? NaN : n }));
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="pt-4">
        <button
          className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:bg-blue-300"
          disabled={submitting}
          onClick={async () => {
            try {
              setSubmitting(true);
              const rows = (items || []).map((it) => ({
                category: (it.category as string) || '',
                name: it.name,
                sku: it.sku,
                on_hand: Number.isFinite(onHand[it.id]) ? onHand[it.id] : '',
                order_qty: Number.isFinite(orderQty[it.id]) ? orderQty[it.id] : '',
              }));

              // Build XLSX workbook in browser (always English headers)
              const header = [
                ['Site', siteName],
                ['Employee', employeeName],
                ['Submitted', new Date().toISOString()],
                [],
              ];
              const tableHeader = [['Category', 'Item', 'SKU', 'On hand', 'Order qty']];
              const ws = XLSX.utils.aoa_to_sheet([
                ...header,
                ...tableHeader,
                ...rows.map((r) => [r.category, r.name, r.sku, r.on_hand, r.order_qty]),
              ]);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Request');
              const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

              // Send email via Supabase Edge Function with Resend
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
              
              if (!supabaseUrl || !supabaseAnonKey) {
                throw new Error('Supabase configuration missing');
              }
              
              const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-supply-request`, {
                method: 'POST',
                headers: { 
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseAnonKey}`
                },
                body: JSON.stringify({
                  siteName,
                  employeeName,
                  items: rows
                }),
              });
              
              if (!emailResponse.ok) {
                const errorText = await emailResponse.text();
                console.error('Edge Function error response:', errorText);
                throw new Error(`Failed to send email: ${emailResponse.status} ${errorText}`);
              }
              
              const emailResult = await emailResponse.json();
              console.log('Email result:', emailResult);

              navigate('/success');
            } catch (e) {
              console.error('Submit failed', e);
              setError('Failed to submit request. Please try again.');
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {submitting ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  );
}