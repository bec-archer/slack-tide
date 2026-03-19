-- Storage bucket for shop verification photos (private)
-- Create this bucket manually in Supabase Dashboard → Storage → New Bucket
-- Name: shop-verification
-- Public: OFF (private)

-- Allow authenticated users to upload to their own shop's folder
CREATE POLICY "Shop admins can upload verification photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'shop-verification'
  AND (storage.foldername(name))[1] IN (
    SELECT s.id::text FROM shops s
    INNER JOIN shop_employees se ON se.shop_id = s.id
    WHERE se.user_id = auth.uid()
      AND se.role = 'admin'
      AND se.removed_at IS NULL
  )
);

-- Allow the service role (used by server-side API) to read for signed URLs
-- Note: service_role bypasses RLS, so no policy needed for admin reads
