import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Resend } from 'npm:resend@^2.0.0'
import * as XLSX from 'npm:xlsx@^0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SupplyItem {
  category: string
  name: string
  sku: string
  on_hand: number
  order_qty: number
}

interface SupplyRequest {
  siteName: string
  employeeName: string
  items: SupplyItem[]
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { siteName, employeeName, items }: SupplyRequest = await req.json()

    if (!siteName || !employeeName || !items || !Array.isArray(items)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Create Excel workbook
    const header = [
      ['Site', siteName],
      ['Employee', employeeName],
      ['Submitted', new Date().toISOString()],
      [],
    ]
    const tableHeader = [['Category', 'Item', 'SKU', 'On Hand', 'Order Qty']]
    
    const ws = XLSX.utils.aoa_to_sheet([
      ...header,
      ...tableHeader,
      ...items.map((item) => [
        item.category, 
        item.name, 
        item.sku, 
        item.on_hand, 
        item.order_qty
      ])
    ])
    
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Request')
    
    // Generate Excel file as base64 (Deno-friendly)
    const base64Attachment = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })

    // Initialize Resend
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'))

    if (!resend) {
      throw new Error('RESEND_API_KEY not configured')
    }

    // Send email with Excel attachment
    const primaryRecipient = Deno.env.get('REQUESTS_TO_EMAIL') || 'supervisor@example.com'
    const slackChannelEmail = Deno.env.get('SLACK_CHANNEL_EMAIL') || ''
    const recipients = slackChannelEmail ? [primaryRecipient, slackChannelEmail] : [primaryRecipient]

    const emailResult = await resend.emails.send({
      from: 'Skyward Ordering <noreply@yourdomain.com>',
      to: recipients,
      subject: `Supply Request - ${siteName} - ${employeeName}`,
      html: `
        <h2>New Supply Request</h2>
        <p><strong>Site:</strong> ${siteName}</p>
        <p><strong>Employee:</strong> ${employeeName}</p>
        <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Total Items:</strong> ${items.length}</p>
        <p><strong>Items to Order:</strong> ${items.filter(item => item.order_qty > 0).length}</p>
        <br>
        <p>Please find the detailed Excel sheet attached.</p>
      `,
      attachments: [
        {
          content: base64Attachment,
          filename: `supply_request_${siteName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`,
        },
      ],
    })

    // Send to Slack channel
    const slackWebhookUrl = Deno.env.get('SLACK_WEBHOOK_URL')
    if (slackWebhookUrl) {
      const orderLines = items.filter(item => item.order_qty > 0)
      const summary = orderLines
        .slice(0, 20)
        .map(item => `• ${item.name} (${item.sku}) x ${item.order_qty}`)
        .join('\n')
      
      const slackMessage = {
        text: `New supply request submitted`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: "📋 New Supply Request"
            }
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Site:*\n${siteName}`
              },
              {
                type: "mrkdwn",
                text: `*Employee:*\n${employeeName}`
              }
            ]
          },
          {
            type: "section",
            fields: [
              {
                type: "mrkdwn",
                text: `*Total Items:*\n${items.length}`
              },
              {
                type: "mrkdwn",
                text: `*Items to Order:*\n${orderLines.length}`
              }
            ]
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Order Summary:*\n${summary}${orderLines.length > 20 ? '\n...and more items' : ''}`
            }
          },
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `Submitted at ${new Date().toLocaleString()}`
              }
            ]
          }
        ]
      }

      try {
        await fetch(slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage),
        })
      } catch (slackError) {
        console.error('Slack notification failed:', slackError)
        // Don't fail the entire request if Slack fails
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Supply request sent successfully',
        emailResult 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error processing supply request:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process supply request',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
