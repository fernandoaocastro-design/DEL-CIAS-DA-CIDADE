import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURACAO:
// Substitua pela sua string de conexao do Supabase (Project Settings > Database > Connection String > URI)
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:[SUA-SENHA]@[SEU-HOST]:5432/postgres';
const BACKUP_DIR = path.join(__dirname, 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const date = new Date().toISOString().replace(/[:.]/g, '-');
const filename = path.join(BACKUP_DIR, `backup-${date}.sql`);

console.log('Iniciando backup com pg_dump...');

const command = `pg_dump "${DB_URL}" -f "${filename}" --no-owner --no-acl`;

exec(command, (error) => {
    if (error) {
        console.error(`Erro ao criar backup: ${error.message}`);
        process.exit(1);
    }
    console.log(`Backup criado com sucesso em: ${filename}`);
});
