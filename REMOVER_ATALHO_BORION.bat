@echo off
title Remover Atalho - Borion Finance

echo ================================================
echo   Remover Atalho - Borion Finance
echo ================================================
echo.

rem --------------------------------------------------------------
rem 1. Descobrir o caminho real da Area de Trabalho usando VBScript
rem    (funciona mesmo se a Area de Trabalho estiver redirecionada
rem    para o OneDrive)
rem --------------------------------------------------------------
set "VBS=%TEMP%\borion_get_desktop_%RANDOM%.vbs"

> "%VBS%" (
echo Set oWS = CreateObject^("WScript.Shell"^)
echo WScript.Echo oWS.SpecialFolders^("Desktop"^)
)

set "DESKTOP="
for /f "usebackq delims=" %%D in (`cscript //nologo "%VBS%"`) do set "DESKTOP=%%D"

del "%VBS%" >nul 2>&1

if not defined DESKTOP (
    echo [ERRO] Nao foi possivel localizar a pasta Area de Trabalho.
    pause
    exit /b 1
)

set "LNK=%DESKTOP%\Borion Finance.lnk"

rem --------------------------------------------------------------
rem 2. Apagar apenas o atalho (.lnk). O app e os dados NAO sao
rem    tocados por este script.
rem --------------------------------------------------------------
if exist "%LNK%" (
    del "%LNK%"
    echo [OK] Atalho "Borion Finance" removido da Area de Trabalho.
) else (
    echo [INFO] Nenhum atalho "Borion Finance" foi encontrado.
)

echo.
echo Nenhum arquivo do aplicativo ou dado salvo foi apagado.
echo.
pause
exit /b 0
