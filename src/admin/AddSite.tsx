import React from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import BulkImportModal from './BulkImportModal';

export default function AddSite() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = React.useState('');
  const [employeesText, setEmployeesText] = React.useState('');
  const [supplies, setSupplies] = React.useState<Array<{ name: string; sku: string; category: 'consumables' | 'supply' | 'equipment'; image?: File }>>([
    { name: '', sku: '', category: 'supply' },
  ]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const [showBulkImport, setShowBulkImport] = React.useState(false);

  const addSupplyRow = () => setSupplies(prev => [...prev, { name: '', sku: '', category: 'supply' }]);
  const updateSupply = (idx: number, field: 'name' | 'sku' | 'category' | 'image', value: string | File | null) => {
    setSupplies(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const removeSupply = (idx: number) => setSupplies(prev => prev.filter((_, i) => i !== idx));

  const handleBulkImport = async (importRows: any[], imageFiles: any[]) => {
    setError('');
    
    try {
      // Convert import rows to supply format
      const newSupplies = importRows.map(row => {
        let category: 'consumables' | 'supply' | 'equipment';
        if (row.type === 'consumable') category = 'consumables';
        else if (row.type === 'equipment') category = 'equipment';
        else category = 'supply';
        
        // Find matching image file for this SKU
        const matchingImage = imageFiles.find(img => 
          img.sku.toLowerCase() === row.itemSku.toLowerCase()
        );
        
        return {
          name: row.itemName,
          sku: row.itemSku,
          category,
          image: matchingImage?.file
        };
      });
      
      // Replace existing supplies with imported ones
      setSupplies(newSupplies);
      
    } catch (error: any) {
      setError(`Bulk import failed: ${error.message}`);
      throw error;
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      // 1) Create site (dedupe by normalized name)
      const desiredName = name.trim();
      const { data: existing } = await supabase
        .from('app_sites')
        .select('id,name')
        .ilike('name', desiredName)
        .maybeSingle();
      let siteId: number;
      if (existing?.id && String(existing.name).trim().toLowerCase() === desiredName.toLowerCase()) {
        siteId = existing.id as number;
      } else {
        const { data: site, error: siteErr } = await supabase
          .from('app_sites')
          .insert({ name: desiredName })
          .select('id')
          .single();
        if (siteErr) throw siteErr;
        siteId = site!.id as number;
      }

      const siteIdFinal = siteId;

      // 2) Upsert employees from textarea (one per line)
      const employeeNames = employeesText
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean);
      for (const full_name of employeeNames) {
        const { data: existing } = await supabase
          .from('app_employees')
          .select('id')
          .eq('full_name', full_name)
          .maybeSingle();
        let employeeId: number;
        if (existing?.id) {
          employeeId = existing.id as number;
        } else {
          const { data: created, error: empErr } = await supabase
            .from('app_employees')
            .insert({ full_name })
            .select('id')
            .single();
          if (empErr) throw empErr;
          employeeId = created!.id as number;
        }
        await supabase
          .from('app_site_employees')
          .upsert({ site_id: siteIdFinal, employee_id: employeeId }, { onConflict: 'site_id,employee_id', ignoreDuplicates: true });
      }

      // 3) Upsert supplies: items + link to site
      for (const row of supplies) {
        const sku = row.sku.trim();
        const name = row.name.trim();
        if (!sku || !name) continue;
        
        let imagePath: string | undefined;
        
        // Upload image if provided
        if (row.image) {
          const fileName = `${sku}_${Date.now()}.${row.image.name.split('.').pop()}`;
          const filePath = `uploads/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('item-images')
            .upload(filePath, row.image, {
              upsert: true,
              contentType: row.image.type
            });
          
          if (uploadError) {
            throw new Error(`Failed to upload image for ${sku}: ${uploadError.message}`);
          }
          
          imagePath = `item-images/${filePath}`;
        }
        
        // find or create item by sku
        const { data: exists } = await supabase
          .from('app_items')
          .select('id, name, sku, category')
          .eq('sku', sku)
          .maybeSingle();
        let itemId: number;
        let category: 'consumables' | 'supply' | 'equipment' | undefined = exists?.category as any;
        if (!category) {
          // Heuristic category assignment based on name/sku
          const text = `${name} ${sku}`.toLowerCase();
          if (/(vacuum|machine|auto\s?-?scrubber|burnisher|buffer|extractor|polisher|propane|battery|dispenser|bucket|cart|handle|frame)/.test(text)) {
            category = 'equipment';
          } else if (/(towel|tissue|toilet|bath|liner|bag|soap|sanitiz|wipe|napkin|roll|pad|refill|chemical|degreaser|glass|cleaner|disinfect|urinal|odor|fragrance|can liner|trash bag)/.test(text)) {
            category = 'consumables';
          } else if (/(mop|broom|brush|duster|dust\s?pan|dustpan|squeegee|spray\s?bottle|bottle\b|caddy|holder|sign|wet\s?floor|cone\b|gloves?|goggles?|mask\b|scraper|sponges?|mitt|microfiber|cloth|rag|handle\b|frame\b|pad\s?holder|bucket\b|cart\b|wringer)/.test(text)) {
            category = 'supply';
          } else {
            category = 'supply';
          }
        }
        if (exists?.id) {
          itemId = exists.id as number;
          // ensure name and category up to date
          await supabase.from('app_items').update({ name: name, category }).eq('id', itemId);
        } else {
          const { data: created, error: itemErr } = await supabase
            .from('app_items')
            .insert({ name: name, sku, category })
            .select('id')
            .single();
          if (itemErr) throw itemErr;
          itemId = created!.id as number;
        }
        await supabase
          .from('app_site_items')
          .upsert({ 
            site_id: siteIdFinal, 
            item_id: itemId,
            image_path: imagePath
          }, { onConflict: 'site_id,item_id', ignoreDuplicates: true });
      }

      navigate(`/admin/sites/${siteIdFinal}`);
    } catch (e: any) {
      setError(e.message || 'Failed to add site');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-xl font-semibold">{t('add site')}</h2>
      {error && <div className="text-red-600">{error}</div>}
      <div>
        <label className="block text-sm font-medium mb-1">{t('site name')}</label>
        <input value={name} onChange={e=>setName(e.target.value)} className="w-full border p-2 rounded" placeholder="e.g. Main Campus" required />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">{t('employees one per line')}</label>
        <textarea value={employeesText} onChange={e=>setEmployeesText(e.target.value)} className="w-full border p-2 rounded h-32" placeholder="Jane Doe\nJohn Smith" />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t('site supplies')}</label>
          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={() => setShowBulkImport(true)}
              className="px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
            >
              📋 {t('bulk import')}
            </button>
            <button type="button" onClick={addSupplyRow} className="px-2 py-1 border rounded">{t('add row')}</button>
          </div>
        </div>
        {supplies.map((row, idx) => (
          <div key={idx} className="space-y-3 p-4 border border-gray-200 rounded-lg">
            <div className="grid grid-cols-12 gap-2">
              <input
                className="col-span-5 border p-2 rounded"
                placeholder={t('supply name')}
                value={row.name}
                onChange={e=>updateSupply(idx, 'name', e.target.value)}
              />
              <input
                className="col-span-3 border p-2 rounded"
                placeholder="SKU"
                value={row.sku}
                onChange={e=>updateSupply(idx, 'sku', e.target.value)}
              />
              <select
                className="col-span-2 border p-2 rounded"
                value={row.category}
                onChange={e=>updateSupply(idx, 'category', e.target.value as 'consumables' | 'supply' | 'equipment')}
              >
                <option value="consumables">{t('consumables')}</option>
                <option value="supply">{t('supply')}</option>
                <option value="equipment">{t('equipment')}</option>
              </select>
              <button type="button" onClick={()=>removeSupply(idx)} className="col-span-2 px-2 py-1 border rounded text-red-600 hover:bg-red-50">{t('remove')}</button>
            </div>
            
            {/* Image Upload for this row */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">📸 Upload Image (Optional)</h4>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                                        onChange={(e) => updateSupply(idx, 'image', e.target.files?.[0] || null)}
                  className="flex-1 border p-2 rounded text-sm"
                />
                {row.image && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">{row.image.name}</span>
                    <button
                      type="button"
                      onClick={() => updateSupply(idx, 'image', null)}
                      className="px-2 py-1 text-red-600 text-sm border border-red-300 rounded hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-blue-300">
          {saving ? t('saving') : t('save site')}
        </button>
      </div>

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        siteName={name.trim() || undefined}
      />
    </form>
  );
}


