import { createClient } from '@supabase/supabase-js';

// Tenta pegar as variáveis de ambiente do Netlify
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (supabaseUrl && supabaseKey) {
    // Validação extra para garantir que a URL está no formato correto
    if (!supabaseUrl.startsWith('http')) {
        throw new Error(`URL do Supabase inválida. Deve começar com http ou https. Valor recebido: ${supabaseUrl}`);
    }
    supabase = createClient(supabaseUrl, supabaseKey);
} else {
    console.warn('AVISO: Variáveis SUPABASE_URL e SUPABASE_KEY não definidas. O banco de dados pode não funcionar.');
}

export { supabase };