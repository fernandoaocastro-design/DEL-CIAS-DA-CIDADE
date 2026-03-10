import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = __dirname;
const publicDir = path.join(projectRoot, 'public');
const functionsDir = path.join(projectRoot, 'netlify', 'functions');

console.log('=== DIAGNOSTICO AUTOMATICO DO SISTEMA ===\n');

let errorCount = 0;

const walk = (dir, exts) => {
    const files = [];
    if (!fs.existsSync(dir)) return files;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walk(full, exts));
        } else if (exts.some(ext => entry.name.endsWith(ext))) {
            files.push(full);
        }
    }
    return files;
};

const isExternalRef = (ref) => /^(https?:|\/\/|mailto:|tel:|#|data:|javascript:)/i.test(ref);

const resolveFromHtml = (htmlFile, relativePath) => {
    const cleanPath = relativePath.split('?')[0].split('#')[0];
    return path.resolve(path.dirname(htmlFile), cleanPath);
};

const checkFileExists = (htmlFile, relativePath) => {
    const target = resolveFromHtml(htmlFile, relativePath);
    if (!fs.existsSync(target)) {
        console.log(`X [${path.basename(htmlFile)}] Link quebrado: '${relativePath}' nao encontrado.`);
        errorCount++;
    }
};

console.log('1. Verificando sintaxe JavaScript...');
const jsFiles = [
    ...walk(path.join(publicDir, 'js'), ['.js']),
    ...walk(functionsDir, ['.js']),
    ...walk(projectRoot, ['.js']).filter(f => path.dirname(f) === projectRoot)
];

for (const file of jsFiles) {
    try {
        execSync(`node --check "${file}"`, { stdio: 'pipe' });
        console.log(`OK ${path.relative(projectRoot, file)}`);
    } catch (e) {
        console.log(`X ${path.relative(projectRoot, file)}: ERRO DE SINTAXE`);
        const err = e.stderr?.toString() || e.message;
        console.log(err.split('\n').slice(0, 5).join('\n'));
        errorCount++;
    }
}

console.log('\n2. Verificando paginas HTML e recursos...');
const htmlFiles = walk(publicDir, ['.html']);

for (const file of htmlFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const refs = [...content.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]);
    for (const ref of refs) {
        if (!isExternalRef(ref)) checkFileExists(file, ref);
    }
}

console.log('\n------------------------------------------------');
if (errorCount === 0) {
    console.log('SUCESSO: Nenhum erro estatico encontrado.');
    process.exit(0);
}

console.log(`ATENCAO: Foram encontrados ${errorCount} problemas.`);
process.exit(1);
