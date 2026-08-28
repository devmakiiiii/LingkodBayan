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
  + '--- Migration 16: Verification Schema ---\n'
  + readMigrationFile('16_add_verification_schema.sql')
  + '\n'
  + '--- Migration 17: ID Documents Storage Bucket ---\n'
  + readMigrationFile('17_create_verification_buckets.sql')
  + '\n'
  + '--- Migration 18: Add Archived Status to Officials ---\n'
  + readMigrationFile('18_add_archived_status_to_officials.sql');
console.log(sql);

console.log('\n---END SQL---\n');
console.log('5. Click "Run" or press Ctrl+Enter to execute the SQL\n');
console.log('6. Once complete, your database will be ready for the app!\n');
console.log('================================\n');
