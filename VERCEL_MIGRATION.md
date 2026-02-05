# Migration to Bunny Storage & Vercel

Since you've downgraded Supabase, we've moved file storage to Bunny Storage (cheaper/specialized) and backend logic to Vercel Serverless Functions.

## 1. Environment Variables

### A. Vercel (Frontend & Upload API)
Set these in Vercel Project Settings:

```bash
# Bunny Storage Credentials
BUNNY_STORAGE_API_KEY="your-storage-zone-password"
BUNNY_STORAGE_ZONE="your-storage-zone-name"
BUNNY_CDN_URL="https://your-pull-zone.b-cdn.net" # Optional
VITE_HLS_BASE_URL="https://your-pull-zone.b-cdn.net" # REQUIRED for frontend to find streams
```

### B. Supabase Edge Functions (Live Streaming / HLS)
To ensure **Live Streams** are saved to Bunny (and served via HLS), you must update your Supabase Edge Function secrets. Run these commands locally or set them in the Supabase Dashboard:

```bash
supabase secrets set S3_BUCKET="your-storage-zone-name"
supabase secrets set S3_ACCESS_KEY="your-storage-zone-name"
supabase secrets set S3_SECRET_KEY="your-storage-zone-password"
supabase secrets set S3_ENDPOINT="https://storage.bunnycdn.com" # Check your zone region!
supabase secrets set S3_REGION="us-east-1" # Required by client, but ignored by Bunny
supabase secrets set VITE_HLS_BASE_URL="https://your-pull-zone.b-cdn.net"
```

## 2. How it Works

### Secure Upload Proxy (`/api/upload`)
We created a Vercel Serverless Function at `api/upload.ts`.
- **Why?** Bunny Storage API keys allow full delete access. We cannot expose them in the frontend (React).
- **Flow:** React App -> Vercel Function -> Bunny Storage.
- **Security:** The function currently allows uploads from your app. You can add auth checks (Supabase token verification) later if needed.

### Frontend Utility (`src/lib/bunny-storage.ts`)
We added a helper `bunnyStorage.upload(path, file)`.
- Replaces `supabase.storage.from(...).upload(...)`.
- Automatically handles the `FormData` and headers.

## 3. Changes Made

### `src/pages/ProfileSetup.tsx`
- **Before:** Tried to upload to `covers`, `avatars`, etc. on Supabase, handling complex errors.
- **After:** Uploads directly to Bunny Storage via our proxy.

### `vercel.json`
- Configured to serve the React SPA (Single Page App).
- Configured to route `/api/*` to the serverless functions.

## 4. Next Steps
1. **Deploy to Vercel:** Connect your GitHub repo to Vercel. It should auto-detect the configuration.
2. **Verify Uploads:** Try setting up a profile (upload ID or cover photo).
3. **Admin Panel:** The Admin Media Library still tries to list files from Supabase. This will need to be updated later if you want to manage Bunny files from the admin dashboard.
