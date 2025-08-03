// Deno edge function to generate XLSX and email via SendGrid
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import * as xlsx from 'https://esm.sh/xlsx@0.18.5';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE')!;
const sendgridKey = Deno.env.get('SENDGRID_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);

serve(async (req) => {
  const { requestId } = await req.json();
  // Fetch request with items
  const { data: request } = await supabase
    .from('requests')
    .select('id, submitted_at, sites(name), employees(full_name), request_items(item_id, on_hand, order_qty, items(name_es,name_en,sku))')
    .eq('id', requestId)
    .single();

  // Build workbook
  const wsData = [['Item','SKU','On hand','Order qty']];
  for (const ri of request.request_items) {
    wsData.push([ri.items.name_es, ri.items.sku, ri.on_hand, ri.order_qty]);
  }
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(wsData), 'Request');
  const xlsxBuf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const path = `requests/${request.id}.xlsx`;
  await supabase.storage.from('requests').upload(path, xlsxBuf, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await supabase.from('requests').update({ xlsx_path: path, submitted_at: new Date().toISOString() }).eq('id', request.id);

  // Send e-mail via SendGrid
  const body = {
    personalizations: [{ to: [{ email: 'supervisor@example.com' }] }],
    from: { email: 'noreply@example.com' },
    subject: `Supply request from ${request.sites.name}`,
    content: [{ type: 'text/plain', value: 'See attachment' }],
    attachments: [{
      content: btoa(String.fromCharCode(...new Uint8Array(xlsxBuf))),
      filename: 'request.xlsx',
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      disposition: 'attachment'
    }]
  };
  await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${sendgridKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
});
