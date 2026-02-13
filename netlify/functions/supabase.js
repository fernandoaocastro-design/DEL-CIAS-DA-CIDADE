import { createClient } from '@supabase/supabase-js';

// Configuração do Cliente Supabase
// Usa variáveis de ambiente ou valores de placeholder para evitar erro na inicialização
const supabaseUrl = process.env.SUPABASE_URL || 'https://sua-url.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sua-chave-anonima';

if (!process.env.SUPABASE_URL) {
    console.warn('⚠️ AVISO: SUPABASE_URL não definida. O backend pode falhar ao conectar no banco.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);