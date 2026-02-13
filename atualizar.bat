@echo off
echo ==========================================
echo    SUBINDO ATUALIZACOES PARA O GITHUB
echo ==========================================
echo.

:: Garante que estamos na pasta certa
cd /d "%~dp0"

echo [1/3] Adicionando arquivos...
git add .

echo [2/3] Registrando alteracoes (Commit)...
git commit -m "Atualizacao: Modulo Lista do Dia e Producao"

echo [3/3] Enviando para o servidor...
git push

echo.
if %errorlevel% equ 0 (
    echo [SUCESSO] O codigo foi enviado para o GitHub.
) else (
    echo [ERRO] Verifique sua conexao ou permissoes.
)
echo.
pause