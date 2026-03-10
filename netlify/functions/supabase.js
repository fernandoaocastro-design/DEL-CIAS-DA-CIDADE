import { createClient } from '@supabase/supabase-js';

// Configuracao do Cliente Supabase.
// Nao usa fallback hardcoded para evitar vazamento acidental de credenciais.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('AVISO: Variaveis do Supabase invalidas ou nao configuradas.');
}

export { supabase };
