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

const sql = readMigrationScript();
console.log(sql);

console.log('\n---END SQL---\n');
console.log('5. Click "Run" or press Ctrl+Enter to execute the SQL\n');
console.log('6. Once complete, your database will be ready for the app!\n');
console.log('================================\n');
