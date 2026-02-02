const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = __dirname;
const publicDir = path.join(projectRoot, 'public');
const jsDir = path.join(publicDir, 'js');
const functionsDir = path.join(projectRoot, 'netlify', 'functions');

console.log("=== DIAGNÓSTICO AUTOMÁTICO DO SISTEMA ===\n");

let errorCount = 0;

// Função auxiliar para verificar arquivo
function checkFileExists(relativePath, sourceFile) {
    // Remove query params e hash (ex: style.css?v=1)
    const cleanPath = relativePath.split('?')[0].split('#')[0];
    const fullPath = path.join(publicDir, cleanPath);
    
    if (!fs.existsSync(fullPath)) {
        console.log(`❌ [${sourceFile}] Link quebrado: '${relativePath}' não encontrado.`);
        errorCount++;
    }
}

// 1. Verificar Sintaxe JS (Frontend e Backend)
console.log("1. Verificando Sintaxe JavaScript...");
const jsFiles = [];

if (fs.existsSync(jsDir)) fs.readdirSync(jsDir).forEach(f => { if(f.endsWith('.js')) jsFiles.push(path.join(jsDir, f)); });
if (fs.existsSync(functionsDir)) fs.readdirSync(functionsDir).forEach(f => { if(f.endsWith('.js')) jsFiles.push(path.join(functionsDir, f)); });

jsFiles.forEach(file => {
    const fileName = path.basename(file);
    try {
        // Usa o próprio Node para verificar a sintaxe sem executar
        execSync(`node --check "${file}"`, { stdio: 'pipe' });
        console.log(`✅ ${fileName}: Sintaxe OK`);
    } catch (e) {
        console.log(`❌ ${fileName}: ERRO DE SINTAXE`);
        // Tenta extrair a mensagem de erro relevante
        const errorMsg = e.stderr.toString().split('\n').slice(0, 5).join('\n');
        console.log(errorMsg);
        errorCount++;
    }
});
console.log("");

// 2. Verificar HTML e Recursos
console.log("2. Verificando Páginas HTML e Recursos...");
const htmlFiles = fs.readdirSync(publicDir).filter(f => f.endsWith('.html'));

htmlFiles.forEach(file => {
    const content = fs.readFileSync(path.join(publicDir, file), 'utf8');
    
    // Verificar Scripts (src)
    const scripts = content.match(/src=["']([^"']+)["']/g) || [];
    scripts.forEach(s => {
        const src = s.match(/src=["']([^"']+)["']/)[1];
        if (!src.startsWith('http') && !src.startsWith('//')) checkFileExists(src, file);
    });

    // Verificar CSS (href)
    const links = content.match(/href=["']([^"']+)["']/g) || [];
    links.forEach(l => {
        const href = l.match(/href=["']([^"']+)["']/)[1];
        if (!href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#') && !href.startsWith('javascript:')) checkFileExists(href, file);
    });
});

console.log("\n------------------------------------------------");
if (errorCount === 0) {
    console.log("🎉 SUCESSO: O sistema parece saudável! Nenhum erro estático encontrado.");
    process.exit(0);
} else {
    console.log(`⚠️ ATENÇÃO: Foram encontrados ${errorCount} problemas que podem impedir o funcionamento.`);
    process.exit(1);
}