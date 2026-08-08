# Tri Fare Agoo Admin

The admin dashboard uses Supabase Postgres for permanent users and reports, and a private Supabase Storage bucket for photos. This keeps data after Vercel functions restart or redeploy.

## 1. Create permanent storage

1. Create a Supabase project.
2. Open its SQL Editor and run [`supabase/schema.sql`](supabase/schema.sql).
3. Copy `.env.example` to `.env.local` and enter the project URL and service-role key.
4. Never expose `SUPABASE_SERVICE_ROLE_KEY` in Expo or any variable beginning with `NEXT_PUBLIC_`.

## 2. Run locally

```bash
npm install
npm run dev
```

The dashboard is available at `http://localhost:3000`. For a physical phone, set the Expo app API URL to the computer's LAN address:

```bash
EXPO_PUBLIC_ADMIN_API_URL=http://YOUR_COMPUTER_IP:3000 npm start
```

Mobile submissions made while the API is unavailable stay queued on the phone and retry automatically.

## 3. Deploy on Vercel

Set the Vercel project Root Directory to `admin-web`. Add these variables for Production, Preview, and Development:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET=tri-fare-uploads`

After deployment, set `EXPO_PUBLIC_ADMIN_API_URL` in the Expo app to the Vercel URL and rebuild the mobile app.
