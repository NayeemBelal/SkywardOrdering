import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

// Load env from .env and .env.local if present
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: false });

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) as string;
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY) as string;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface ItemWithImage {
  id: number;
  name: string;
  sku: string;
  category?: string;
  image_path?: string;
  site_name?: string;
}

async function generateMissingImagesReport() {
  try {
    console.log('🔍 Fetching all items and their image status...');
    
    // Get all items with their image paths from app_site_items
    const { data: siteItems, error: siteItemsError } = await supabase
      .from('app_site_items')
      .select(`
        app_items ( id, name, sku, category ),
        image_path,
        app_sites ( name )
      `);
    
    if (siteItemsError) {
      throw new Error(`Failed to fetch site items: ${siteItemsError.message}`);
    }

    console.log(`📊 Found ${siteItems?.length || 0} site-item relationships`);

    // Process the data
    const itemsWithImages: ItemWithImage[] = [];
    const itemsWithoutImages: ItemWithImage[] = [];
    
    for (const row of siteItems || []) {
      if (!row.app_items) continue;
      
      const item: ItemWithImage = {
        id: row.app_items.id,
        name: row.app_items.name,
        sku: row.app_items.sku,
        category: row.app_items.category,
        image_path: row.image_path,
        site_name: (row.app_sites as any)?.name
      };
      
      if (row.image_path) {
        itemsWithImages.push(item);
      } else {
        itemsWithoutImages.push(item);
      }
    }

    console.log(`✅ Items WITH images: ${itemsWithImages.length}`);
    console.log(`❌ Items WITHOUT images: ${itemsWithoutImages.length}`);

    // Create Excel workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Items without images
    if (itemsWithoutImages.length > 0) {
      const missingData = itemsWithoutImages.map(item => [
        item.sku,
        item.name,
        item.category || 'Unknown',
        item.site_name || 'Multiple sites'
      ]);
      
      const missingWs = XLSX.utils.aoa_to_sheet([
        ['SKU', 'Item Name', 'Category', 'Site(s)'],
        ...missingData
      ]);
      
      XLSX.utils.book_append_sheet(wb, missingWs, 'Missing Images');
      console.log(`📋 Created "Missing Images" sheet with ${itemsWithoutImages.length} items`);
    }

    // Sheet 2: Items with images
    if (itemsWithImages.length > 0) {
      const withData = itemsWithImages.map(item => [
        item.sku,
        item.name,
        item.category || 'Unknown',
        item.site_name || 'Multiple sites',
        item.image_path
      ]);
      
      const withWs = XLSX.utils.aoa_to_sheet([
        ['SKU', 'Item Name', 'Category', 'Site(s)', 'Image Path'],
        ...withData
      ]);
      
      XLSX.utils.book_append_sheet(wb, withWs, 'Items With Images');
      console.log(`📋 Created "Items With Images" sheet with ${itemsWithImages.length} items`);
    }

    // Sheet 3: Summary
    const summaryData = [
      ['Total Items', itemsWithImages.length + itemsWithoutImages.length],
      ['Items With Images', itemsWithImages.length],
      ['Items Without Images', itemsWithoutImages.length],
      ['Coverage Percentage', `${((itemsWithImages.length / (itemsWithImages.length + itemsWithoutImages.length)) * 100).toFixed(1)}%`],
      [''],
      ['Categories Breakdown:'],
      ['Category', 'Total', 'With Images', 'Without Images', 'Coverage %']
    ];

    // Group by category
    const categoryStats = new Map<string, { total: number; withImages: number; withoutImages: number }>();
    
    for (const item of [...itemsWithImages, ...itemsWithoutImages]) {
      const category = item.category || 'Unknown';
      if (!categoryStats.has(category)) {
        categoryStats.set(category, { total: 0, withImages: 0, withoutImages: 0 });
      }
      
      const stats = categoryStats.get(category)!;
      stats.total++;
      
      if (item.image_path) {
        stats.withImages++;
      } else {
        stats.withoutImages++;
      }
    }

    // Add category breakdown to summary
    for (const [category, stats] of categoryStats) {
      const coverage = ((stats.withImages / stats.total) * 100).toFixed(1);
      summaryData.push([category, stats.total, stats.withImages, stats.withoutImages, `${coverage}%`]);
    }

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Save the Excel file
    const outputPath = path.join(process.cwd(), 'missing-images-report.xlsx');
    XLSX.writeFile(wb, outputPath);
    
    console.log(`\n🎉 Excel report generated successfully!`);
    console.log(`📁 File saved to: ${outputPath}`);
    console.log(`\n📊 Summary:`);
    console.log(`   • Total items: ${itemsWithImages.length + itemsWithoutImages.length}`);
    console.log(`   • With images: ${itemsWithImages.length}`);
    console.log(`   • Without images: ${itemsWithoutImages.length}`);
    console.log(`   • Coverage: ${((itemsWithImages.length / (itemsWithImages.length + itemsWithoutImages.length)) * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error('❌ Failed to generate report:', error);
    process.exit(1);
  }
}

generateMissingImagesReport();
