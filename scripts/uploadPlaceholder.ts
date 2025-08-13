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

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function uploadPlaceholder() {
  try {
    // Ensure bucket exists
    try {
      await supabase.storage.listBuckets();
    } catch {}
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {});

    // Read placeholder image
    const placeholderPath = path.join(process.cwd(), 'scripts', 'img-placeholder.jpeg');
    const fileBuf = await fs.readFile(placeholderPath);
    
    // Upload to storage
    const destPath = 'placeholders/img-placeholder.jpeg';
    await supabase.storage.from(BUCKET).upload(destPath, fileBuf, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    console.log('✅ Placeholder image uploaded successfully to:', `${BUCKET}/${destPath}`);
    console.log('📁 You can now use this path in your frontend code');
    
  } catch (error) {
    console.error('❌ Failed to upload placeholder:', error);
    process.exit(1);
  }
}

uploadPlaceholder();
