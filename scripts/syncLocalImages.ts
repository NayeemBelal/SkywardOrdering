import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load env from .env and .env.local if present
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string;
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY) as string;
const BUCKET = process.env.SUPABASE_BUCKET || 'item-images';
const LOCAL_IMAGES_DIR = process.env.LOCAL_IMAGES_DIR || '/Users/nayeembelal/Downloads/Supply Images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function normalize(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
}

function cleanSiteNameForMatching(siteFolderName: string): string {
  // Remove anything in parentheses and common suffixes like "Completed"
  const withoutParens = siteFolderName.replace(/\([^)]*\)/g, ' ');
  const withoutMarkers = withoutParens.replace(/\bCOMPLETED\b/gi, ' ').replace(/\bN-?A IN HD SUPPLY\b/gi, ' ');
  return withoutMarkers;
}

function getContentTypeByExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.webp') return 'image/webp';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  return 'application/octet-stream';
}

async function ensureBucket() {
  try {
    await supabase.storage.listBuckets();
  } catch {}
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});
}

async function main() {
  await ensureBucket();

  // Build SKU -> item id map
  const { data: items, error: itemsError } = await supabase.from('app_items').select('id, sku');
  if (itemsError) throw itemsError;
  const skuToItemId = new Map<string, number>();
  for (const it of items || []) {
    const sku = (it as any).sku as string;
    if (!sku) continue;
    skuToItemId.set(sku.toUpperCase(), (it as any).id as number);
  }

  // Build normalized site name -> site id map
  const { data: sites, error: sitesError } = await supabase.from('app_sites').select('id, name');
  if (sitesError) throw sitesError;
  const normToSiteId = new Map<string, number>();
  for (const s of sites || []) {
    const norm = normalize((s as any).name as string);
    normToSiteId.set(norm, (s as any).id as number);
  }

  // List local site directories
  const rootEntries = await fs.readdir(LOCAL_IMAGES_DIR, { withFileTypes: true });
  for (const siteDirent of rootEntries) {
    if (!siteDirent.isDirectory()) continue;
    const siteFolderName = siteDirent.name;
    const cleaned = cleanSiteNameForMatching(siteFolderName);
    const normSite = normalize(cleaned);

    const siteId = normToSiteId.get(normSite);
    if (!siteId) {
      console.log('Skip site folder without DB match:', siteFolderName);
      continue;
    }
    
    // Skip specific locations as requested
    if (siteFolderName === '333 Chestnut' || siteFolderName === '5100') {
      console.log('Skip requested location:', siteFolderName);
      continue;
    }

    const siteFolderPath = path.join(LOCAL_IMAGES_DIR, siteFolderName);
    const fileEntries = await fs.readdir(siteFolderPath, { withFileTypes: true });
    for (const f of fileEntries) {
      if (!f.isFile()) continue;
      const lower = f.name.toLowerCase();
      if (!/(\.webp|\.png|\.jpg|\.jpeg)$/.test(lower)) continue;

      // Extract SKU from filename patterns:
      // - PRO_<SKU>_product_<SKU>_usn[ (n)].ext
      // - PRO_<SKU>.ext
      const m = f.name.match(/^PRO_([A-Za-z0-9-]+)(?:_product_[A-Za-z0-9-]+(?:_usn)?(?: \(\d+\))?)?\.(?:webp|png|jpg|jpeg)$/i);
      if (!m) {
        console.log('Skip file with invalid naming pattern:', f.name);
        continue;
      }
      const sku = m[1].toUpperCase();
      
      // Upload the image regardless of whether item exists
      const filePath = path.join(siteFolderPath, f.name);
      const fileBuf = await fs.readFile(filePath);
      const destPath = `${normSite}/${f.name}`;
      const contentType = getContentTypeByExtension(f.name);

      await supabase.storage.from(BUCKET).upload(destPath, fileBuf, {
        contentType,
        upsert: true,
      });

      // Try to link to existing item if it exists
      const itemId = skuToItemId.get(sku);
      if (itemId) {
        await supabase
          .from('app_site_items')
          .update({ image_path: `${BUCKET}/${destPath}` })
          .eq('site_id', siteId)
          .eq('item_id', itemId);
        console.log('Uploaded and linked', siteFolderName, f.name);
      } else {
        console.log('Uploaded (no DB link - SKU not found):', siteFolderName, f.name, 'SKU:', sku);
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


