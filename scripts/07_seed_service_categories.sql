-- Seed initial service categories to match hardcoded values
-- Run this after 06_add_system_settings.sql

-- Document categories (services)
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active)
VALUES
  ('barangay-clearance', 'Barangay Clearance', 'Official document required for various transactions, confirming local residency in good standing.', 'document', 1, true),
  ('certificate-residency', 'Certificate of Residency', 'A legal document certifying that a citizen is a permanent resident of the barangay.', 'document', 2, true),
  ('business-permit', 'Business Permit', 'For new applications and renewals of local businesses.', 'document', 3, true),
  ('good-moral', 'Good Moral Certificate', 'Certifies good character, commonly required for school or employment.', 'document', 4, true),
  ('indigency', 'Indigency Certificate', 'Required for welfare benefits, scholarships, and assistance programs.', 'document', 5, true)
ON CONFLICT (slug) DO NOTHING;

-- Incident/complaint categories - seeded to match complaint-categories.ts
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active)
VALUES
  ('noise-complaint', 'Noise Complaint', 'Report excessive noise disturbances in the community.', 'incident', 1, true),
  ('public-disturbance', 'Public Disturbance', 'Reports regarding disputes, fights, or disturbances in public areas.', 'incident', 2, true),
  ('sanitation', 'Sanitation', 'Issues related to garbage collection, waste management, and cleanliness.', 'incident', 3, true),
  ('infrastructure-issue', 'Infrastructure Issue', 'Concerns about road repairs, street conditions, and public facilities.', 'incident', 4, true),
  ('barangay-incident', 'Barangay Incident', 'Serious incidents including assault, theft, and other safety concerns.', 'incident', 5, true),
  ('illegal-parking', 'Illegal Parking', 'Reports of vehicles blocking roads, driveways, or public spaces.', 'incident', 6, true),
  ('street-light-problem', 'Street Light Problem', 'Issues with street lighting and dark areas in the community.', 'incident', 7, true),
  ('other-concerns', 'Other Concerns', 'General concerns not covered by other categories.', 'incident', 8, true)
ON CONFLICT (slug) DO NOTHING;