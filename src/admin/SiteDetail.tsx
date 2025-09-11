import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTranslation } from 'react-i18next';
import BulkImportModal from './BulkImportModal';

type Employee = { id: number; full_name: string };
type Item = { id: number; name: string; sku: string | null; category?: 'consumables' | 'supply' | 'equipment'; par?: number | null; ntx?: boolean };
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
  const [showBulkImport, setShowBulkImport] = React.useState(false);
  const [newItemPar, setNewItemPar] = React.useState<string>('');
  
  // PIN management state
  const [showPinManagement, setShowPinManagement] = React.useState(false);
  const [newPin, setNewPin] = React.useState('');
  const [confirmPin, setConfirmPin] = React.useState('');
  const [pinError, setPinError] = React.useState('');
  const [pinLoading, setPinLoading] = React.useState(false);
  const [generatedPin, setGeneratedPin] = React.useState('');
  const [editingItem, setEditingItem] = React.useState<number | null>(null);
  const [editForm, setEditForm] = React.useState<{
    name: string;
    sku: string;
    category: 'consumables' | 'supply' | 'equipment';
    ntx: boolean;
  }>({ name: '', sku: '', category: 'supply', ntx: false });

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ data: s }, { data: empRows }, { data: itemRows }] = await Promise.all([
          supabase.from('app_sites').select('id,name').eq('id', sid).single(),
          supabase.from('app_site_employees').select('app_employees ( id, full_name )').eq('site_id', sid),
          supabase.from('app_site_items').select('app_items ( id, name, sku, category ), par, ntx').eq('site_id', sid),
        ]);
        if (!mounted) return;
        setSite(s as Site);
        setEmployees(((empRows || []) as any[]).map(r => r.app_employees).filter(Boolean));
        // Sort by category order and then by name
        const order: Record<string, number> = { consumables: 0, supply: 1, equipment: 2 };
        const arr = ((itemRows || []) as any[]).map(r => ({ ...r.app_items, par: r.par, ntx: r.ntx })).filter(Boolean) as any[];
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
    const sku = newItemSku.trim() || null; // Allow empty SKU
    const name = newItemName.trim();
    const isSimonPppo = site?.name === 'SIMON-PPPO';
    
    if (!name) return; // Only name is required now
    
    // For SIMON-PPPO site, PAR is optional but must be valid if provided
    const parValue = newItemPar.trim() ? parseInt(newItemPar.trim(), 10) : null;
    if (isSimonPppo && parValue !== null && (isNaN(parValue) || parValue < 0)) {
      setError('PAR must be a valid positive integer when provided');
      return;
    }

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

      // find or create item by SKU+name combination (or name only if no SKU)
      let exists = null;
      if (sku) {
        // For items with SKU, check for exact SKU+name match
        const result = await supabase
          .from('app_items')
          .select('id, category')
          .eq('sku', sku)
          .eq('name', name)
          .maybeSingle();
        exists = result.data;
      } else {
        // For items without SKU, check for exact name match among null-SKU items
        const result = await supabase
          .from('app_items')
          .select('id, category')
          .is('sku', null)
          .eq('name', name)
          .maybeSingle();
        exists = result.data;
      }
      let itemId: number;
      if (exists?.id) {
        itemId = exists.id as number;
        // Update category only (name and SKU are already the same)
        await supabase.from('app_items').update({ 
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

      // Link item to site with image path and PAR
      await supabase.from('app_site_items').upsert({ 
        site_id: sid, 
        item_id: itemId,
        image_path: imagePath,
        par: parValue
      }, { onConflict: 'site_id,item_id', ignoreDuplicates: true });

      setItems(prev => [...prev, { id: itemId, name, sku, category: newItemCategory, par: parValue }]);
      setNewItemName('');
      setNewItemSku('');
      setNewItemCategory('supply');
      setNewItemImage(null);
      setNewItemPar('');
      
    } catch (error: any) {
      setError(error.message || 'Failed to add item');
    } finally {
      setUploadingImage(false);
    }
  }

  function startEdit(item: Item) {
    setEditingItem(item.id);
    setEditForm({
      name: item.name,
      sku: item.sku || '',
      category: item.category || 'supply',
      ntx: item.ntx || false
    });
  }

  function cancelEdit() {
    setEditingItem(null);
    setEditForm({ name: '', sku: '', category: 'supply', ntx: false });
  }

  async function saveEdit(itemId: number) {
    try {
      const { error } = await supabase
        .from('app_items')
        .update({
          name: editForm.name,
          sku: editForm.sku || null,
          category: editForm.category
        })
        .eq('id', itemId);

      if (error) {
        setError(`Failed to update item: ${error.message}`);
        return;
      }

      // Update NTX status in app_site_items
      const { error: ntxError } = await supabase
        .from('app_site_items')
        .update({ ntx: editForm.ntx })
        .eq('site_id', sid)
        .eq('item_id', itemId);

      if (ntxError) {
        setError(`Failed to update NTX status: ${ntxError.message}`);
        return;
      }

      // Update the UI
      setItems(prev => prev.map(i => 
        i.id === itemId 
          ? { ...i, name: editForm.name, sku: editForm.sku || null, category: editForm.category, ntx: editForm.ntx }
          : i
      ));

      setEditingItem(null);
      setEditForm({ name: '', sku: '', category: 'supply', ntx: false });
    } catch (error: any) {
      setError(`Failed to save changes: ${error.message}`);
    }
  }

  async function toggleNtx(itemId: number, currentNtx: boolean) {
    try {
      const { error } = await supabase
        .from('app_site_items')
        .update({ ntx: !currentNtx })
        .eq('site_id', sid)
        .eq('item_id', itemId);
      
      if (error) {
        setError(`Failed to update NTX status: ${error.message}`);
        return;
      }
      
      // Update the UI
      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, ntx: !currentNtx } : i
      ));
    } catch (error: any) {
      setError(`Failed to update NTX status: ${error.message}`);
    }
  }

  async function removeItem(itemId: number) {
    try {
      console.log(`[RemoveItem] Removing item ${itemId} from site ${sid}`);
      
      // Remove the item from this site
      const { error: unlinkError } = await supabase
        .from('app_site_items')
        .delete()
        .eq('site_id', sid)
        .eq('item_id', itemId);
      
      if (unlinkError) {
        console.error('[RemoveItem] Error unlinking item from site:', unlinkError);
        setError(`Failed to remove item: ${unlinkError.message}`);
        return;
      }
      
      console.log(`[RemoveItem] Successfully removed item ${itemId} from site ${sid}`);
      
      // Update the UI
      setItems(prev => prev.filter(i => i.id !== itemId));
      
      // Optional: Check if this item is used by any other sites
      // If not, you might want to delete it completely from app_items
      const { data: otherSites, error: checkError } = await supabase
        .from('app_site_items')
        .select('site_id')
        .eq('item_id', itemId);
        
      if (!checkError && otherSites && otherSites.length === 0) {
        console.log(`[RemoveItem] Item ${itemId} is not used by any other sites, deleting from database`);
        const { error: deleteError } = await supabase
          .from('app_items')
          .delete()
          .eq('id', itemId);
        
        if (deleteError) {
          console.error('[RemoveItem] Error deleting unused item:', deleteError);
          setError(`Item removed from site but failed to delete from database: ${deleteError.message}`);
        } else {
          console.log(`[RemoveItem] Successfully deleted unused item ${itemId} from database`);
        }
      } else if (otherSites && otherSites.length > 0) {
        console.log(`[RemoveItem] Item ${itemId} is still used by ${otherSites.length} other site(s), keeping in database`);
      }
      
    } catch (error: any) {
      console.error('[RemoveItem] Unexpected error:', error);
      setError(`Failed to remove item: ${error.message}`);
    }
  }

  // PIN Management Functions
  const generateRandomPin = async () => {
    setPinLoading(true);
    setPinError('');
    
    try {
      const { data, error } = await supabase.functions.invoke('update-site-pin', {
        body: { siteId: sid, action: 'generate' }
      });
      
      if (error) {
        setPinError('Failed to generate PIN');
        return;
      }
      
      if (data?.success) {
        setGeneratedPin(data.pin);
        setNewPin(data.pin);
        setConfirmPin(data.pin);
        setPinError('');
      } else {
        setPinError(data?.error || 'Failed to generate PIN');
      }
    } catch (error: any) {
      setPinError('Failed to generate PIN');
      console.error('PIN generation error:', error);
    } finally {
      setPinLoading(false);
    }
  };

  const updateSitePin = async () => {
    if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
      setPinError('PIN must be exactly 6 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setPinError('PINs do not match');
      return;
    }

    setPinLoading(true);
    setPinError('');

    try {
      const { data, error } = await supabase.functions.invoke('update-site-pin', {
        body: { siteId: sid, pin: newPin, action: 'update' }
      });

      if (error) {
        setPinError('Failed to update PIN');
        return;
      }

      if (data?.success) {
        setShowPinManagement(false);
        setNewPin('');
        setConfirmPin('');
        setGeneratedPin('');
        // Show success message or update UI
      } else {
        setPinError(data?.error || 'Failed to update PIN');
      }
    } catch (error: any) {
      setPinError('Failed to update PIN');
      console.error('PIN update error:', error);
    } finally {
      setPinLoading(false);
    }
  };

  const closePinManagement = () => {
    setShowPinManagement(false);
    setNewPin('');
    setConfirmPin('');
    setPinError('');
    setGeneratedPin('');
  };

  const handlePinInput = (value: string, isConfirm: boolean = false) => {
    const digitsOnly = value.replace(/\D/g, '').slice(0, 6);
    if (isConfirm) {
      setConfirmPin(digitsOnly);
    } else {
      setNewPin(digitsOnly);
    }
    setPinError('');
  };

  async function deleteSite() {
    await supabase.from('app_sites').delete().eq('id', sid);
    navigate('/admin');
  }

  const handleBulkImport = async (importRows: any[], imageFiles: any[]) => {
    setError('');
    
    try {
      const itemIdMap = new Map<string, number>();
      let processedCount = 0;
      let createdCount = 0;
      let updatedCount = 0;
      
      console.log(`[BulkImport] Starting import of ${importRows.length} items`);
      
      // First, process all items
      for (const row of importRows) {
        const { itemSku: sku, itemName: name, type, par } = row;
        
        // Normalize type to match our schema
        let category: 'consumables' | 'supply' | 'equipment';
        if (type === 'consumable') category = 'consumables';
        else if (type === 'equipment') category = 'equipment';
        else category = 'supply';
        
        // Find or create item by SKU+name combination (or name only if no SKU)
        let exists = null;
        if (sku) {
          // For items with SKU, check for exact SKU+name match
          const result = await supabase
            .from('app_items')
            .select('id')
            .eq('sku', sku)
            .eq('name', name)
            .maybeSingle();
          exists = result.data;
        } else {
          // For items without SKU, check for exact name match among null-SKU items
          const result = await supabase
            .from('app_items')
            .select('id')
            .is('sku', null)
            .eq('name', name)
            .maybeSingle();
          exists = result.data;
        }
          
        let itemId: number;
        let isUpdate = false;
        if (exists?.id) {
          itemId = exists.id as number;
          isUpdate = true;
          console.log(`[BulkImport] Found existing item with same SKU+name: ${name} (SKU: ${sku || 'none'})`);
          // Update category only (name and SKU are already the same)
          await supabase
            .from('app_items')
            .update({ category })
            .eq('id', itemId);
          updatedCount++;
        } else {
          // For items without SKU, always create new items
          // For items with SKU, try to create but handle duplicates gracefully
          try {
            const { data: created, error: itemErr } = await supabase
              .from('app_items')
              .insert({ name, sku, category })
              .select('id')
              .single();
            if (itemErr) throw itemErr;
            itemId = created!.id as number;
            console.log(`[BulkImport] Created new item: ${name} (SKU: ${sku || 'none'})`);
            createdCount++;
          } catch (error: any) {
            if (error.message?.includes('app_items_sku_name_unique_partial') || 
                error.message?.includes('app_items_name_unique_partial')) {
              // SKU+name combination already exists, find the existing item
              let existingItem = null;
              if (sku) {
                const result = await supabase
                  .from('app_items')
                  .select('id')
                  .eq('sku', sku)
                  .eq('name', name)
                  .single();
                existingItem = result.data;
              } else {
                const result = await supabase
                  .from('app_items')
                  .select('id')
                  .is('sku', null)
                  .eq('name', name)
                  .single();
                existingItem = result.data;
              }
              
              if (existingItem) {
                itemId = existingItem.id as number;
                console.log(`[BulkImport] Found duplicate SKU+name combo, using existing item: ${name} (SKU: ${sku || 'none'})`);
                // Update category only
                await supabase
                  .from('app_items')
                  .update({ category })
                  .eq('id', itemId);
                updatedCount++;
              } else {
                throw error;
              }
            } else {
              throw error;
            }
          }
        }
        
        if (sku) {
          itemIdMap.set(sku.toLowerCase(), itemId);
        }
        
        // Link item to site with PAR value
        const { error: linkError } = await supabase
          .from('app_site_items')
          .upsert({ 
            site_id: sid, 
            item_id: itemId,
            par: par
          }, { onConflict: 'site_id,item_id', ignoreDuplicates: true });
        
        if (linkError) {
          console.error(`[BulkImport] Error linking item to site: ${name}`, linkError);
          throw linkError;
        }
        
        processedCount++;
        console.log(`[BulkImport] Processed ${processedCount}/${importRows.length}: ${name}`);
      }
      
      // Then, process images
      for (const imageFile of imageFiles) {
        try {
          const itemId = itemIdMap.get(imageFile.sku.toLowerCase());
          if (!itemId) continue;
          
          // Upload image to Supabase Storage
          const fileName = `${imageFile.sku}_${Date.now()}.${imageFile.file.name.split('.').pop()}`;
          const filePath = `uploads/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('item-images')
            .upload(filePath, imageFile.file, {
              upsert: true,
              contentType: imageFile.file.type
            });
          
          if (uploadError) {
            console.error(`Failed to upload image for ${imageFile.sku}:`, uploadError);
            continue;
          }
          
          // Update the site_items record with image path
          await supabase
            .from('app_site_items')
            .update({ image_path: `item-images/${filePath}` })
            .eq('site_id', sid)
            .eq('item_id', itemId);
            
        } catch (error) {
          console.error(`Error processing image ${imageFile.file.name}:`, error);
        }
      }
      
      // Refresh items list
      const { data: itemRows } = await supabase
        .from('app_site_items')
        .select('app_items ( id, name, sku, category ), par, ntx')
        .eq('site_id', sid);
        
      const order: Record<string, number> = { consumables: 0, supply: 1, equipment: 2 };
      const arr = ((itemRows || []) as any[]).map(r => ({ ...r.app_items, par: r.par, ntx: r.ntx })).filter(Boolean) as any[];
      arr.sort((a, b) => {
        const ca = order[String(a.category || 'supply')];
        const cb = order[String(b.category || 'supply')];
        if (ca !== cb) return ca - cb;
        return String(a.name || '').localeCompare(String(b.name || ''));
      });
      setItems(arr);
      
      console.log(`[BulkImport] Import completed successfully!`);
      console.log(`- Total processed: ${processedCount}`);
      console.log(`- New items created: ${createdCount}`);
      console.log(`- Existing items updated: ${updatedCount}`);
      console.log(`- Images processed: ${imageFiles.length}`);
      
    } catch (error: any) {
      console.error(`[BulkImport] Import failed:`, error);
      setError(`Bulk import failed: ${error.message}`);
      throw error;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Link to="/admin" className="text-blue-700">← {t('back')}</Link>
          <h2 className="text-xl font-semibold">{site?.name || t('site')}</h2>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowBulkImport(true)}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
          >
            📋 {t('bulk import')}
          </button>
          <button 
            onClick={() => setShowPinManagement(true)}
            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔐 Manage PIN
          </button>
          <button onClick={deleteSite} className="px-3 py-1 border rounded text-red-700">{t('delete site')}</button>
        </div>
      </div>
      {loading && <div className="p-3">{t('loading')}</div>}
      {error && <div className="text-red-600">{error}</div>}

      {/* Employees */}
      <section className="space-y-3 bg-white border rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t('employees')}</h3>
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border">{employees.length}</span>
        </div>
        <div className="flex gap-2">
          <input
            className="border p-2 rounded flex-1"
            placeholder={t('new employee name')}
            value={newEmployee}
            onChange={e=>setNewEmployee(e.target.value)}
          />
          <button onClick={addEmployee} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">{t('add')}</button>
        </div>
        <ul className="divide-y rounded-lg border">
          {employees.map(e => (
            <li key={e.id} className="p-2 flex items-center justify-between hover:bg-gray-50">
              <div>{e.full_name}</div>
              <button onClick={()=>removeEmployee(e.id)} className="px-2 py-1 border rounded">{t('remove')}</button>
            </li>
          ))}
          {employees.length === 0 && <li className="p-2 text-gray-500">{t('no employees')}</li>}
        </ul>
      </section>

      {/* Supplies */}
      <section className="space-y-4 bg-white border rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">{t('supplies')}</h3>
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700 border">{items.length}</span>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-lg border">
            <div className={`grid gap-2 ${site?.name === 'SIMON-PPPO' ? 'grid-cols-13' : 'grid-cols-12'}`}>
              <input
                className="col-span-4 border p-2 rounded bg-white"
                placeholder={t('supply name')}
                value={newItemName}
                onChange={e=>setNewItemName(e.target.value)}
              />
              <input
                className={`border p-2 rounded bg-white ${site?.name === 'SIMON-PPPO' ? 'col-span-2' : 'col-span-3'}`}
                placeholder="SKU"
                value={newItemSku}
                onChange={e=>setNewItemSku(e.target.value)}
              />
              {site?.name === 'SIMON-PPPO' && (
                <input
                  className="col-span-2 border p-2 rounded bg-white"
                  placeholder="PAR (optional)"
                  type="number"
                  min="0"
                  value={newItemPar}
                  onChange={e=>setNewItemPar(e.target.value)}
                />
              )}
              <select
                className={`border p-2 rounded bg-white ${site?.name === 'SIMON-PPPO' ? 'col-span-3' : 'col-span-3'}`}
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
                className="col-span-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {uploadingImage ? t('uploading') : t('add')}
              </button>
            </div>
            
            {/* Image Upload */}
            <div className="space-y-2 mt-3">
              <h4 className="text-sm font-medium text-gray-700">📸 Upload Image (Optional)</h4>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewItemImage(e.target.files?.[0] || null)}
                  className="flex-1 border p-2 rounded text-sm bg-white"
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
        </div>
        <div className="overflow-hidden border rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t('item name')}</th>
                <th className="px-4 py-2 text-left font-medium">SKU</th>
                {site?.name === 'SIMON-PPPO' && <th className="px-4 py-2 text-center font-medium">PAR</th>}
                <th className="px-4 py-2 text-left font-medium">{t('type')}</th>
                <th className="px-4 py-2 text-center font-medium">NTX</th>
                <th className="px-4 py-2 text-right font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {editingItem === i.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm"
                      />
                    ) : (
                      i.name
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600 font-mono">
                    {editingItem === i.id ? (
                      <input
                        type="text"
                        value={editForm.sku}
                        onChange={(e) => setEditForm(prev => ({ ...prev, sku: e.target.value }))}
                        className="w-full border rounded px-2 py-1 text-sm font-mono"
                        placeholder="SKU"
                      />
                    ) : (
                      i.sku || '-'
                    )}
                  </td>
                  {site?.name === 'SIMON-PPPO' && (
                    <td className="px-4 py-2 text-center text-gray-600">{i.par ?? '-'}</td>
                  )}
                  <td className="px-4 py-2">
                    {editingItem === i.id ? (
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value as 'consumables' | 'supply' | 'equipment' }))}
                        className="border rounded px-2 py-1 text-sm"
                      >
                        <option value="consumables">{t('consumables')}</option>
                        <option value="supply">{t('supply')}</option>
                        <option value="equipment">{t('equipment')}</option>
                      </select>
                    ) : (
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        (i.category || 'supply') === 'consumables' ? 'bg-rose-100 text-rose-700' :
                        (i.category || 'supply') === 'equipment' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {t(i.category || 'supply')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {editingItem === i.id ? (
                      <button
                        onClick={() => setEditForm(prev => ({ ...prev, ntx: !prev.ntx }))}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          editForm.ntx 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {editForm.ntx ? 'NTX' : 'Tax'}
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleNtx(i.id, i.ntx || false)}
                        className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                          i.ntx 
                            ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {i.ntx ? 'NTX' : 'Tax'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {editingItem === i.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => saveEdit(i.id)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-2 py-1 bg-gray-600 text-white rounded text-xs hover:bg-gray-700"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(i)}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          ✏️
                        </button>
                        <button onClick={()=>removeItem(i.id)} className="px-2 py-1 border rounded text-xs">{t('remove')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={site?.name === 'SIMON-PPPO' ? 6 : 5} className="px-4 py-6 text-center text-gray-500">{t('no supplies found')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        siteName={site?.name}
      />

      {/* PIN Management Modal */}
      {showPinManagement && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">Manage Site PIN</h3>
              <button
                onClick={closePinManagement}
                className="text-gray-400 hover:text-gray-600"
                disabled={pinLoading}
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-sm text-gray-600">
                Set a 6-digit PIN for site: <strong>{site?.name}</strong>
              </div>

              {generatedPin && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-800 mb-1">
                    Generated PIN:
                  </div>
                  <div className="text-xl font-mono text-green-900 tracking-widest">
                    {generatedPin}
                  </div>
                  <div className="text-xs text-green-700 mt-1">
                    Save this PIN securely. It will be required for site access.
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New PIN
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="w-full text-center text-xl font-mono border border-gray-300 rounded-lg p-3 tracking-widest focus:border-blue-500 focus:outline-none"
                    placeholder="••••••"
                    value={newPin}
                    onChange={(e) => handlePinInput(e.target.value)}
                    disabled={pinLoading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm PIN
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    className="w-full text-center text-xl font-mono border border-gray-300 rounded-lg p-3 tracking-widest focus:border-blue-500 focus:outline-none"
                    placeholder="••••••"
                    value={confirmPin}
                    onChange={(e) => handlePinInput(e.target.value, true)}
                    disabled={pinLoading}
                  />
                </div>
              </div>

              {pinError && (
                <div className="text-sm text-red-600 text-center">
                  {pinError}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={generateRandomPin}
                  disabled={pinLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pinLoading ? 'Generating...' : '🎲 Generate Random'}
                </button>
                <button
                  onClick={updateSitePin}
                  disabled={newPin.length !== 6 || confirmPin.length !== 6 || newPin !== confirmPin || pinLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {pinLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Updating...
                    </div>
                  ) : (
                    'Update PIN'
                  )}
                </button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                Employees will need this PIN to access the site and submit requests.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


