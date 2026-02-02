@echo off
setlocal enabledelayedexpansion

echo --- RESTAURACAO DE SISTEMA (BACKUP LOCAL) ---
echo.

:: 1. Configurar caminhos
set "PROJECT_DIR=%~dp0"
:: Remove a barra final se existir
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

:: Define a pasta onde estao os backups (mesma logica do backup_local.bat)
set "BACKUP_ROOT=%PROJECT_DIR%\..\Backups_DeliciaDaCidade"

:: 2. Verificar se existe pasta de backups
if not exist "%BACKUP_ROOT%" (
    echo ERRO: Nenhuma pasta de backup encontrada em:
    echo "%BACKUP_ROOT%"
    echo.
    echo Verifique se voce ja executou o backup_local.bat alguma vez.
    pause
    exit /b
)

:: 3. Listar backups disponiveis
echo Backups disponiveis:
echo.
set count=0
for /d %%D in ("%BACKUP_ROOT%\*") do (
    set /a count+=1
    set "backup[!count!]=%%~nxD"
    echo [!count!] %%~nxD
)

if %count%==0 (
    echo Nenhum backup encontrado dentro da pasta.
    pause
    exit /b
)

echo.
set /p choice="Digite o numero do backup para restaurar (ou 0 para cancelar): "

if "%choice%"=="0" exit /b
if "%choice%"=="" exit /b

:: Validar escolha
if !choice! gtr %count% (
    echo Opcao invalida.
    pause
    exit /b
)
if !choice! lss 1 (
    echo Opcao invalida.
    pause
    exit /b
)

set "SELECTED_BACKUP=!backup[%choice%]!"
set "SOURCE=%BACKUP_ROOT%\%SELECTED_BACKUP%"

echo.
echo Restaurando versao: %SELECTED_BACKUP%...
:: Copia tudo da origem para o destino, sobrescrevendo (/Y)
xcopy "%SOURCE%\*" "%PROJECT_DIR%\" /E /H /C /I /Q /Y

echo.
echo --- RESTAURACAO CONCLUIDA! ---
pause