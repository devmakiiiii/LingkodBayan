#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readMigrationScript() {
  const sqlPath = path.join(__dirname, '01_create_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  return sql;
}

function readMigrationFile(filename) {
  const sqlPath = path.join(__dirname, filename);
  if (fs.existsSync(sqlPath)) {
    return fs.readFileSync(sqlPath, 'utf-8');
  }
  return `-- ${filename} not found, skipping`;
}

console.log('\n================================');
console.log('LingkodBayan Database Setup');
console.log('================================\n');

console.log('To complete the database setup, please:\n');
console.log('1. Go to your Supabase project dashboard');
console.log('   URL: https://app.supabase.com\n');
console.log('2. Navigate to "SQL Editor" in the left sidebar\n');
console.log('3. Click "New Query" to create a new SQL query\n');
console.log('4. Copy and paste the following SQL script:\n');
console.log('---BEGIN SQL---\n');

const sql = readMigrationScript()
  + '\n'
  + '--- Migration 02: Add Geolocation & Complaint Messages ---\n'
  + readMigrationFile('02_add_geolocation.sql')
  + '\n'
  + '--- Migration 03: Fix Residents RLS (Insert Policy) ---\n'
  + readMigrationFile('03_fix_residents_rls.sql')
  + '\n'
  + '--- Migration 04: Add Request Payload ---\n'
  + readMigrationFile('04_add_request_payload.sql')
  + '\n'
  + '--- Migration 05: Officials & Designations (tables + RLS policies) ---\n'
  + readMigrationFile('05_add_officials_designations.sql')
  + '\n'
  + '--- Migration 06: System Settings & Service Categories ---\n'
  + readMigrationFile('06_add_system_settings.sql')
  + '\n'
  + '--- Migration 07: Seed Service Categories ---\n'
  + readMigrationFile('07_seed_service_categories.sql')
  + '\n'
  + '--- Migration 11: Add Resident Report Fields ---\n'
  + readMigrationFile('11_add_resident_report_fields.sql')
  + '\n'
  + '--- Migration 12: Fix Admin Update Complaints & Messages ---\n'
  + readMigrationFile('12_fix_admin_update_complaints.sql')
  + '\n'
  + '--- Migration 13: Add Evidence URL to Complaints ---\n'
  + readMigrationFile('13_add_evidence_url_to_complaints.sql')
  + '\n'
  + '--- Migration 14: Add Image URL & Excerpt to Announcements ---\n'
  + readMigrationFile('14_add_image_url_to_announcements.sql')
  + '\n'
  + '--- Migration 15: Add Excerpt to Announcements (idempotent) ---\n'
  + readMigrationFile('15_add_excerpt_to_announcements.sql')
  + '\n'
  + '--- Migration 16: Verification Schema ---\n'
  + readMigrationFile('16_add_verification_schema.sql')
  + '\n'
  + '--- Migration 17: ID Documents Storage Bucket ---\n'
  + readMigrationFile('17_create_verification_buckets.sql')
  + '\n'
  + '--- Migration 17b: Announcement Images Storage Bucket ---\n'
  + readMigrationFile('17_create_announcement_images_bucket.sql')
  + '\n'
  + '--- Migration 18: Add Archived Status to Officials ---\n'
  + readMigrationFile('18_add_archived_status_to_officials.sql')
  + '\n'
  + '--- Migration 19: Add Date of Birth to Residents ---\n'
  + readMigrationFile('19_add_date_of_birth_to_residents.sql')
  + '\n'
  + '--- Migration 20: Audit Logs ---\n'
  + readMigrationFile('20_create_audit_logs.sql')
  + '\n'
  + '--- Migration 21: Assign Officials to Requests (workload balancing) ---\n'
  + readMigrationFile('21_add_assigned_official_to_requests.sql')
  + '\n'
  + '--- Migration 22: Citizen\'s Charter 2025 Schema Extensions ---\n'
  + readMigrationFile('22_add_charter_schema.sql')
  + '\n'
  + '--- Migration 23: Seed Citizen\'s Charter 2025 Data ---\n'
  + readMigrationFile('23_seed_charter_data.sql')
  + '\n'
  + '--- Migration 24: Save Requests With Payments ---\n'
  + readMigrationFile('24_add_request_payments.sql')
  + '\n'
  + '--- Migration 25: Fix verification_attempts RLS (INSERT/UPDATE) ---\n'
  + readMigrationFile('25_fix_verification_attempts_rls.sql')
  + '\n'
  + '--- Migration 26: Add published_at to Announcements ---\n'
  + readMigrationFile('26_add_announcement_publishing.sql')
  + '\n'
  + '--- Migration 27: Announcement Pinning & Expiry ---\n'
  + readMigrationFile('27_add_announcement_pinning_and_expiry.sql')
  + '\n'
  + '--- Migration 28: Retire Inactive Officials Status ---\n'
  + readMigrationFile('28_retire_inactive_officials_status.sql')
  + '\n'
  + '--- Migration 29: User Notifications ---\n'
  + readMigrationFile('29_add_user_notifications.sql')
  + '\n'
  + '--- Migration 30: Representative Authorizations (proxy filing) ---\n'
  + readMigrationFile('30_add_representative_authorizations.sql')
  + '\n'
  + '--- Migration 31: Document Pickups (clearance claiming) ---\n'
  + readMigrationFile('31_add_document_pickups.sql')
  + '\n'
  + '--- Migration 32: Duplicate Resident Prevention ---\n'
  + readMigrationFile('32_add_duplicate_prevention.sql')
  + '\n'
  + '--- Migration 33: Durable Rate Limiting ---\n'
  + readMigrationFile('33_rate_limits.sql')
  + '\n'
  + '--- Migration 34: Single-Barangay Deployment (Barangay Barretto) ---\n'
  + readMigrationFile('34_single_barangay_barretto.sql')
  + '\n'
  + '--- Migration 35: Durable OCR Job Store ---\n'
  + readMigrationFile('35_durable_ocr_jobs.sql')
  + '\n'
  + '--- Migration 36: Verification Gate on Request Filing ---\n'
  + readMigrationFile('36_verification_gate_requests.sql')
  + '\n'
  + '--- Migration 37: Backfill Verification Claim ---\n'
  + readMigrationFile('37_backfill_verification_claim.sql')
  + '\n'
  + '--- Migration 38: Fix Proxy Party Names ---\n'
  + readMigrationFile('38_fix_proxy_party_names.sql')
  + '\n'
  + '--- Migration 39: Harden Admin Authorization (drop user_metadata trust) ---\n'
  + readMigrationFile('39_harden_admin_authorization.sql')
  + '\n'
  + '--- Migration 40: Pre-Registered Residents Without Email ---\n'
  + readMigrationFile('40_pre_registered_residents_optional_email.sql')
  + '\n'
  + '--- Migration 41: Structured Name Parts on Officials ---\n'
  + readMigrationFile('41_add_official_name_parts.sql')
  + '\n'
  + '--- Migration 42: Rename Designation priority_order to rank + auto-assign ---\n'
  + readMigrationFile('42_auto_designation_priority.sql')
  + '\n'
  + '--- Migration 43: Derive Designation Badge Color From Category ---\n'
  + readMigrationFile('43_derive_designation_badge_color.sql')
  + '\n'
  + '--- Finalize Complaints Schema ---\n'
  + readMigrationFile('finalize_complaints_schema.sql');
console.log(sql);

console.log('\n---END SQL---\n');
console.log('5. Click "Run" or press Ctrl+Enter to execute the SQL\n');
console.log('6. Once complete, your database will be ready for the app!\n');
console.log('================================\n');
