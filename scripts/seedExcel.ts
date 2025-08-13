import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

(async () => {
  let siteCount=0, itemCount=0, empCount=0;
  const supply = readFileSync('Supply List as of 7_31_25.xlsx');
  for (const sheetName of supply.SheetNames) {
    const rows = utils.sheet_to_json<string[]>(supply.Sheets[sheetName], { header:1 });
    const headerIdx = rows.findIndex(r => r[0] === 'ITEM');
    const data = rows.slice(headerIdx+1).filter(r=>r[0]);
    const { data: site } = await supabase.from('sites').upsert({ name: sheetName }).select().single();
    siteCount++;
    for (const row of data) {
      const [name, sku] = row;
      const { data: item } = await supabase.from('items').upsert({ name_es:name, name_en:name, sku }).select().single();
      itemCount++;
      await supabase.from('site_items').upsert({ site_id: site.id, item_id: item.id });
    }
  }
  const staff = readFileSync('Job Site Staff.xlsx');
  const staffRows = utils.sheet_to_json<string[]>(staff.Sheets[staff.SheetNames[0]], { header:1 });
  for (const r of staffRows) {
    const cell = r[0];
    if (!cell) continue;
    const [full, siteName] = cell.split(' - ');
    const { data: site } = await supabase.from('sites').upsert({ name: siteName }).select().single();
    const { data: emp } = await supabase.from('employees').upsert({ full_name: full }).select().single();
    empCount++;
    await supabase.from('site_employees').upsert({ site_id: site.id, employee_id: emp.id });
  }
  console.log(`✔ Imported ${siteCount} sites, ${itemCount} items, ${empCount} employees`);
})();
