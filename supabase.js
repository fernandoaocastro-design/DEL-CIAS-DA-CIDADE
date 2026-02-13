const { createClient } = require('@supabase/supabase-js');

// Tenta pegar as variáveis de ambiente do Netlify
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('AVISO: Variáveis SUPABASE_URL e SUPABASE_KEY não definidas. O banco de dados pode não funcionar.');
}

module.exports = { supabase };