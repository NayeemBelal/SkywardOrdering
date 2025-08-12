import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import path from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID!; // 1NgeTatOd2raXjKHVTuWxZWlo0bvnXAK8
const GOOGLE_CREDENTIALS_JSON = process.env.GOOGLE_CREDENTIALS_JSON!; // stringified service account JSON
const BUCKET = process.env.SUPABASE_BUCKET || 'item-images';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !DRIVE_FOLDER_ID || !GOOGLE_CREDENTIALS_JSON) {
  console.error('Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE, DRIVE_FOLDER_ID, GOOGLE_CREDENTIALS_JSON');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();

async function ensureBucket() {
  // try create bucket if not exists
  // supabase-js storage admin is only via service role
  try {
    // attempt list to infer existence
    await supabase.storage.listBuckets();
  } catch {}
  // create if needed
  await supabase.storage.createBucket(BUCKET, { public: true }).catch(()=>{});
}

function getDriveClient() {
  const creds = JSON.parse(GOOGLE_CREDENTIALS_JSON);
  const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
  let auth;
  if (creds.type === 'service_account' || creds.client_email) {
    auth = new google.auth.JWT(
      creds.client_email,
      undefined,
      creds.private_key,
      scopes
    );
  } else if (creds.web) {
    const { client_id, client_secret } = creds.web;
    auth = new google.auth.OAuth2(client_id, client_secret);
    throw new Error('OAuth flow not supported in non-interactive script. Provide service account credentials.');
  } else {
    throw new Error('Invalid GOOGLE_CREDENTIALS_JSON');
  }
  return google.drive({ version: 'v3', auth });
}

async function listChildren(drive: any, folderId: string) {
  const files: any[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageToken,
      pageSize: 1000,
    });
    files.push(...(res.data.files || []));
    pageToken = res.data.nextPageToken || undefined;
  } while (pageToken);
  return files;
}

async function main() {
  await ensureBucket();
  const drive = getDriveClient();

  // Map SKU -> item id for quick lookup
  const { data: items } = await supabase.from('app_items').select('id, sku');
  const skuToItemId = new Map<string, number>();
  for (const it of items || []) skuToItemId.set((it as any).sku, (it as any).id);

  // Map normalized site name -> site id
  const { data: sites } = await supabase.from('app_sites').select('id, name');
  const normToSiteId = new Map<string, number>();
  for (const s of sites || []) normToSiteId.set(normalize((s as any).name), (s as any).id);

  // Traverse site folders
  const siteFolders = await listChildren(drive, DRIVE_FOLDER_ID);
  for (const siteFolder of siteFolders) {
    if (siteFolder.mimeType !== 'application/vnd.google-apps.folder') continue;
    const normSite = normalize(siteFolder.name);
    const siteId = normToSiteId.get(normSite);
    if (!siteId) {
      console.log('Skip site folder without match:', siteFolder.name);
      continue;
    }
    const images = await listChildren(drive, siteFolder.id);
    for (const img of images) {
      if (img.mimeType === 'application/vnd.google-apps.folder') continue;
      const m = img.name.match(/PRO_([^_]+)_product_\1_usn\.(?:webp|png|jpg|jpeg)$/i);
      if (!m) { continue; }
      const sku = m[1];
      const itemId = skuToItemId.get(sku);
      if (!itemId) { continue; }

      // Download file content
      const res = await drive.files.get({ fileId: img.id, alt: 'media' }, { responseType: 'arraybuffer' });
      const fileBuf = Buffer.from(res.data as ArrayBuffer);
      const destPath = `${normSite}/${img.name}`;

      // Upload to storage
      await supabase.storage.from(BUCKET).upload(destPath, fileBuf, {
        contentType: 'image/webp',
        upsert: true,
      });

      // Update DB link on app_site_items
      await supabase
        .from('app_site_items')
        .update({ image_path: `${BUCKET}/${destPath}` })
        .eq('site_id', siteId)
        .eq('item_id', itemId);

      console.log('Uploaded and linked', siteFolder.name, img.name);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


