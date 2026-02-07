const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// CONFIGURAÇÃO: Substitua pela sua string de conexão do Supabase
// Você encontra isso em Project Settings > Database > Connection String > URI
const DB_URL = process.env.DATABASE_URL || 'postgres://postgres:[SUA-SENHA]@[SEU-HOST]:5432/postgres';
const BACKUP_DIR = path.join(__dirname, 'backups');

// Cria a pasta de backups se não existir
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR);
}

const date = new Date().toISOString().replace(/[:.]/g, '-');
const filename = path.join(BACKUP_DIR, `backup-${date}.sql`);

console.log('🔄 Iniciando backup seguro com pg_dump...');

// Executa o comando pg_dump do sistema
const command = `pg_dump "${DB_URL}" -f "${filename}" --no-owner --no-acl`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`❌ Erro crítico ao criar backup: ${error.message}`);
        return;
    }
    console.log(`✅ Backup criado com sucesso em: ${filename}`);
});