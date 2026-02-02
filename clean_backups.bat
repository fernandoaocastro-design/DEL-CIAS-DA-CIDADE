@echo off
setlocal enabledelayedexpansion

echo --- LIMPANDO BACKUPS ANTIGOS (MAIS DE 30 DIAS) ---
echo.

:: 1. Configurar caminhos
set "PROJECT_DIR=%~dp0"
:: Remove a barra final se existir
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

:: Define a pasta onde estao os backups
set "BACKUP_ROOT=%PROJECT_DIR%\..\Backups_DeliciaDaCidade"
set "LOG_FILE=%PROJECT_DIR%\cleanup_log.txt"

:: 2. Executar limpeza (forfiles)
:: /P = Caminho | /D -30 = Mais antigo que 30 dias | /C = Comando (rmdir /s /q para deletar pastas)
if exist "%BACKUP_ROOT%" (
    echo. >> "%LOG_FILE%"
    echo --- Limpeza iniciada em %date% as %time% --- >> "%LOG_FILE%"
    forfiles /P "%BACKUP_ROOT%" /D -30 /C "cmd /c if @isdir==TRUE rmdir /s /q @path & echo Deletado: @path & echo Deletado: @path >> 0x22%LOG_FILE%0x22"
) else (
    echo Pasta de backups nao encontrada.
)

echo.
echo --- LIMPEZA CONCLUIDA! ---
pause