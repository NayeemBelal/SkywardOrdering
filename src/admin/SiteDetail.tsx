import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';

type Employee = { id: number; full_name: string };
type Item = { id: number; name: string; sku: string };
type Site = { id: number; name: string };

export default function SiteDetail() {
  const { t } = useTranslation();
  const { siteId } = useParams();
  const navigate = useNavigate();
  const sid = Number(siteId);

  const [site, setSite] = React.useState<Site | null>(null);
  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [items, setItems] = React.useState<Item[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState('');

  const [newEmployee, setNewEmployee] = React.useState('');
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemSku, setNewItemSku] = React.useState('');
  const [newItemCategory, setNewItemCategory] = React.useState<'consumables' | 'supply' | 'equipment'>('supply');
  const [newItemImage, setNewItemImage] = React.useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ data: s }, { data: empRows }, { data: itemRows }] = await Promise.all([
          supabase.from('app_sites').select('id,name').eq('id', sid).single(),
          supabase.from('app_site_employees').select('app_employees ( id, full_name )').eq('site_id', sid),
          supabase.from('app_site_items').select('app_items ( id, name, sku, category )').eq('site_id', sid),
        ]);
        if (!mounted) return;
        setSite(s as Site);
        setEmployees(((empRows || []) as any[]).map(r => r.app_employees).filter(Boolean));
        // Sort by category order and then by name
        const order: Record<string, number> = { consumables: 0, supply: 1, equipment: 2 };
        const arr = ((itemRows || []) as any[]).map(r => r.app_items).filter(Boolean) as any[];
        arr.sort((a, b) => {
          const ca = order[String(a.category || 'supply')];
          const cb = order[String(b.category || 'supply')];
          if (ca !== cb) return ca - cb;
          return String(a.name || '').localeCompare(String(b.name || ''));
        });
        setItems(arr);
      } catch (e: any) {
        setError(e.message || 'Failed to load site');
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [sid]);

  async function addEmployee() {
    setError('');
    const full_name = newEmployee.trim();
    if (!full_name) return;
    // find or create employee
    const { data: existing } = await supabase.from('app_employees').select('id').eq('full_name', full_name).maybeSingle();
    let employeeId: number;
    if (existing?.id) {
      employeeId = existing.id as number;
    } else {
      const { data: created, error } = await supabase
        .from('app_employees')
        .insert({ full_name })
        .select('id')
        .single();
      if (error) { setError(error.message); return; }
      employeeId = created!.id as number;
    }
    await supabase
      .from('app_site_employees')
      .upsert({ site_id: sid, employee_id: employeeId }, { onConflict: 'site_id,employee_id', ignoreDuplicates: true });
    setEmployees(prev => [...prev, { id: employeeId, full_name }]);
    setNewEmployee('');
  }

  async function removeEmployee(employeeId: number) {
    await supabase.from('app_site_employees').delete().eq('site_id', sid).eq('employee_id', employeeId);
    setEmployees(prev => prev.filter(e => e.id !== employeeId));
  }

  async function addItem() {
    setError('');
    const sku = newItemSku.trim();
    const name = newItemName.trim();
    if (!sku || !name) return;

    try {
      setUploadingImage(true);
      let imagePath: string | undefined;

      // Upload image if provided
      if (newItemImage) {
        const fileName = `${sku}_${Date.now()}.${newItemImage.name.split('.').pop()}`;
        const filePath = `uploads/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('item-images')
          .upload(filePath, newItemImage, {
            upsert: true,
            contentType: newItemImage.type
          });
        
        if (uploadError) {
          throw new Error(`Failed to upload image: ${uploadError.message}`);
        }
        
        imagePath = `item-images/${filePath}`;
      }

      // find or create item by SKU
      const { data: exists } = await supabase.from('app_items').select('id, category').eq('sku', sku).maybeSingle();
      let itemId: number;
      if (exists?.id) {
        itemId = exists.id as number;
        // Update name and category if they've changed
        await supabase.from('app_items').update({ 
          name, 
          category: newItemCategory 
        }).eq('id', itemId);
      } else {
        const { data: created, error } = await supabase
          .from('app_items')
          .insert({ name, sku, category: newItemCategory })
          .select('id')
          .single();
        if (error) { setError(error.message); return; }
        itemId = created!.id as number;
      }

      // Link item to site with image path
      await supabase.from('app_site_items').upsert({ 
        site_id: sid, 
        item_id: itemId,
        image_path: imagePath
      }, { onConflict: 'site_id,item_id', ignoreDuplicates: true });

      setItems(prev => [...prev, { id: itemId, name, sku, category: newItemCategory }]);
      setNewItemName('');
      setNewItemSku('');
      setNewItemCategory('supply');
      setNewItemImage(null);
      
    } catch (error: any) {
      setError(error.message || 'Failed to add item');
    } finally {
      setUploadingImage(false);
    }
  }

  async function removeItem(itemId: number) {
    await supabase.from('app_site_items').delete().eq('site_id', sid).eq('item_id', itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  async function deleteSite() {
    await supabase.from('app_sites').delete().eq('id', sid);
    navigate('/admin');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to="/admin" className="text-blue-700">← {t('back')}</Link>
          <h2 className="text-xl font-semibold">{site?.name || t('site')}</h2>
        </div>
        <button onClick={deleteSite} className="px-3 py-1 border rounded text-red-700">{t('delete site')}</button>
      </div>
      {loading && <div className="p-3">{t('loading')}</div>}
      {error && <div className="text-red-600">{error}</div>}

      {/* Employees */}
      <section className="space-y-2">
        <h3 className="font-medium">{t('employees')}</h3>
        <div className="flex gap-2">
          <input
            className="border p-2 rounded flex-1"
            placeholder={t('new employee name')}
            value={newEmployee}
            onChange={e=>setNewEmployee(e.target.value)}
          />
          <button onClick={addEmployee} className="px-3 py-1 border rounded">{t('add')}</button>
        </div>
        <ul className="divide-y border rounded">
          {employees.map(e => (
            <li key={e.id} className="p-2 flex items-center justify-between">
              <div>{e.full_name}</div>
              <button onClick={()=>removeEmployee(e.id)} className="px-2 py-1 border rounded">{t('remove')}</button>
            </li>
          ))}
          {employees.length === 0 && <li className="p-2 text-gray-500">{t('no employees')}</li>}
        </ul>
      </section>

      {/* Supplies */}
      <section className="space-y-2">
        <h3 className="font-medium">{t('supplies')}</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <input
              className="col-span-4 border p-2 rounded"
              placeholder={t('supply name')}
              value={newItemName}
              onChange={e=>setNewItemName(e.target.value)}
            />
            <input
              className="col-span-3 border p-2 rounded"
              placeholder="SKU"
              value={newItemSku}
              onChange={e=>setNewItemSku(e.target.value)}
            />
            <select
              className="col-span-3 border p-2 rounded"
              value={newItemCategory}
              onChange={e=>setNewItemCategory(e.target.value as 'consumables' | 'supply' | 'equipment')}
            >
              <option value="consumables">{t('consumables')}</option>
              <option value="supply">{t('supply')}</option>
              <option value="equipment">{t('equipment')}</option>
            </select>
            <button 
              onClick={addItem} 
              disabled={uploadingImage}
              className="col-span-2 px-3 py-1 border rounded disabled:opacity-50"
            >
              {uploadingImage ? t('uploading') : t('add')}
            </button>
          </div>
          
          {/* Image Upload */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">📸 Upload Image (Optional)</h4>
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setNewItemImage(e.target.files?.[0] || null)}
                className="flex-1 border p-2 rounded text-sm"
              />
              {newItemImage && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{newItemImage.name}</span>
                  <button
                    onClick={() => setNewItemImage(null)}
                    className="px-2 py-1 text-red-600 text-sm border border-red-300 rounded hover:bg-red-50"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <ul className="divide-y border rounded">
          {items.map(i => (
            <li key={i.id} className="p-2 grid grid-cols-12 gap-2 items-center">
              <div className="col-span-6">{i.name}</div>
              <div className="col-span-4 text-gray-600">{i.sku}</div>
              <div className="col-span-2 text-right">
                <button onClick={()=>removeItem(i.id)} className="px-2 py-1 border rounded">{t('remove')}</button>
              </div>
            </li>
          ))}
          {items.length === 0 && <li className="p-2 text-gray-500">{t('no supplies found')}</li>}
        </ul>
      </section>
    </div>
  );
}


