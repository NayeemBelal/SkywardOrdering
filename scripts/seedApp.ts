import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

type StaticSiteEmployees = { site: string; employees: string[] }[];
type SupplyRow = { item_number: string; supply: string };
type SiteSuppliesEntry = { site: string; supplies: SupplyRow[] };

const SUPABASE_URL = process.env.SUPABASE_URL as string;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

async function upsertSite(name: string): Promise<number> {
  const { data } = await supabase
    .from('app_sites')
    .insert({ name })
    .select('id')
    .single()
    .throwOnError();
  return data.id as number;
}

async function getOrCreateSiteId(cache: Map<string, number>, name: string) {
  const key = normalize(name);
  if (cache.has(key)) return cache.get(key)!;
  // Try find by name (non-unique, pick first)
  const { data: found, error } = await supabase
    .from('app_sites')
    .select('id, name')
    .eq('name', name)
    .limit(1);
  if (error) throw error;
  let id: number;
  if (found && found.length > 0) {
    id = found[0].id;
  } else {
    id = await upsertSite(name);
  }
  cache.set(key, id);
  return id;
}

async function getOrCreateEmployeeId(cache: Map<string, number>, fullName: string) {
  const key = fullName;
  if (cache.has(key)) return cache.get(key)!;
  // Try find existing by full_name (duplicates allowed globally, but prefer reusing first)
  const { data: found, error: findErr } = await supabase
    .from('app_employees')
    .select('id')
    .eq('full_name', fullName)
    .limit(1);
  if (findErr) throw findErr;
  if (found && found.length > 0) {
    cache.set(key, found[0].id as number);
    return found[0].id as number;
  }
  const { data } = await supabase
    .from('app_employees')
    .insert({ full_name: fullName })
    .select('id')
    .single()
    .throwOnError();
  cache.set(key, data.id as number);
  return data.id as number;
}

async function linkSiteEmployee(siteId: number, employeeId: number) {
  await supabase
    .from('app_site_employees')
    .upsert({ site_id: siteId, employee_id: employeeId }, { onConflict: 'site_id,employee_id', ignoreDuplicates: true })
    .throwOnError();
}

async function getOrCreateItemIdBySku(cache: Map<string, number>, sku: string, name: string) {
  const key = sku;
  if (cache.has(key)) return cache.get(key)!;
  // try by sku
  const { data: exists } = await supabase
    .from('app_items')
    .select('id')
    .eq('sku', sku)
    .maybeSingle();
  if (exists?.id) {
    cache.set(key, exists.id as number);
    return exists.id as number;
  }
  // try to find mis-seeded records where sku was incorrectly stored as name
  const { data: mis } = await supabase
    .from('app_items')
    .select('id, name, sku')
    .eq('name', sku)
    .maybeSingle();
  if (mis?.id) {
    // Correct the record: set proper sku, and update name to provided name
    const { data: updated, error: updErr } = await supabase
      .from('app_items')
      .update({ sku, name })
      .eq('id', mis.id)
      .select('id')
      .single();
    if (updErr) throw updErr;
    cache.set(key, updated!.id as number);
    return updated!.id as number;
  }
  const { data } = await supabase
    .from('app_items')
    .insert({ sku, name })
    .select('id')
    .single()
    .throwOnError();
  cache.set(key, data.id as number);
  return data.id as number;
}

async function linkSiteItem(siteId: number, itemId: number) {
  await supabase
    .from('app_site_items')
    .upsert({ site_id: siteId, item_id: itemId }, { onConflict: 'site_id,item_id', ignoreDuplicates: true })
    .throwOnError();
}

async function main() {
  // 1) Try to load static site->employees from RequestPage.tsx (optional)
  let staticSites: StaticSiteEmployees = [];
  try {
    const reqPagePath = path.resolve('src/pages/RequestPage.tsx');
    const reqSrc = readFileSync(reqPagePath, 'utf8');
    const blockMatch = reqSrc.match(/const\s+STATIC_SITE_EMPLOYEES:[\s\S]*?=\s*(\[[\s\S]*?\]);/);
    if (blockMatch) {
      const block = blockMatch[1];
      const objRegex = /\{\s*site:\s*"([^"]+)"\s*,\s*employees:\s*\[((?:[^\]\n]|\n)*?)\]\s*\}/gms;
      let m: RegExpExecArray | null;
      while ((m = objRegex.exec(block)) !== null) {
        const siteName = m[1].trim();
        const employeesListRaw = m[2];
        const empNames: string[] = [];
        const empRegex = /"([^"]+)"/g;
        let em: RegExpExecArray | null;
        while ((em = empRegex.exec(employeesListRaw)) !== null) {
          empNames.push(em[1]);
        }
        staticSites.push({ site: siteName, employees: empNames });
      }
    }
  } catch {}

  // 2) Load site supplies JSON
  const suppliesPath = path.resolve('site_supplies_aligned.json');
  const supplies: SiteSuppliesEntry[] = JSON.parse(readFileSync(suppliesPath, 'utf8'));

  // Build lookups
  const normToSupplies = new Map<string, SupplyRow[]>();
  for (const entry of supplies) {
    const norm = normalize(entry.site);
    const rows = (entry.supplies || []).filter(r =>
      r.item_number && r.supply &&
      !(r.item_number.toLowerCase() === 'item' && r.supply.toLowerCase().includes('item number'))
    );
    normToSupplies.set(norm, rows);
  }

  // Caches to reduce roundtrips
  const siteIdCache = new Map<string, number>();
  const empIdCache = new Map<string, number>();
  const itemIdBySkuCache = new Map<string, number>();

  let totalSites = 0, totalEmployees = 0, totalItems = 0, totalLinksSE = 0, totalLinksSI = 0;

  // 3) Seed sites and employees from static mapping (if available)
  if (staticSites.length > 0) {
    for (const entry of staticSites) {
      const siteId = await getOrCreateSiteId(siteIdCache, entry.site);
      totalSites += Number(![...siteIdCache.values()].filter(v => v === siteId).length);
      for (const fullName of entry.employees) {
        const empId = await getOrCreateEmployeeId(empIdCache, fullName);
        totalEmployees += Number(![...empIdCache.values()].filter(v => v === empId).length);
        await linkSiteEmployee(siteId, empId);
        totalLinksSE++;
      }
    }
  }

  // 4) Seed items and site_items from supplies JSON, using existing DB sites as base; also create any extra sites present in JSON
  const { data: dbSites } = await supabase.from('app_sites').select('id,name');
  const existingSites = new Set((dbSites || []).map(s => normalize((s as any).name)));
  const unionSites = new Set<string>([...existingSites, ...normToSupplies.keys()]);
  for (const norm of unionSites) {
    // choose canonical name: if present in static mapping use that, else use any from JSON
    const staticEntry = staticSites.find(s => normalize(s.site) === norm);
    const siteName = staticEntry ? staticEntry.site : (supplies.find(s => normalize(s.site) === norm)?.site || norm);
    const siteId = await getOrCreateSiteId(siteIdCache, siteName);

    const rows = normToSupplies.get(norm) || [];
    for (const r of rows) {
      const sku = r.supply.trim();
      const name = r.item_number.trim();
      const itemId = await getOrCreateItemIdBySku(itemIdBySkuCache, sku, name);
      await linkSiteItem(siteId, itemId);
      totalLinksSI++;
    }
  }

  // For counts, query unique sizes
  const { count: siteCount } = await supabase.from('app_sites').select('*', { count: 'exact', head: true });
  const { count: empCount } = await supabase.from('app_employees').select('*', { count: 'exact', head: true });
  const { count: itemCount } = await supabase.from('app_items').select('*', { count: 'exact', head: true });

  console.log(`✔ Seed complete. Sites=${siteCount}, Employees=${empCount}, Items=${itemCount}, Links: site_employees=${totalLinksSE}, site_items=${totalLinksSI}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


