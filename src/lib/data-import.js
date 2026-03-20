// ============================================================
// src/lib/data-import.js — Excel/CSV Import Utility
// ============================================================
// Run this script to import your voter Excel data into Supabase
// Usage: node src/lib/data-import.js path/to/voters.xlsx
// ============================================================

// NOTE: This is a Node.js script — run it outside the browser
// Install dependencies first: npm install xlsx @supabase/supabase-js dotenv

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service role for imports
);

// Column mapping from your Excel to database columns
const COLUMN_MAP = {
  'roll': 'sr_no',
  'sr': 'sr_no',
  'sr_no': 'sr_no',
  'co': 'year',
  'year': 'year',
  'name': 'name',
  'sex': 'sex',
  'mobile': 'mobile',
  'add': 'address',
  'address': 'address',
  'ta': 'taluka',
  'taluka': 'taluka',
  'dist': 'district',
  'district': 'district',
  'cluster bar': 'cluster_bar',
  'cluster_bar': 'cluster_bar',
  'booth name': 'booth_name',
  'booth_name': 'booth_name',
  'bar': 'bar_association',
  'bar_association': 'bar_association',
  'enrolment': 'enrolment',
  'enrollment': 'enrolment',
  'enrolment no': 'enrolment',
};

function normalizeColumnName(col) {
  const lower = col.toLowerCase().trim();
  return COLUMN_MAP[lower] || lower;
}

function extractEnrolment(row) {
  // If there's a dedicated enrolment column, use it
  for (const key of Object.keys(row)) {
    const normalized = normalizeColumnName(key);
    if (normalized === 'enrolment' && row[key]) return String(row[key]).trim();
  }
  // Otherwise look for the second column (typically enrolment in your data)
  return null;
}

async function importExcel(filePath) {
  console.log(`\n📂 Reading file: ${filePath}`);
  
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet);
  
  console.log(`📊 Found ${rawData.length} rows in sheet "${sheetName}"`);
  console.log(`📋 Columns: ${Object.keys(rawData[0] || {}).join(', ')}`);

  // Map columns
  const voters = rawData.map((row, idx) => {
    const mapped = {};
    
    for (const [key, value] of Object.entries(row)) {
      const dbCol = normalizeColumnName(key);
      if (dbCol && value !== undefined && value !== null) {
        mapped[dbCol] = String(value).trim();
      }
    }

    // Ensure sr_no is a number
    if (mapped.sr_no) mapped.sr_no = parseInt(mapped.sr_no) || idx + 1;
    if (mapped.year) mapped.year = parseInt(mapped.year) || null;
    
    // Clean mobile number
    if (mapped.mobile) {
      mapped.mobile = String(mapped.mobile).replace(/\D/g, '');
      if (mapped.mobile.length < 10) mapped.mobile = null;
    }

    // Sex normalization
    if (mapped.sex) {
      const s = mapped.sex.charAt(0).toUpperCase();
      mapped.sex = s === 'M' ? 'Male' : s === 'F' ? 'Female' : 'Other';
    }

    return mapped;
  }).filter(v => v.enrolment && v.name); // Must have enrolment and name

  console.log(`✅ ${voters.length} valid voter records mapped`);

  // Insert in batches of 500
  const BATCH_SIZE = 500;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < voters.length; i += BATCH_SIZE) {
    const batch = voters.slice(i, i + BATCH_SIZE);
    
    const { data, error } = await supabase
      .from('voters')
      .upsert(batch, { onConflict: 'enrolment', ignoreDuplicates: false })
      .select('id');

    if (error) {
      console.error(`❌ Batch ${Math.floor(i/BATCH_SIZE) + 1} error:`, error.message);
      errors += batch.length;
      
      // Try individual inserts for the failed batch
      for (const voter of batch) {
        const { error: singleErr } = await supabase
          .from('voters')
          .upsert(voter, { onConflict: 'enrolment' });
        if (singleErr) {
          console.error(`  ❌ Failed: ${voter.enrolment} — ${singleErr.message}`);
        } else {
          inserted++;
          errors--;
        }
      }
    } else {
      inserted += (data?.length || batch.length);
    }

    const pct = Math.round(((i + batch.length) / voters.length) * 100);
    process.stdout.write(`\r⏳ Progress: ${pct}% (${inserted} inserted, ${errors} errors)`);
  }

  console.log(`\n\n🎉 Import complete!`);
  console.log(`   ✅ Inserted/updated: ${inserted}`);
  console.log(`   ❌ Errors: ${errors}`);

  // Refresh materialized view
  console.log('\n🔄 Refreshing booth statistics...');
  await supabase.rpc('refresh_booth_counts').catch(() => {
    console.log('   ⚠️  Run this SQL manually: REFRESH MATERIALIZED VIEW CONCURRENTLY booth_voter_counts;');
  });

  // Print summary
  const { count } = await supabase.from('voters').select('*', { count: 'exact', head: true });
  console.log(`\n📊 Total voters in database: ${count}`);
}

// ==================== CSV IMPORT ====================

async function importCSV(filePath) {
  const workbook = XLSX.readFile(filePath);
  // CSV files load as a single sheet
  return importExcel(filePath);
}

// ==================== RUN ====================

const filePath = process.argv[2];

if (!filePath) {
  console.log('Usage: node src/lib/data-import.js <path-to-excel-or-csv>');
  console.log('Example: node src/lib/data-import.js ./voters.xlsx');
  process.exit(1);
}

const ext = path.extname(filePath).toLowerCase();
if (['.xlsx', '.xls', '.csv', '.tsv'].includes(ext)) {
  importExcel(filePath).catch(console.error);
} else {
  console.error(`Unsupported file format: ${ext}. Use .xlsx, .xls, .csv, or .tsv`);
  process.exit(1);
}
