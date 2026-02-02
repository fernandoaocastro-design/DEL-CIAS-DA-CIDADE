@echo off
echo --- INICIANDO DIAGNOSTICO DO SISTEMA ---
cd /d "%~dp0"
node verify_system.js
echo.
pause