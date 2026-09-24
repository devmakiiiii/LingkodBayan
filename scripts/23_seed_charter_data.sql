-- Migration 23: Seed Barangay Barretto Citizen's Charter 2025 (1st Edition) data
-- Source of truth: Barangay Barretto Citizen's Charter 2025 - 1st Edition.
-- All services, fees, requirements, processing times, offices, and steps below
-- are taken directly from the charter. Nothing is invented.
-- Idempotent: safe to run multiple times (upserts + delete-then-insert children).

-- ============================================================================
-- 1. OFFICES (Charter Section 20)
-- ============================================================================
INSERT INTO public.offices (office_key, name, charter_category, address, phone, email, facebook, sort_order, is_active)
VALUES
  ('punong-barangay', 'Office of the Punong Barangay', 'Office of the Punong Barangay',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-1451 / 222-4295', NULL, NULL, 1, TRUE),
  ('secretariat', 'Office of the Secretary', 'Secretariat Office',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-1451 / 222-4295', 'barangaybarretto00@gmail.com', NULL, 2, TRUE),
  ('treasury', 'Treasury Office', 'Treasury Office',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-1451', NULL, NULL, 3, TRUE),
  ('lupon', 'Lupong Tagapamayapa', 'Lupong Tagapamayapa / Barangay Justice System',
   NULL, NULL, NULL, NULL, 4, TRUE),
  ('command-center', 'Command Center', 'Command Center',
   NULL, NULL, NULL, NULL, 5, TRUE),
  ('health-center', 'Barangay Health Center', 'Barangay Health Center',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', NULL, NULL, 'Barangay Barretto Health Center', 6, TRUE),
  ('bbfru', 'Barangay Barretto Fire and Rescue Unit (BBFRU)', 'Barangay Barretto Fire and Rescue Unit (BBFRU)',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', '0946-214-2438', NULL, NULL, 7, TRUE),
  ('bpat', 'Barretto Peacekeeping Action Team (BPAT)', 'Barretto Peacekeeping Action Team (BPAT)',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', '0938-949-5840', NULL, NULL, 8, TRUE),
  ('cdc', 'Day Care Center / Child Development Center (CDC)', 'Child Development Center (CDC)',
   '#2 Ilo-Ilo Street, Barretto, Olongapo City', '0915-165-3902', NULL, NULL, 9, TRUE),
  ('bblc', 'Barangay Barretto Learning Center (BBLC)', 'Community-Based Learning and Literacy Program / BBLC',
   '#3 Ilo-Ilo Street, Barretto, Olongapo City', '222-4295', NULL, NULL, 10, TRUE)
ON CONFLICT (office_key) DO UPDATE SET
  name = EXCLUDED.name,
  charter_category = EXCLUDED.charter_category,
  address = EXCLUDED.address,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  facebook = EXCLUDED.facebook,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ============================================================================
-- 2. CHARTER SERVICES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 2a. TREASURY OFFICE (Charter Section 7) - Classification: Simple - G2C/G2B/G2G - Who may avail: All
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('record-clearance', 'Record Clearance',
   'Clearance issued by the Treasury Office based on barangay records.',
   'document', 10, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'range', 50, 60, '₱50–₱60',
   '5–10 minutes', 'Secretariat Encoder', 'Treasury Office', 'documents-certifications'),
  ('cedula-community-tax-certificate', 'Cedula / Community Tax Certificate',
   'Community Tax Certificate issued based on declared income.',
   'document', 11, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'formula', 5, NULL, '₱5.00 base + ₱1.00 per ₱1,000 income',
   '15 minutes', 'Treasurer / Revenue Collector', 'Treasury Office', 'documents-certifications'),
  ('business-endorsement', 'Business Endorsement',
   'Barangay endorsement for businesses with DTI Business Registration.',
   'document', 12, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'free', 0, 0, 'None',
   '5 minutes', 'Secretariat Encoder', 'Treasury Office', 'business-property'),
  ('lot-certification-building-renovation', 'Lot Certification for Building/Renovation Clearance',
   'Certification for building or renovation clearance; includes an inspection.',
   'document', 13, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'range', 200, 300, '₱200–₱300',
   '3 working days', 'Secretariat Encoder / Kagawad Committee on Land Matters', 'Treasury Office', 'business-property'),
  ('franchise-clearance', 'Franchise Clearance',
   'Clearance for vehicle franchises based on OR/CR.',
   'document', 14, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'fixed', 150, 150, '₱150',
   '10 minutes', 'Secretariat Encoder', 'Treasury Office', 'business-property'),
  ('motor-banca-clearance', 'Motor Banca Clearance',
   'Clearance for motor bancas operating within the barangay.',
   'document', 15, TRUE,
   'treasury', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'fixed', 200, 200, '₱200',
   '10 minutes', 'Secretariat Encoder', 'Treasury Office', 'business-property')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2b. SECRETARIAT OFFICE (Charter Section 8) - Classification: Simple - G2C/G2B/G2G
--     Note: 'indigency' and 'certificate-residency' already exist; enriched here.
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('indigency', 'Certificate of Indigency',
   'Certifies that the applicant is indigent; for residents of Barangay Barretto.',
   'document', 5, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'Residents of Barangay Barretto',
   'free', 0, 0, 'None',
   '5 minutes', 'Secretariat Clerk', 'Secretariat Office', 'documents-certifications'),
  ('certificate-residency', 'Certificate of Residency',
   'Certifies that the applicant is a resident of Barangay Barretto.',
   'document', 2, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'Residents of Barangay Barretto',
   'range', 50, 60, '₱50–₱60',
   '5 minutes', 'Secretariat Clerk', 'Secretariat Office', 'documents-certifications'),
  ('certificate-of-actual-occupancy', 'Certificate of Actual Occupancy',
   'Certifies actual occupancy of a lot; for Power Line, Water Line, or Tax Declaration purposes.',
   'document', 7, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'All',
   'fixed', 50, 50, '₱50',
   '5–10 minutes', 'Secretariat Clerk', 'Secretariat Office', 'business-property'),
  ('first-time-job-seeker-certification', 'First-Time Job Seeker Certification',
   'Certification for first-time job seekers; for residents of Barangay Barretto.',
   'document', 8, TRUE,
   'secretariat', 'simple', ARRAY['G2C','G2B','G2G'], 'Residents of Barangay Barretto',
   'free', 0, 0, 'None',
   '5–10 minutes', 'Secretariat Clerk', 'Secretariat Office', 'documents-certifications')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2c. LUPONG TAGAPAMAYAPA / BARANGAY JUSTICE SYSTEM (Charter Section 9)
--     Highly Technical Transaction - G2C
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('lupon-dispute-settlement', 'Lupong Tagapamayapa Dispute Settlement',
   'Settles community disputes peacefully and outside court through mediation and conciliation (Katarungang Pambarangay).',
   'justice', 20, TRUE,
   'lupon', 'highly_technical', ARRAY['G2C'], 'Residents of the same barangay or adjacent barangays (Section 412, RA 7160)',
   'per_page', 50, NULL, '₱50 for the first three pages; ₱5 for every succeeding page',
   'Approximately 45 days and 10 minutes', 'Punong Barangay / Lupong Tagapamayapa', 'Lupong Tagapamayapa / Barangay Justice System', 'peace-security')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2d. COMMAND CENTER (Charter Section 10) - Classification: Simple - G2C
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('cctv-footage-access', 'CCTV Footage Access Request',
   'Request access to CCTV footage for investigation or incident review through the Command Center.',
   'document', 21, TRUE,
   'command-center', 'simple', ARRAY['G2C'], 'Residents or authorized personnel needing access to CCTV footage for investigation or incident review',
   'free', 0, 0, 'None',
   '10 minutes', 'Punong Barangay / Barangay Staff', 'Command Center', 'peace-security')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2e. BARANGAY HEALTH CENTER (Charter Section 11) - All services free of charge
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('medical-consultation-medicine', 'Medical Consultation and Dispensing of Medicine',
   'Medical consultation with prescription and dispensing of available medicine.',
   'health', 30, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '35 minutes (total)', 'Barangay Health Worker / RHU Doctor / Nurse / Health Staff', 'Barangay Health Center', 'health'),
  ('immunization-for-children', 'Immunization for Children',
   'Routine immunization for children, with growth check and immunization record updates.',
   'health', 31, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '25 minutes (total)', NULL, 'Barangay Health Center', 'health'),
  ('maternal-care-prenatal-checkup', 'Maternal Care and Prenatal Check-Up',
   'Prenatal check-up with physical examination, supplements, and health advice for pregnant mothers.',
   'health', 32, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '35 minutes (total)', NULL, 'Barangay Health Center', 'health'),
  ('family-planning', 'Family Planning',
   'Counseling, family planning education, contraceptive methods (pills, condoms, injectables), and responsible parenthood information.',
   'health', 33, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   NULL, NULL, 'Barangay Health Center', 'health'),
  ('tb-screening-treatment', 'Tuberculosis (TB) Screening and Treatment',
   'TB screening, sputum testing, and enrollment in DOTS with regular monitoring and medicine supervision.',
   'health', 34, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   'Approximately 3 days and 30 minutes, with ongoing weekly/monthly monitoring where applicable', NULL, 'Barangay Health Center', 'health'),
  ('minor-treatment-first-aid', 'Minor Treatment and First Aid',
   'Treatment for cuts, burns, bruises, fever, sprains, and other minor injuries or issues.',
   'health', 35, TRUE,
   'health-center', 'simple', ARRAY['G2C'], 'All',
   'free', 0, 0, 'None',
   '20 minutes', NULL, 'Barangay Health Center', 'health')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2f. BARANGAY BARRETTO FIRE AND RESCUE UNIT - BBFRU (Charter Sections 12-14)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('emergency-response-fire-rescue', 'Emergency Response (Fire, Rescue, Disaster)',
   'Fire suppression, rescue operations, and disaster response by the official emergency response team of Barangay Barretto.',
   'emergency', 40, TRUE,
   'bbfru', 'simple', ARRAY['G2C'], 'Any person or establishment within Barangay Barretto, Olongapo City',
   'free', 0, 0, 'None',
   'Response begins immediately', NULL, 'Barangay Barretto Fire and Rescue Unit (BBFRU)', 'emergency-rescue'),
  ('basic-life-support-training', 'Basic Life Support (BLS) Training',
   'Training on CPR, wound care, stabilization, basic first aid, and emergency response, with certificate of participation.',
   'program', 41, TRUE,
   'bbfru', 'simple', ARRAY['G2C'], 'Residents, students, barangay personnel, and interested individuals/groups within Barangay Barretto',
   'free', 0, 0, 'None',
   'Approximately 4 days and 35 minutes', NULL, 'Basic Life Support (BLS)', 'emergency-rescue'),
  ('tree-cutting-animal-rescue', 'Tree Cutting / Animal Rescue Assistance',
   'Assistance for fallen trees, hazardous branches, and trapped or endangered animals.',
   'emergency', 42, TRUE,
   'bbfru', 'simple', ARRAY['G2C'], 'Any person or establishment within Barangay Barretto, Olongapo City',
   'free', 0, 0, 'None',
   NULL, NULL, 'Tree Cutting / Animal Rescue Assistance', 'emergency-rescue')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2g. BARRETTO PEACEKEEPING ACTION TEAM - BPAT (Charter Section 15)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('bpat-peacekeeping-assistance', 'Peacekeeping Assistance (BPAT)',
   'Report concerns or suspicious activity; BPAT helps maintain peace, order, and public safety.',
   'emergency', 50, TRUE,
   'bpat', 'simple', ARRAY['G2C'], 'Residents, business owners, and visitors within Barangay Barretto',
   'free', 0, 0, 'None',
   'Approximately 45 minutes, with immediate initial response', NULL, 'Barretto Peacekeeping Action Team (BPAT)', 'peace-security')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2h. CHILD DEVELOPMENT CENTER - CDC (Charter Section 16)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('cdc-enrollment', 'Child Development Center (CDC) Enrollment',
   'Early childhood care and development services addressing health, nutrition, early education, and social development for children aged 0–4 years.',
   'program', 60, TRUE,
   'cdc', 'simple', ARRAY['G2C'], 'Children aged 0–4 years (through a parent or guardian)',
   'free', 0, 0, 'None',
   NULL, NULL, 'Child Development Center (CDC)', 'child-development')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- 2i. COMMUNITY-BASED LEARNING AND LITERACY PROGRAM / BBLC (Charter Section 17)
-- ---------------------------------------------------------------------------
INSERT INTO public.service_categories (slug, title, description, category_type, sort_order, is_active,
  office_key, classification, transaction_types, who_may_avail,
  fee_type, fee_amount_min, fee_amount_max, fee_description,
  processing_time_text, responsible_personnel, charter_section, directory_category)
VALUES
  ('bblc-training-programs', 'BBLC Vocational Training and Literacy Programs',
   'TESDA-accredited vocational training and practical skills for employment and entrepreneurship; programs may include literacy, numeracy, livelihood, continuing education, and vocational training.',
   'program', 61, TRUE,
   'bblc', 'simple', ARRAY['G2C'], 'Out-of-school youth, adult learners, unemployed residents, and interested individuals in Barangay Barretto',
   'range', 1000, 5000, '₱1,000–₱5,000 depending on course',
   'Approximately 6 months, 15 days, and 45 minutes', NULL, 'Community-Based Learning and Literacy Program / BBLC', 'education-training')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, description = EXCLUDED.description, category_type = EXCLUDED.category_type,
  sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active,
  office_key = EXCLUDED.office_key, classification = EXCLUDED.classification,
  transaction_types = EXCLUDED.transaction_types, who_may_avail = EXCLUDED.who_may_avail,
  fee_type = EXCLUDED.fee_type, fee_amount_min = EXCLUDED.fee_amount_min,
  fee_amount_max = EXCLUDED.fee_amount_max, fee_description = EXCLUDED.fee_description,
  processing_time_text = EXCLUDED.processing_time_text,
  responsible_personnel = EXCLUDED.responsible_personnel,
  charter_section = EXCLUDED.charter_section, directory_category = EXCLUDED.directory_category,
  updated_at = NOW();

-- ============================================================================
-- 3. REQUIREMENTS (exact labels from the charter checklists)
-- ============================================================================
DELETE FROM public.service_category_requirements
WHERE service_category_id IN (
  SELECT id FROM public.service_categories WHERE slug IN (
    'record-clearance','cedula-community-tax-certificate','business-endorsement',
    'lot-certification-building-renovation','franchise-clearance','motor-banca-clearance',
    'indigency','certificate-residency','certificate-of-actual-occupancy',
    'first-time-job-seeker-certification','lupon-dispute-settlement','cctv-footage-access',
    'medical-consultation-medicine','immunization-for-children','maternal-care-prenatal-checkup',
    'family-planning','tb-screening-treatment','minor-treatment-first-aid',
    'emergency-response-fire-rescue','basic-life-support-training','tree-cutting-animal-rescue',
    'bpat-peacekeeping-assistance','cdc-enrollment','bblc-training-programs'
  )
);

INSERT INTO public.service_category_requirements (service_category_id, requirement_key, requirement_label, is_required, sort_order)
SELECT c.id, r.requirement_key, r.requirement_label, r.is_required, r.sort_order
FROM public.service_categories c
JOIN (VALUES
  -- Treasury Office
  ('record-clearance', 'request_slip_or_valid_id', 'Request slip or valid government-issued ID', TRUE, 1),
  ('cedula-community-tax-certificate', 'valid_government_id', 'Valid government-issued ID', TRUE, 1),
  ('cedula-community-tax-certificate', 'source_of_income', 'Source of income or employer information', TRUE, 2),
  ('cedula-community-tax-certificate', 'estimated_gross_income', 'Estimated gross income (for self-employed/professionals)', TRUE, 3),
  ('business-endorsement', 'dti_business_registration', 'DTI Business Registration', TRUE, 1),
  ('lot-certification-building-renovation', 'waiver_of_rights_or_deed_of_sale', 'Waiver of Rights / Deed of Sale', TRUE, 1),
  ('lot-certification-building-renovation', 'tax_declaration_latest_payment', 'Tax Declaration with latest payment', TRUE, 2),
  ('lot-certification-building-renovation', 'lot_plan', 'Lot Plan', TRUE, 3),
  ('lot-certification-building-renovation', 'msa', 'MSA (Miscellaneous Sales Application)', TRUE, 4),
  ('franchise-clearance', 'or_cr_of_vehicle', 'OR/CR of vehicle', TRUE, 1),
  ('motor-banca-clearance', 'application', 'Application', TRUE, 1),
  ('motor-banca-clearance', 'supporting_documents', 'Supporting documents', TRUE, 2),
  ('motor-banca-clearance', 'motor_banca_specification', 'Specification of Motor Banca', TRUE, 3),
  -- Secretariat Office
  ('indigency', 'request_slip', 'Request Slip', TRUE, 1),
  ('indigency', 'residency', 'Must be a resident of Barangay Barretto', TRUE, 2),
  ('certificate-residency', 'request_slip', 'Request Slip', TRUE, 1),
  ('certificate-residency', 'residency', 'Must be a resident of Barangay Barretto', TRUE, 2),
  ('certificate-of-actual-occupancy', 'waiver_of_rights_or_deed_of_sale', 'Waiver of Rights / Deed of Sale', TRUE, 1),
  ('certificate-of-actual-occupancy', 'tax_declaration_latest_payment', 'Tax Declaration with latest payment', TRUE, 2),
  ('first-time-job-seeker-certification', 'ftjs_form', 'Duly accomplished FTJS Form', TRUE, 1),
  ('first-time-job-seeker-certification', 'residency', 'Must be a resident of Barangay Barretto', TRUE, 2)
) AS r(service_slug, requirement_key, requirement_label, is_required, sort_order)
  ON r.service_slug = c.slug;

INSERT INTO public.service_category_requirements (service_category_id, requirement_key, requirement_label, is_required, sort_order)
SELECT c.id, r.requirement_key, r.requirement_label, r.is_required, r.sort_order
FROM public.service_categories c
JOIN (VALUES
  -- Lupong Tagapamayapa
  ('lupon-dispute-settlement', 'written_complaint', 'Written Complaint', TRUE, 1),
  ('lupon-dispute-settlement', 'valid_government_id', 'Valid Government-Issued ID', TRUE, 2),
  ('lupon-dispute-settlement', 'barangay_certificate', 'Barangay Certificate', FALSE, 3),
  -- Command Center
  ('cctv-footage-access', 'police_or_bpat_blotter', 'Police or BPAT Blotter / Incident Report, if applicable', FALSE, 1),
  -- Barangay Health Center
  ('medical-consultation-medicine', 'philhealth_id', 'PhilHealth ID', TRUE, 1),
  ('medical-consultation-medicine', 'patient_health_record', 'Patient Health Record, if existing', FALSE, 2),
  ('immunization-for-children', 'child_birth_certificate_or_health_record', 'Child''s Birth Certificate or Health Record', TRUE, 1),
  ('immunization-for-children', 'immunization_card', 'Immunization Card, if applicable', FALSE, 2),
  ('maternal-care-prenatal-checkup', 'pregnant_mothers_health_record', 'Pregnant Mother''s Health Record', TRUE, 1),
  ('maternal-care-prenatal-checkup', 'philhealth_id', 'PhilHealth ID, if applicable', FALSE, 2),
  ('tb-screening-treatment', 'referral_form', 'Referral Form, if from RHU', FALSE, 1),
  ('tb-screening-treatment', 'philhealth_id', 'PhilHealth ID, if applicable', FALSE, 2),
  ('tb-screening-treatment', 'tb_sputum_test_result', 'TB Sputum Test Result, if available', FALSE, 3),
  ('minor-treatment-first-aid', 'patient_record', 'Patient Record, if on file', FALSE, 1)
) AS r(service_slug, requirement_key, requirement_label, is_required, sort_order)
  ON r.service_slug = c.slug;


INSERT INTO public.service_category_requirements (service_category_id, requirement_key, requirement_label, is_required, sort_order)
SELECT c.id, r.requirement_key, r.requirement_label, r.is_required, r.sort_order
FROM public.service_categories c
JOIN (VALUES
  -- BBFRU
  ('emergency-response-fire-rescue', 'exact_location', 'Exact location of incident', TRUE, 1),
  ('emergency-response-fire-rescue', 'nature_of_emergency', 'Nature of emergency (fire, trapped person, disaster, etc.)', TRUE, 2),
  ('emergency-response-fire-rescue', 'contact_information', 'Contact information', FALSE, 3),
  ('basic-life-support-training', 'letter_of_request_or_registration_form', 'Letter of request or registration form', TRUE, 1),
  ('basic-life-support-training', 'waiver_or_consent', 'Waiver or consent form, if required', FALSE, 2),
  ('tree-cutting-animal-rescue', 'exact_location', 'Exact location', TRUE, 1),
  ('tree-cutting-animal-rescue', 'situation_description', 'Description of situation', TRUE, 2),
  ('tree-cutting-animal-rescue', 'property_owner_consent', 'Property owner consent, if needed', FALSE, 3),
  -- BPAT
  ('bpat-peacekeeping-assistance', 'incident_details', 'Details of incident or concern', TRUE, 1),
  ('bpat-peacekeeping-assistance', 'location_and_description', 'Location and description of person/activity', TRUE, 2),
  ('bpat-peacekeeping-assistance', 'contact_information', 'Contact information', FALSE, 3),
  -- Child Development Center
  ('cdc-enrollment', 'cdc_enrollment_form', 'Duly accomplished CDC enrollment form', TRUE, 1),
  ('cdc-enrollment', 'child_birth_certificate', 'Child''s Birth Certificate (photocopy)', TRUE, 2),
  ('cdc-enrollment', 'barangay_certificate_of_residency', 'Barangay Certificate of Residency for child', TRUE, 3),
  ('cdc-enrollment', 'updated_immunization_record', 'Updated immunization record', TRUE, 4),
  ('cdc-enrollment', 'two_id_photos', 'Two 1x1 ID photos of child', TRUE, 5),
  ('cdc-enrollment', 'parent_guardian_valid_id', 'Parent/guardian valid ID photocopy', TRUE, 6),
  -- BBLC
  ('bblc-training-programs', 'registration_form', 'Accomplished registration form', TRUE, 1),
  ('bblc-training-programs', 'comelec_registration', 'Comelec Registration Slip/ID', TRUE, 2)
) AS r(service_slug, requirement_key, requirement_label, is_required, sort_order)
  ON r.service_slug = c.slug;


-- ============================================================================
-- 4. SERVICE STEPS (official process from the charter; actor: client/agency)
-- ============================================================================
DELETE FROM public.service_steps
WHERE service_category_id IN (
  SELECT id FROM public.service_categories WHERE slug IN (
    'lot-certification-building-renovation','lupon-dispute-settlement','cctv-footage-access',
    'medical-consultation-medicine','immunization-for-children','maternal-care-prenatal-checkup',
    'family-planning','tb-screening-treatment','minor-treatment-first-aid',
    'emergency-response-fire-rescue','basic-life-support-training','tree-cutting-animal-rescue',
    'bpat-peacekeeping-assistance','cdc-enrollment','bblc-training-programs'
  )
);

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  ('lot-certification-building-renovation', 1, 'client', 'Submit application form and documents'),
  ('lot-certification-building-renovation', 2, 'client', 'Wait for inspection'),
  -- Lupong Tagapamayapa
  ('lupon-dispute-settlement', 1, 'client', 'File a written complaint at the barangay hall'),
  ('lupon-dispute-settlement', 2, 'agency', 'Secretary records the complaint'),
  ('lupon-dispute-settlement', 3, 'agency', 'Punong Barangay contacts the respondent within 3 days'),
  ('lupon-dispute-settlement', 4, 'client', 'Attend the mediation hearing with the Punong Barangay'),
  ('lupon-dispute-settlement', 5, 'client', 'If unresolved, attend conciliation with the Pangkat ng Tagapagkasundo'),
  ('lupon-dispute-settlement', 6, 'agency', 'Pangkat conducts hearings within 15 days'),
  ('lupon-dispute-settlement', 7, 'agency', 'Settlement agreement is drafted if both parties agree'),
  ('lupon-dispute-settlement', 8, 'client', 'If no settlement is reached, obtain a Certificate to File Action')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- Command Center
  ('cctv-footage-access', 1, 'client', 'Go to the Command Center and request access to CCTV footage'),
  ('cctv-footage-access', 2, 'agency', 'Staff verify identity and purpose; check footage availability'),
  ('cctv-footage-access', 3, 'agency', 'If approved, footage is viewed or released'),
  -- Medical Consultation and Dispensing of Medicine
  ('medical-consultation-medicine', 1, 'client', 'Register and fill out the Patient Information Form'),
  ('medical-consultation-medicine', 2, 'agency', 'Health worker records vital signs'),
  ('medical-consultation-medicine', 3, 'client', 'Wait for the consultation'),
  ('medical-consultation-medicine', 4, 'agency', 'Doctor or nurse conducts the check-up and prescribes medicine'),
  ('medical-consultation-medicine', 5, 'client', 'Proceed to the medicine dispensing area'),
  ('medical-consultation-medicine', 6, 'agency', 'Medicine is dispensed with instructions'),
  ('medical-consultation-medicine', 7, 'client', 'Sign the acknowledgment form'),
  ('medical-consultation-medicine', 8, 'agency', 'Consultation is recorded in the patient logbook'),
  ('medical-consultation-medicine', 9, 'agency', 'Documents are filed for future reference'),
  -- Immunization for Children
  ('immunization-for-children', 1, 'client', 'Register the child''s information at the health center'),
  ('immunization-for-children', 2, 'agency', 'Verify immunization history'),
  ('immunization-for-children', 3, 'agency', 'Administer the vaccine as scheduled'),
  ('immunization-for-children', 4, 'agency', 'Record the vaccination in the immunization card'),
  ('immunization-for-children', 5, 'agency', 'Monitor the child briefly for side effects'),
  ('immunization-for-children', 6, 'agency', 'Issue the schedule for the next vaccination')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- Maternal Care and Prenatal Check-Up
  ('maternal-care-prenatal-checkup', 1, 'client', 'Register and present the health record'),
  ('maternal-care-prenatal-checkup', 2, 'agency', 'Health worker checks blood pressure and weight'),
  ('maternal-care-prenatal-checkup', 3, 'client', 'Proceed to the consultation room'),
  ('maternal-care-prenatal-checkup', 4, 'agency', 'Midwife or nurse conducts the physical exam and monitors the pregnancy'),
  ('maternal-care-prenatal-checkup', 5, 'agency', 'Iron and folic acid supplements are provided'),
  ('maternal-care-prenatal-checkup', 6, 'agency', 'Consultation is recorded in the health record'),
  ('maternal-care-prenatal-checkup', 7, 'client', 'Receive advice and the schedule for the next check-up'),
  ('maternal-care-prenatal-checkup', 8, 'agency', 'Updated record is filed'),
  -- Family Planning
  ('family-planning', 1, 'client', 'Register at the health center'),
  ('family-planning', 2, 'agency', 'Health worker conducts counseling and explains family planning methods'),
  ('family-planning', 3, 'client', 'Select the preferred method with guidance'),
  ('family-planning', 4, 'agency', 'Family planning supplies are provided'),
  ('family-planning', 5, 'agency', 'Visit is recorded in the family planning logbook'),
  ('family-planning', 6, 'client', 'Receive instructions for use and follow-up'),
  ('family-planning', 7, 'agency', 'Follow-up visit is scheduled'),
  -- TB Screening and Treatment
  ('tb-screening-treatment', 1, 'client', 'Register and submit the referral form, if available'),
  ('tb-screening-treatment', 2, 'agency', 'Health worker screens the patient'),
  ('tb-screening-treatment', 3, 'client', 'Undergo a sputum test'),
  ('tb-screening-treatment', 4, 'agency', 'Sample is sent to the laboratory (about 2 days)'),
  ('tb-screening-treatment', 5, 'agency', 'If positive, the patient is enrolled in DOTS (Directly Observed Treatment, Short-course)'),
  ('tb-screening-treatment', 6, 'client', 'Receive the schedule for treatment and monitoring'),
  ('tb-screening-treatment', 7, 'agency', 'First dose is administered and recorded'),
  ('tb-screening-treatment', 8, 'agency', 'Regular monitoring is conducted (weekly/monthly)'),
  ('tb-screening-treatment', 9, 'agency', 'Completion of the medicine regimen is supervised'),
  -- Minor Treatment and First Aid
  ('minor-treatment-first-aid', 1, 'client', 'Register and describe the injury'),
  ('minor-treatment-first-aid', 2, 'agency', 'Health worker assesses the condition'),
  ('minor-treatment-first-aid', 3, 'agency', 'First aid is administered'),
  ('minor-treatment-first-aid', 4, 'agency', 'Treatment is recorded in the logbook'),
  ('minor-treatment-first-aid', 5, 'client', 'Receive instructions for home care'),
  ('minor-treatment-first-aid', 6, 'agency', 'Follow-up is advised if needed'),
  ('minor-treatment-first-aid', 7, 'agency', 'Referral to the RHU or hospital is made if necessary')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- BBFRU Emergency Response
  ('emergency-response-fire-rescue', 1, 'client', 'Call the BBFRU Hotline 0946-214-2438 or 911'),
  ('emergency-response-fire-rescue', 2, 'agency', 'Dispatcher verifies the nature and location of the emergency'),
  ('emergency-response-fire-rescue', 3, 'agency', 'Emergency team is dispatched with equipment'),
  ('emergency-response-fire-rescue', 4, 'agency', 'Firefighters respond at the scene'),
  ('emergency-response-fire-rescue', 5, 'agency', 'Stabilization and rescue are performed'),
  ('emergency-response-fire-rescue', 6, 'agency', 'Incident report is submitted to the barangay'),
  -- Basic Life Support Training
  ('basic-life-support-training', 1, 'client', 'Submit a training request'),
  ('basic-life-support-training', 2, 'agency', 'BBFRU confirms the schedule'),
  ('basic-life-support-training', 3, 'client', 'Attend the BLS training session'),
  ('basic-life-support-training', 4, 'agency', 'Practical and lecture sessions are conducted'),
  ('basic-life-support-training', 5, 'agency', 'Certificate of participation is issued'),
  -- Tree Cutting / Animal Rescue
  ('tree-cutting-animal-rescue', 1, 'client', 'Report the situation (exact location and description)'),
  ('tree-cutting-animal-rescue', 2, 'agency', 'BBFRU assesses the request'),
  ('tree-cutting-animal-rescue', 3, 'agency', 'Team is deployed with equipment'),
  ('tree-cutting-animal-rescue', 4, 'agency', 'Assistance or rescue is carried out'),
  ('tree-cutting-animal-rescue', 5, 'agency', 'Area is secured and the report is submitted'),
  ('tree-cutting-animal-rescue', 6, 'client', 'Provide property owner consent, if needed')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

INSERT INTO public.service_steps (service_category_id, step_number, actor, description)
SELECT c.id, s.step_number, s.actor, s.description
FROM public.service_categories c
JOIN (VALUES
  -- BPAT Peacekeeping Assistance
  ('bpat-peacekeeping-assistance', 1, 'client', 'Call the BPAT hotline 0938-949-5840 or report to the barangay hall'),
  ('bpat-peacekeeping-assistance', 2, 'agency', 'BPAT personnel verify the report details'),
  ('bpat-peacekeeping-assistance', 3, 'agency', 'Patrol team is dispatched to the location (immediate)'),
  ('bpat-peacekeeping-assistance', 4, 'agency', 'Concern is investigated and assistance is provided'),
  ('bpat-peacekeeping-assistance', 5, 'agency', 'Incident report is filed'),
  -- Child Development Center Enrollment
  ('cdc-enrollment', 1, 'client', 'Proceed to the CDC; the parent/guardian submits the requirements'),
  ('cdc-enrollment', 2, 'agency', 'CDC worker checks the completeness of the documents'),
  ('cdc-enrollment', 3, 'client', 'Accomplish the enrollment form'),
  ('cdc-enrollment', 4, 'agency', 'CDC worker validates the information and records the child''s data'),
  ('cdc-enrollment', 5, 'agency', 'Assessment of the child''s age and developmental stage'),
  ('cdc-enrollment', 6, 'agency', 'Schedule for orientation is given to the parent'),
  ('cdc-enrollment', 7, 'client', 'Attend the parent orientation session'),
  ('cdc-enrollment', 8, 'agency', 'Child is officially enrolled in the CDC program'),
  ('cdc-enrollment', 9, 'agency', 'Records are forwarded to the barangay for documentation'),
  -- BBLC Training Programs
  ('bblc-training-programs', 1, 'client', 'Inquire about available programs'),
  ('bblc-training-programs', 2, 'agency', 'BBLC staff provide the program list and requirements'),
  ('bblc-training-programs', 3, 'client', 'Submit the accomplished registration form and documents'),
  ('bblc-training-programs', 4, 'agency', 'Eligibility is verified and assessed'),
  ('bblc-training-programs', 5, 'client', 'Attend the orientation session'),
  ('bblc-training-programs', 6, 'agency', 'Classes and training sessions are scheduled'),
  ('bblc-training-programs', 7, 'client', 'Participate in the training modules and activities'),
  ('bblc-training-programs', 8, 'agency', 'Progress is monitored and a certificate is issued upon completion')
) AS s(service_slug, step_number, actor, description)
  ON s.service_slug = c.slug;

-- ============================================================================
-- 5. SYSTEM SETTINGS: charter identity (versioned, editable from admin settings)
-- ============================================================================
INSERT INTO public.system_settings (setting_key, value)
VALUES
  ('barangay_identity', '{"name":"Barangay Barretto","city":"Olongapo City","address":"#3 Ilo-Ilo Street, Barretto, Olongapo City","phone":"222-1451 / 222-4295","email":"barangaybarretto00@gmail.com","vision":"A barangay with sufficient income, transparent governance, and active citizen participation.","mission":"Deliver transparent, efficient, and citizen-centered public service."}'),
  ('service_pledge', '{"pledge":"We, the officials and employees of Barangay Barretto, pledge to deliver public services with transparency, efficiency, and citizen-centered governance, in accordance with the standards set in this Citizen''s Charter."}'),
  ('charter_version', '{"title":"Barangay Barretto Citizen''s Charter","edition":"2025 - 1st Edition","legal_basis":"Republic Act No. 11032 (Ease of Doing Business and Efficient Government Service Delivery Act of 2018)"}')
ON CONFLICT (setting_key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
