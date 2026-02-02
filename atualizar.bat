@echo off
echo --- INICIANDO ATUALIZACAO DO SISTEMA ---

:: 1. Garante que esta na pasta correta
cd /d "C:\Users\USER\OneDrive\EMPRESAS\DELICIA DA CIDADE"

:: 2. Adiciona todas as mudancas
git add .

:: 3. Faz o Commit (Salva localmente)
:: Voce pode mudar a mensagem entre aspas abaixo se quiser um padrao diferente
git commit -m "Sistema validado para dados reais: Permissoes e correcoes de bugs"

:: 4. Envia para o GitHub/Netlify
git push

echo.
echo --- ATUALIZACAO CONCLUIDA COM SUCESSO! ---
pause