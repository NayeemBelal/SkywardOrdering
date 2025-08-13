# Resend and Slack Integration Setup

This guide explains how to set up the new Resend email service and Slack integration for supply requests.

## Environment Variables

You'll need to configure these environment variables in your Supabase project:

### Supabase Edge Function Environment Variables

1. **RESEND_API_KEY** - Your Resend API key
   - Get this from [resend.com](https://resend.com)
   - Add it in Supabase Dashboard → Settings → Edge Functions → Environment Variables

2. **REQUESTS_TO_EMAIL** - The email address where supply requests should be sent
   - Example: `supervisor@yourcompany.com`

3. **SLACK_WEBHOOK_URL** - Your Slack webhook URL for the ordering channel
   - The webhook URL you provided: `ordering-aaaaq54rikkemxbbx4ma5uhqdm@skywardbuildi-ast2797.slack.com`
   - Add this in Supabase Dashboard → Settings → Edge Functions → Environment Variables

## Frontend Environment Variables

Make sure these are set in your frontend `.env` file:

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment Steps

1. **Deploy the Edge Function:**
   ```bash
   supabase functions deploy send-supply-request
   ```

2. **Set Environment Variables in Supabase:**
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Add the environment variables listed above

3. **Test the Integration:**
   - Submit a supply request from the frontend
   - Check that the email is sent with Excel attachment
   - Verify the Slack notification appears in your channel

## How It Works

1. User submits supply request on the frontend
2. Frontend calls the `send-supply-request` Edge Function
3. Edge Function:
   - Generates Excel file with supply data
   - Sends email via Resend with Excel attachment
   - Posts notification to Slack channel
4. User is redirected to success page

## Benefits of This Approach

- **Resend**: Professional email delivery with attachments
- **Slack Integration**: Real-time notifications in your team channel
- **Server-side Processing**: Secure API key handling
- **Excel Generation**: Professional-looking order sheets
- **Error Handling**: Robust error handling and logging

## Troubleshooting

- Check Supabase Edge Function logs for errors
- Verify environment variables are set correctly
- Ensure Resend API key has proper permissions
- Check Slack webhook URL is valid and active
