@echo off
setlocal enabledelayedexpansion

echo --- INICIANDO BACKUP LOCAL ---

:: 1. Configurar caminhos
set "SOURCE=%~dp0"
:: Remove a barra final do caminho se existir
if "%SOURCE:~-1%"=="\" set "SOURCE=%SOURCE:~0,-1%"

:: Pega a data e hora para criar uma pasta unica (Formato YYYY-MM-DD_HH-MM)
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set "dt=%%I"
set "TIMESTAMP=%dt:~0,4%-%dt:~4,2%-%dt:~6,2%_%dt:~8,2%-%dt:~10,2%"

:: Define o destino: Uma pasta "Backups" fora da pasta do projeto (no diretorio pai)
set "DESTINATION=%SOURCE%\..\Backups_DeliciaDaCidade\%TIMESTAMP%"

echo Origem:  "%SOURCE%"
echo Destino: "%DESTINATION%"
echo.

:: 2. Executar a copia (Robocopy)
:: /E = Copia subpastas | /XD = Exclui pastas (node_modules, .git) | /R:0 = Sem retentativas
robocopy "%SOURCE%" "%DESTINATION%" /E /XD node_modules .git .netlify dist tmp /XF .DS_Store /R:0 /W:0

echo.
echo --- BACKUP CONCLUIDO COM SUCESSO! ---
pause