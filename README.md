# Cleaning Supply Requester

## Setup
1. Copy `.env.sample` to `.env` and fill values.
2. `npm install`
3. `npm run dev` to start Vite.
4. `npm run supabase:start` to start local Supabase.
5. `npm run seed` to import Excel data.
6. Configure [EmailJS](https://www.emailjs.com/):
   - create a template with variables `site_name`, `employee_name`, `submitted_at` and `to_email`
   - add Service ID, Template ID, Public and Private keys to `.env`
   - set the template to send the attached `request.xlsx` to the supervisor email

Sample output:
```
✔ Imported 13 sites, 412 items, 76 employees
```
