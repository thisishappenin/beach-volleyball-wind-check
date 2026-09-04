-- Allow anyone (including unauthenticated visitors) to read all locations.
-- This makes the saved beaches visible to guests without requiring sign-in.
-- Write operations (insert/update/delete) still require authentication.

CREATE POLICY "Public read all locations"
  ON locations FOR SELECT TO anon
  USING (true);
