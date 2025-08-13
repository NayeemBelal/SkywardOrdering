-- Add storage policies for the item-images bucket
-- This allows authenticated users to upload images while maintaining security

-- Enable RLS on storage.objects if not already enabled
-- Note: This is typically enabled by default in Supabase

-- Policy to allow authenticated users to upload files to item-images bucket
create policy "Allow authenticated users to upload images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'item-images' AND
  (storage.foldername(name))[1] IN ('uploads', 'placeholders')
);

-- Policy to allow authenticated users to update files in item-images bucket
create policy "Allow authenticated users to update images"
on storage.objects for update
to authenticated
using (bucket_id = 'item-images')
with check (bucket_id = 'item-images');

-- Policy to allow public read access to all files in item-images bucket
create policy "Allow public read access to images"
on storage.objects for select
to public
using (bucket_id = 'item-images');

-- Policy to allow authenticated users to delete their uploaded files
create policy "Allow authenticated users to delete images"
on storage.objects for delete
to authenticated
using (bucket_id = 'item-images');
