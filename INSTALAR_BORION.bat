@echo off
title Instalador de Atalho - Borion Finance

echo ================================================
echo    Instalador de Atalho - Borion Finance
echo ================================================
echo.

rem --------------------------------------------------------------
rem 1. Descobrir a pasta onde este .bat esta localizado
rem --------------------------------------------------------------
set "SCRIPT_DIR=%~dp0"

if not exist "%SCRIPT_DIR%index.html" (
    echo [ERRO] Nao foi encontrado o arquivo index.html nesta pasta:
    echo    %SCRIPT_DIR%
    echo.
    echo Verifique se este .bat esta na MESMA pasta que o index.html
    echo do aplicativo Borion Finance.
    echo.
    pause
    exit /b 1
)

echo [OK] index.html encontrado em:
echo    %SCRIPT_DIR%
echo.

rem --------------------------------------------------------------
rem 2. Guardar caminhos base do sistema em variaveis simples
rem    (evita problemas com o parenteses de "Program Files (x86)")
rem --------------------------------------------------------------
set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"
set "LAD=%LocalAppData%"

rem --------------------------------------------------------------
rem 3. Detectar o navegador: preferir Microsoft Edge,
rem    depois Google Chrome. Testa os locais mais comuns.
rem --------------------------------------------------------------
set "BROWSER="
set "BROWSER_NAME="

if exist "%PF86%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%PF86%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_NAME=Microsoft Edge"
)

if not defined BROWSER if exist "%PF%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%PF%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_NAME=Microsoft Edge"
)

if not defined BROWSER if exist "%LAD%\Microsoft\Edge\Application\msedge.exe" (
    set "BROWSER=%LAD%\Microsoft\Edge\Application\msedge.exe"
    set "BROWSER_NAME=Microsoft Edge"
)

if not defined BROWSER if exist "%PF%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%PF%\Google\Chrome\Application\chrome.exe"
    set "BROWSER_NAME=Google Chrome"
)

if not defined BROWSER if exist "%PF86%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%PF86%\Google\Chrome\Application\chrome.exe"
    set "BROWSER_NAME=Google Chrome"
)

if not defined BROWSER if exist "%LAD%\Google\Chrome\Application\chrome.exe" (
    set "BROWSER=%LAD%\Google\Chrome\Application\chrome.exe"
    set "BROWSER_NAME=Google Chrome"
)

if not defined BROWSER (
    echo [ERRO] Nao foi encontrado Microsoft Edge nem Google Chrome
    echo instalados neste computador.
    echo.
    echo Instale um dos dois navegadores e execute este arquivo novamente.
    echo.
    pause
    exit /b 1
)

echo [OK] Navegador detectado: %BROWSER_NAME%
echo    %BROWSER%
echo.

rem --------------------------------------------------------------
rem 4. Montar o caminho da pasta de trabalho e a URI do index.html
rem --------------------------------------------------------------
set "WORKDIR=%SCRIPT_DIR%"
if "%WORKDIR:~-1%"=="\" set "WORKDIR=%WORKDIR:~0,-1%"

set "FILEPATH=%SCRIPT_DIR%index.html"
set "FILEURI=file:///%FILEPATH:\=/%"

rem --------------------------------------------------------------
rem 5. Definir o icone: usa borion.ico se existir, senao usa o
rem    icone padrao do proprio navegador
rem --------------------------------------------------------------
set "ICONPATH=%SCRIPT_DIR%borion.ico"
if not exist "%ICONPATH%" set "ICONPATH=%BROWSER%"

rem --------------------------------------------------------------
rem 6. Criar um script VBS temporario para gerar o atalho .lnk
rem    (o .bat sozinho nao consegue criar atalhos do Windows)
rem --------------------------------------------------------------
set "VBS=%TEMP%\borion_shortcut_%RANDOM%.vbs"

> "%VBS%" (
echo Set oWS = CreateObject^("WScript.Shell"^)
echo sDesktop = oWS.SpecialFolders^("Desktop"^)
echo sLinkFile = sDesktop ^& "\Borion Finance.lnk"
echo Set oLink = oWS.CreateShortcut^(sLinkFile^)
echo oLink.TargetPath = "%BROWSER%"
echo oLink.Arguments = "--app=""%FILEURI%"""
echo oLink.WorkingDirectory = "%WORKDIR%"
echo oLink.IconLocation = "%ICONPATH%,0"
echo oLink.Description = "Borion Finance"
echo oLink.Save
)

cscript //nologo "%VBS%"
set "VBS_RESULT=%errorlevel%"
del "%VBS%" >nul 2>&1

if not "%VBS_RESULT%"=="0" (
    echo.
    echo [ERRO] Nao foi possivel criar o atalho na Area de Trabalho.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   Atalho "Borion Finance" criado com sucesso!
echo   Verifique a sua Area de Trabalho.
echo ================================================
echo.
echo Para abrir o app, de dois cliques no icone
echo "Borion Finance" na Area de Trabalho.
echo.
pause
exit /b 0
