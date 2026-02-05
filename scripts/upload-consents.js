
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// run this script with "node scripts/upload-consents.js"

// Load environment variables from .env file
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file.');
    process.exit(1);
}

// Initialize Supabase client with Service Role Key for admin privileges
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '../');

const CONSENT_CONFIGS = [
    {
        type: 'platform_terms',
        version: '1.0',
        title: 'นโยบายความเป็นส่วนตัวสำหรับผู้ใช้ (User Privacy Policy)',
        filePath: 'public/consents/platform-terms.html',
        isActive: true
    },
    {
        type: 'customer_pdpa',
        version: '1.0',
        title: 'นโยบายความเป็นส่วนตัวลูกค้า (Customer Privacy Policy)',
        filePath: 'public/consents/customer-pdpa.html',
        isActive: true
    },
    {
        type: 'team_leader_agreement',
        version: '1.0',
        title: 'ข้อตกลงและเงื่อนไขสำหรับหัวหน้าทีม (Team Leader Agreement)',
        filePath: 'public/consents/team-leader-agreement.html',
        isActive: true
    },
    {
        type: 'team_member_agreement',
        version: '1.0',
        title: 'ข้อตกลงและเงื่อนไขสำหรับสมาชิกทีม (Team Member Agreement)',
        filePath: 'public/consents/team-member-agreement.html',
        isActive: true
    }
];

async function uploadConsents() {
    console.log('Starting consent documents upload...');

    for (const config of CONSENT_CONFIGS) {
        try {
            console.log(`Processing ${config.type} (Version: ${config.version})...`);

            const fullPath = path.join(PROJECT_ROOT, config.filePath);
            let htmlContent = '';

            try {
                htmlContent = await fs.readFile(fullPath, 'utf-8');
                console.log(`  - Read HTML content from ${config.filePath}`);
            } catch (err) {
                console.error(`  - Failed to read HTML file: ${fullPath}`, err.message);
                continue; // Skip if content is missing
            }

            // Check if a consent doc with the same type and version already exists
            const { data: existingDocs, error: searchError } = await supabase
                .from('consent_docs')
                .select('consent_doc_id')
                .eq('consent_type', config.type)
                .eq('consent_version', config.version);

            if (searchError) {
                console.error(`  - Error checking existence:`, searchError.message);
                continue;
            }

            const payload = {
                consent_type: config.type,
                consent_version: config.version,
                consent_content: htmlContent,
                is_active: config.isActive
                // Note: consent_effective_date defaults to CURRENT_DATE in DB if not provided
            };

            if (existingDocs && existingDocs.length > 0) {
                // Update existing record
                const docId = existingDocs[0].consent_doc_id;
                console.log(`  - Found existing record (ID: ${docId}). Updating...`);

                const { error: updateError } = await supabase
                    .from('consent_docs')
                    .update(payload)
                    .eq('consent_doc_id', docId);

                if (updateError) {
                    console.error(`  - Error updating record:`, updateError.message);
                } else {
                    console.log(`  - Successfully updated.`);
                }

            } else {
                // Insert new record
                console.log(`  - Creating new record...`);

                const { error: insertError } = await supabase
                    .from('consent_docs')
                    .insert([payload]);

                if (insertError) {
                    console.error(`  - Error inserting record:`, insertError.message);
                } else {
                    console.log(`  - Successfully inserted.`);
                }
            }

        } catch (err) {
            console.error(`Failed to process ${config.type}:`, err);
        }
    }

    console.log('Upload process completed.');
}

uploadConsents();
