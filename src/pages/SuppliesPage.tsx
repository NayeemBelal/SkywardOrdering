import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';

interface CustomRequest {
  id: string;
  name: string;
  onHand: number | '';
  orderQty: number | '';
}

interface Item { 
  id: number; 
  name: string; 
  sku: string; 
  category?: string; 
  image_path?: string; 
}

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
  const [customRequests, setCustomRequests] = useState<CustomRequest[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const { t } = useTranslation();

  useEffect(() => {
    if (!siteId) return;
    console.log('[SuppliesPage] Loading items for site', siteId);
    // Load items for the selected site from Supabase via app_site_items join
    supabase
      .from('app_site_items')
      .select('app_items ( id, name, sku, category ), image_path')
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
        const list: Item[] = rows.map((row) => ({
          ...row.app_items,
          image_path: row.image_path
        })).filter(Boolean);
        console.log('[SuppliesPage] Items derived', list.length, list.slice(0,5));
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

  // Helper to get image URL
  const getImageUrl = (imagePath?: string) => {
    if (!imagePath) {
      // Return placeholder image URL
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      return `${supabaseUrl}/storage/v1/object/public/item-images/placeholders/img-placeholder.jpeg`;
    }
    
    // Return actual image URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/storage/v1/object/public/${imagePath}`;
  };

  // Custom request handlers
  const addCustomRequest = () => {
    const newRequest: CustomRequest = {
      id: Date.now().toString(),
      name: '',
      onHand: '',
      orderQty: ''
    };
    setCustomRequests(prev => [...prev, newRequest]);
  };

  const removeCustomRequest = (id: string) => {
    setCustomRequests(prev => prev.filter(req => req.id !== id));
  };

  const updateCustomRequest = (id: string, field: keyof CustomRequest, value: string | number) => {
    setCustomRequests(prev => prev.map(req => 
      req.id === id ? { ...req, [field]: value } : req
    ));
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
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full border border-gray-200 bg-white rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 border-b">{t('image')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('item')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('sku')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('on hand')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('order qty')}</th>
                </tr>
              </thead>
              <tbody>
                {(grouped[activeCat] || []).map((row) => (
                  <tr key={row.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-4 py-2 border-b">
                      <img 
                        src={getImageUrl(row.image_path)} 
                        alt={row.name}
                        className="w-16 h-16 object-cover rounded border"
                        onError={(e) => {
                          // Fallback to placeholder if image fails to load
                          const target = e.target as HTMLImageElement;
                          target.src = getImageUrl();
                        }}
                      />
                    </td>
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

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {(grouped[activeCat] || []).map((row) => (
              <div key={row.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                {/* Image */}
                <div className="flex justify-center">
                  <img 
                    src={getImageUrl(row.image_path)} 
                    alt={row.name}
                    className="w-20 h-20 object-cover rounded border"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.src = getImageUrl();
                    }}
                  />
                </div>
                
                {/* Item Name */}
                <div className="text-center">
                  <h3 className="font-medium text-gray-900">{row.name}</h3>
                  <p className="text-sm text-gray-500 font-mono">{row.sku}</p>
                </div>
                
                {/* Input Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('on hand')}:
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-center"
                      placeholder="0"
                      value={Number.isFinite(onHand[row.id]) ? onHand[row.id] : ''}
                      onChange={(e) => {
                        const n = parseNum(e.target.value);
                        setOnHand((prev) => ({ ...prev, [row.id]: Number.isNaN(n) ? NaN : n }));
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('order qty')}:
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-center"
                      placeholder="0"
                      value={Number.isFinite(orderQty[row.id]) ? orderQty[row.id] : ''}
                      onChange={(e) => {
                        const n = parseNum(e.target.value);
                        setOrderQty((prev) => ({ ...prev, [row.id]: Number.isNaN(n) ? NaN : n }));
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Custom Requests Section */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t('custom requests')}</h2>
          <button
            onClick={addCustomRequest}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('add custom')}
          </button>
        </div>

        {customRequests.length === 0 && (
          <p className="text-gray-500 text-center py-4">{t('no custom requests')}</p>
        )}

        {/* Desktop Custom Requests Table */}
        {customRequests.length > 0 && (
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full border border-gray-200 bg-white rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 border-b">{t('item name')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('on hand')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('order qty')}</th>
                  <th className="text-left px-4 py-2 border-b">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {customRequests.map((req) => (
                  <tr key={req.id} className="odd:bg-white even:bg-gray-50">
                    <td className="px-4 py-2 border-b">
                      <input
                        type="text"
                        placeholder={t('enter item name')}
                        className="w-full border rounded px-2 py-1"
                        value={req.name}
                        onChange={(e) => updateCustomRequest(req.id, 'name', e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border rounded px-2 py-1"
                        value={req.onHand}
                        onChange={(e) => {
                          const n = parseNum(e.target.value);
                          updateCustomRequest(req.id, 'onHand', Number.isNaN(n) ? '' : n);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 border-b">
                      <input
                        type="number"
                        min={0}
                        className="w-24 border rounded px-2 py-1"
                        value={req.orderQty}
                        onChange={(e) => {
                          const n = parseNum(e.target.value);
                          updateCustomRequest(req.id, 'orderQty', Number.isNaN(n) ? '' : n);
                        }}
                      />
                    </td>
                    <td className="px-4 py-2 border-b">
                      <button
                        onClick={() => removeCustomRequest(req.id)}
                        className="p-1 text-red-600 hover:text-red-800 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Mobile Custom Requests Cards */}
        {customRequests.length > 0 && (
          <div className="md:hidden space-y-4">
            {customRequests.map((req) => (
              <div key={req.id} className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium text-gray-900">{t('custom item')}</h3>
                  <button
                    onClick={() => removeCustomRequest(req.id)}
                    className="p-1 text-red-600 hover:text-red-800 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {t('item name')}:
                  </label>
                  <input
                    type="text"
                    placeholder={t('enter item name')}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    value={req.name}
                    onChange={(e) => updateCustomRequest(req.id, 'name', e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('on hand')}:
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-center"
                      placeholder="0"
                      value={req.onHand}
                      onChange={(e) => {
                        const n = parseNum(e.target.value);
                        updateCustomRequest(req.id, 'onHand', Number.isNaN(n) ? '' : n);
                      }}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t('order qty')}:
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-center"
                      placeholder="0"
                      value={req.orderQty}
                      onChange={(e) => {
                        const n = parseNum(e.target.value);
                        updateCustomRequest(req.id, 'orderQty', Number.isNaN(n) ? '' : n);
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

              // Add custom requests to rows
              const customRows = customRequests
                .filter(req => req.name.trim()) // Only include requests with names
                .map(req => ({
                  category: 'Custom Orders',
                  name: req.name.trim(),
                  sku: 'CUSTOM',
                  on_hand: typeof req.onHand === 'number' ? req.onHand : '',
                  order_qty: typeof req.orderQty === 'number' ? req.orderQty : '',
                }));

              const allRows = [...rows, ...customRows];

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
                ...allRows.map((r) => [r.category, r.name, r.sku, r.on_hand, r.order_qty]),
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
                  items: allRows
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