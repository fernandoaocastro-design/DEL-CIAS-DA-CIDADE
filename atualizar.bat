@echo off
echo --- ATUALIZANDO SISTEMA NO SERVIDOR (GITHUB/NETLIFY) ---
echo.

echo 1. Adicionando arquivos...
git add .

echo 2. Salvando alteracoes (Commit)...
git commit -m "Atualizacao automatica via script"

echo 3. Enviando para o servidor...
git push

echo.
echo --- ATUALIZACAO CONCLUIDA! ---
pause