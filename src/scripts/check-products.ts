
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkProducts() {
    // console.log('--- Checking Products Table ---');

    // 1. Count
    const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

    if (countError) {
        console.error('Error counting products:', countError);
    } else {
        // console.log(`Total rows in 'products': ${count}`);
    }

    // 2. Fetch Sample
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(5);

    if (error) {
        console.error('Error fetching sample:', error);
    } else {
        // console.log('Sample Data (First 5):');
        // console.log(JSON.stringify(data, null, 2));
    }
}

checkProducts();
