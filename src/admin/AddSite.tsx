import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  
  // PIN management state
  const [pin, setPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [pinError, setPinError] = React.useState('');

  const addSupplyRow = () => setSupplies(prev => [...prev, { name: '', sku: '', category: 'supply' }]);
  const updateSupply = (idx: number, field: 'name' | 'sku' | 'category' | 'image', value: string | File | null) => {
    setSupplies(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };
  const removeSupply = (idx: number) => setSupplies(prev => prev.filter((_, i) => i !== idx));

  // PIN helper functions
  const generateRandomPin = () => {
    const WEAK_PINS = [
      '000000', '111111', '222222', '333333', '444444', '555555',
      '666666', '777777', '888888', '999999', '123456', '654321',
      '012345', '543210', '123123', '456456', '789789'
    ];
    
    let newPin: string;
    do {
      newPin = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    } while (WEAK_PINS.includes(newPin));
    
    setPin(newPin);
    setConfirmPin(newPin);
    setPinError('');
  };

  const handlePinInput = (value: string, isConfirm: boolean = false) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    if (isConfirm) {
      setConfirmPin(digitsOnly);
    } else {
      setPin(digitsOnly);
    }
    setPinError('');
  };

  const validatePin = (): boolean => {
    if (!pin || pin.length !== 6) {
      setPinError('PIN must be exactly 6 digits');
      return false;
    }
    if (pin !== confirmPin) {
      setPinError('PINs do not match');
      return false;
    }
    return true;
  };

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
    
    // Validate PIN first
    if (!validatePin()) {
      return;
    }
    
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
        // Update existing site's PIN
        const { data: pinResult, error: pinError } = await supabase.functions.invoke('update-site-pin', {
          body: { siteId, pin, action: 'update' }
        });
        if (pinError || !pinResult?.success) {
          throw new Error(pinResult?.error || 'Failed to set PIN for existing site');
        }
      } else {
        // Create new site with default PIN first
        const { data: site, error: siteErr } = await supabase
          .from('app_sites')
          .insert({ name: desiredName, pin_hash: 'default_000000' })
          .select('id')
          .single();
        if (siteErr) throw siteErr;
        siteId = site!.id as number;
        
        // Set the actual PIN using the Edge Function
        const { data: pinResult, error: pinError } = await supabase.functions.invoke('update-site-pin', {
          body: { siteId, pin, action: 'update' }
        });
        if (pinError || !pinResult?.success) {
          throw new Error(pinResult?.error || 'Failed to set PIN for new site');
        }
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
    <div className="min-h-screen bg-gray-50">
      {/* Full-width Navigation Bar */}
      <div className="bg-white shadow-sm border-b">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                to="/admin" 
                className="inline-flex items-center justify-center w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all duration-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-light text-gray-900">{t('add site')}</h1>
                <p className="mt-1 text-sm text-gray-500">Create a new site with employees and supplies</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={onSubmit} className="space-y-6 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {error && <div className="text-red-600 bg-red-50 border border-red-200 rounded-lg p-4">{error}</div>}
      <div>
        <label className="block text-sm font-medium mb-1">{t('site name')}</label>
        <input value={name} onChange={e=>setName(e.target.value)} className="w-full border p-2 rounded" placeholder="e.g. Main Campus" required />
      </div>
      
      {/* Site PIN Section */}
      <div className="space-y-3 p-4 border border-blue-200 rounded-lg bg-blue-50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-blue-900">🔐 Site PIN (Required)</h3>
          <button
            type="button"
            onClick={generateRandomPin}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
          >
            🎲 Generate Random
          </button>
        </div>
        <p className="text-xs text-blue-700">
          This PIN will be required for employees to access this site and submit requests.
        </p>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">PIN</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="w-full text-center text-lg font-mono border border-blue-300 rounded p-2 tracking-widest focus:border-blue-500 focus:outline-none"
              placeholder="••••••"
              value={pin}
              onChange={(e) => handlePinInput(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-blue-900 mb-1">Confirm PIN</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="w-full text-center text-lg font-mono border border-blue-300 rounded p-2 tracking-widest focus:border-blue-500 focus:outline-none"
              placeholder="••••••"
              value={confirmPin}
              onChange={(e) => handlePinInput(e.target.value, true)}
              required
            />
          </div>
        </div>
        
        {pinError && (
          <div className="text-sm text-red-600">
            {pinError}
          </div>
        )}
        
        {pin && confirmPin && pin === confirmPin && pin.length === 6 && (
          <div className="text-sm text-green-600">
            ✅ PIN is valid and ready to use
          </div>
        )}
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
      </div>
    </div>
  );
}


