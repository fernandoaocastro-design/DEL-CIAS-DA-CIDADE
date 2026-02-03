@echo off
echo --- ATUALIZANDO SISTEMA (GIT/NETLIFY) ---
echo.

:: Garante que esta na pasta do projeto
cd /d "%~dp0"

:: 1. Adiciona todas as alteracoes
echo [1/3] Adicionando arquivos...
git add .

:: 2. Faz o commit com data e hora
echo [2/3] Criando commit...
set "dt=%date% %time%"
git commit -m "Atualizacao via CMD: %dt%"

:: 3. Envia para o repositorio remoto
echo [3/3] Enviando para o servidor...
git push

echo.
echo [FIM] Processo concluido.
pause