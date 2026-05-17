# Create Storage Bucket for Cover Photos

## Quick Fix

The app needs a storage bucket to store cover photos and avatars. Here's how to create it:

### Steps:

1. **Open Supabase Dashboard**
   - Go to your project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **Navigate to Storage**
   - Click "Storage" in the left sidebar

3. **Create New Bucket**
   - Click "New bucket" button
   - **Bucket name**: `covers`
   - **Public bucket**: ✅ Check this box (allows public access to images)
   - Click "Create bucket"

4. **Set Bucket Policies** (if needed)
   - Click on the `covers` bucket
   - Go to "Policies" tab
   - Add these policies if they don't exist:

   **INSERT policy:**
   ```sql
   CREATE POLICY "Authenticated users can upload covers"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'covers');
   ```

   **SELECT policy:**
   ```sql
   CREATE POLICY "Public can view covers"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'covers');
   ```

   **UPDATE policy:**
   ```sql
   CREATE POLICY "Users can update own covers"
   ON storage.objects FOR UPDATE
   TO authenticated
   USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

   **DELETE policy:**
   ```sql
   CREATE POLICY "Users can delete own covers"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (bucket_id = 'covers' AND auth.uid()::text = (storage.foldername(name))[1]);
   ```

### Alternative: Use Existing Bucket

If you already have a public bucket (like `avatars` or `public`), the code will automatically try those as fallbacks.

### After Creating Bucket

1. Refresh your app
2. Try uploading a cover photo again
3. It should work now!

---

## For Complete Setup (Optional)

Create additional buckets for better organization:

- `covers` - Cover/banner photos
- `avatars` - Profile avatars
- `troll-city-assets` - General app assets
- `public` - Miscellaneous public files

All should have "Public bucket" enabled.
