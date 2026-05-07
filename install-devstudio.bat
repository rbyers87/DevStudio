@echo off
setlocal enabledelayedexpansion
title DevStudio Desktop - Windows Installer
echo ========================================
echo DevStudio Desktop - Windows Installer
echo ========================================
echo.

:: ==========================================
:: CHECK PREREQUISITES
:: ==========================================
echo [*] Checking prerequisites...

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js is not installed!
  echo Please download and install from: https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo [OK] Node.js found:
node --version

:: Check for PowerShell
where powershell >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] PowerShell is required!
  pause
  exit /b 1
)
echo [OK] PowerShell found

:: Check for Ollama
where ollama >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [WARNING] Ollama not found in PATH
  echo Download from: https://ollama.com/download/windows
  echo.
  ) else (
  echo [OK] Ollama found
)

:: ==========================================
:: SETUP DIRECTORIES
:: ==========================================
set "INSTALL_DIR=%USERPROFILE%\DevStudio"
set "ELECTRON_VERSION=28.0.0"
set "CACHE_DIR=%LOCALAPPDATA%\electron\Cache"
set "ELECTRON_DIR=%CACHE_DIR%\electron-v%ELECTRON_VERSION%-win32-x64"

echo.
echo [*] Setting up directories...
echo Install location: %INSTALL_DIR%

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
cd /d "%INSTALL_DIR%"

:: ==========================================
:: CREATE package.json
:: ==========================================
echo.
echo [*] Creating package.json...

(
echo {
echo  "name": "devstudio-desktop",
echo  "version": "1.0.0",
echo  "description": "DevStudio - Local AI-powered code editor",
echo  "main": "main.js",
echo  "scripts": {
echo  "start": "electron .",
echo  "build:win": "electron-builder --win"
echo  },
echo  "devDependencies": {
echo  "electron-builder": "^24.9.1"
echo  },
echo  "dependencies": {
echo  "electron-store": "^8.1.0"
echo  },
echo  "build": {
echo  "appId": "com.devstudio.desktop",
echo  "productName": "DevStudio Desktop",
echo  "directories": {
echo  "output": "dist"
echo  }
echo  }
echo }
) > package.json

echo [OK] package.json created

:: ==========================================
:: CREATE main.js (if not exists)
:: ==========================================
if not exist "main.js" (
  echo [*] Creating main.js...
  (
  echo const { app, BrowserWindow, ipcMain, dialog } = require('electron'^);
  echo const path = require('path'^);
  echo.
  echo let mainWindow;
  echo.
  echo function createWindow(^) {
  echo  mainWindow = new BrowserWindow({
  echo  width: 1400,
  echo  height: 900,
  echo  minWidth: 1024,
  echo  minHeight: 700,
  echo  webPreferences: {
  echo  nodeIntegration: true,
  echo  contextIsolation: false,
  echo  enableRemoteModule: true
  echo  },
  echo  title: 'DevStudio',
  echo  backgroundColor: '#0f172a'
  echo  }^);
  echo.
  echo  mainWindow.loadFile('index.html'^);
  echo  mainWindow.setMenuBarVisibility(false^);
  echo.
  echo  mainWindow.on('closed', (^) =^> {
  echo  mainWindow = null;
  echo  }^);
  echo }
  echo.
  echo ipcMain.handle('open-file-dialog', async (^) =^> {
  echo  const result = await dialog.showOpenDialog(mainWindow, {
  echo  properties: ['openDirectory'],
  echo  title: 'Open Project Folder'
  echo  }^);
  echo  return result;
  echo }^);
  echo.
  echo ipcMain.handle('save-file', async (event, { filePath, content }^) =^> {
  echo  const fs = require('fs'^).promises;
  echo  try {
  echo  await fs.writeFile(filePath, content, 'utf8'^);
  echo  return { success: true };
  echo  } catch (error^) {
  echo  return { success: false, error: error.message };
  echo  }
  echo }^);
  echo.
  echo app.whenReady(^).then((^) =^> {
  echo  createWindow(^);
  echo }^);
  echo.
  echo app.on('window-all-closed', (^) =^> {
  echo  if (process.platform !== 'darwin'^) {
  echo  app.quit(^);
  echo  }
  echo }^);
  echo.
  echo app.on('activate', (^) =^> {
  echo  if (mainWindow === null^) {
  echo  createWindow(^);
  echo  }
  echo }^);
  ) > main.js
  echo [OK] main.js created
  ) else (
  echo [OK] main.js already exists
)

:: ==========================================
:: CHECK FOR index.html
:: ==========================================
if not exist "index.html" (
  echo.
  echo [WARNING] index.html not found in %INSTALL_DIR%
  echo Please copy your index.html file to this folder before launching.
  echo.
)

:: ==========================================
:: INSTALL NPM DEPENDENCIES
:: ==========================================
echo.
echo [*] Installing npm dependencies (excluding Electron)...
echo This may take 2-5 minutes...

:: Configure npm for corporate networks
call npm config set strict-ssl false 2>nul

:: Install dependencies
call npm install --ignore-scripts 2>&1
if %ERRORLEVEL% neq 0 (
  echo [WARNING] npm install had some warnings, continuing...
)

:: ==========================================
:: DOWNLOAD AND SETUP ELECTRON MANUALLY
:: ==========================================
echo.
echo [*] Setting up Electron v%ELECTRON_VERSION%...

:: Check if Electron is already installed
if exist "%ELECTRON_DIR%\electron.exe" (
  echo [OK] Electron already installed at:
  echo  %ELECTRON_DIR%
  goto :skip_electron_download
)

echo Downloading Electron (this may take 3-5 minutes^)...

:: Create cache directory
if not exist "%CACHE_DIR%" mkdir "%CACHE_DIR%"

:: Use PowerShell to download (handles corporate SSL certificates)
set "PS_SCRIPT=%TEMP%\download_electron.ps1"
(
echo $url = "https://github.com/electron/electron/releases/download/v%ELECTRON_VERSION%/electron-v%ELECTRON_VERSION%-win32-x64.zip"
echo $zipFile = "$env:TEMP\electron-v%ELECTRON_VERSION%-win32-x64.zip"
echo $targetDir = "%ELECTRON_DIR%"
echo.
echo Write-Host "Downloading Electron v%ELECTRON_VERSION%..." -ForegroundColor Green
echo.
echo try {
echo  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
echo  $webClient = New-Object System.Net.WebClient
echo  $webClient.Headers.Add("User-Agent", "Mozilla/5.0"^)
echo  $webClient.DownloadFile($url, $zipFile^)
echo  Write-Host "Download complete!" -ForegroundColor Green
echo.
echo  Write-Host "Extracting..." -ForegroundColor Yellow
echo  New-Item -ItemType Directory -Force -Path $targetDir ^| Out-Null
echo  Expand-Archive -Path $zipFile -DestinationPath $targetDir -Force
echo.
echo  if (Test-Path "$targetDir\electron.exe"^) {
echo  Write-Host "Electron installed successfully!" -ForegroundColor Green
echo  Remove-Item $zipFile -Force
echo  } else {
echo  Write-Host "ERROR: Extraction failed" -ForegroundColor Red
echo  exit 1
echo  }
echo } catch {
echo  Write-Host "ERROR: $_" -ForegroundColor Red
echo  Write-Host "Please download manually from:" -ForegroundColor Yellow
echo  Write-Host "  $url" -ForegroundColor Cyan
echo  Write-Host "And extract to:" -ForegroundColor Yellow
echo  Write-Host "  $targetDir" -ForegroundColor Cyan
echo  exit 1
echo }
) > "%PS_SCRIPT%"

powershell -ExecutionPolicy Bypass -File "%PS_SCRIPT%"
if %ERRORLEVEL% neq 0 (
  echo.
  echo [ERROR] Failed to download Electron automatically.
  echo Please download manually from:
  echo  https://github.com/electron/electron/releases/download/v%ELECTRON_VERSION%/electron-v%ELECTRON_VERSION%-win32-x64.zip
  echo And extract to:
  echo  %ELECTRON_DIR%
  echo.
  pause
  exit /b 1
)

del "%PS_SCRIPT%" 2>nul

:skip_electron_download

:: ==========================================
:: SET ENVIRONMENT VARIABLE PERMANENTLY
:: ==========================================
echo.
echo [*] Setting up environment...
powershell -Command "[System.Environment]::SetEnvironmentVariable('ELECTRON_OVERRIDE_DIST_PATH', '%ELECTRON_DIR%', 'User')" 2>nul
set "ELECTRON_OVERRIDE_DIST_PATH=%ELECTRON_DIR%"

:: ==========================================
:: CREATE LAUNCH SCRIPT
:: ==========================================
echo [*] Creating launch script...

(
echo @echo off
echo title DevStudio - AI Code Editor
echo set ELECTRON_OVERRIDE_DIST_PATH=%ELECTRON_DIR%
echo cd /d "%INSTALL_DIR%"
echo start "" "%ELECTRON_DIR%\electron.exe" "%INSTALL_DIR%"
) > "%INSTALL_DIR%\DevStudio.bat"

:: ==========================================
:: CREATE DESKTOP SHORTCUT
:: ==========================================
echo [*] Creating Desktop shortcut...

powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%USERPROFILE%\Desktop\DevStudio.lnk'); $SC.TargetPath = '%INSTALL_DIR%\DevStudio.bat'; $SC.WorkingDirectory = '%INSTALL_DIR%'; $SC.IconLocation = '%ELECTRON_DIR%\electron.exe,0'; $SC.Description = 'DevStudio - AI Code Editor'; $SC.Save()"

:: ==========================================
:: CREATE START MENU SHORTCUT
:: ==========================================
powershell -Command "$WS = New-Object -ComObject WScript.Shell; $StartMenu = [Environment]::GetFolderPath('Programs'); $SC = $WS.CreateShortcut("$StartMenu\DevStudio.lnk"); $SC.TargetPath = '%INSTALL_DIR%\DevStudio.bat'; $SC.WorkingDirectory = '%INSTALL_DIR%'; $SC.IconLocation = '%ELECTRON_DIR%\electron.exe,0'; $SC.Description = 'DevStudio - AI Code Editor'; $SC.Save()" 2>nul

:: ==========================================
:: INSTALL OLLAMA MODELS (Optional)
:: ==========================================
where ollama >nul 2>nul
if %ERRORLEVEL% equ 0 (
  echo.
  echo [*] Checking Ollama models...
  
  :: Check if gemma2 is installed
  ollama list 2>nul | findstr /i "gemma2" >nul
  if %ERRORLEVEL% neq 0 (
    echo.
    echo [*] Downloading Gemma 2 model (this may take 10-20 minutes)...
    echo You can skip this by pressing Ctrl+C
    ollama pull gemma2:latest
    ) else (
    echo [OK] Gemma 2 model found
  )
  
  :: Check if codellama is installed
  ollama list 2>nul | findstr /i "codellama" >nul
  if %ERRORLEVEL% neq 0 (
    echo [*] Downloading CodeLlama model (optional)...
    echo You can skip this by pressing Ctrl+C
    ollama pull codellama:latest
    ) else (
    echo [OK] CodeLlama model found
  )
)

:: ==========================================
:: DONE
:: ==========================================
echo.
echo ========================================
echo INSTALLATION COMPLETE!
echo ========================================
echo.
echo Files installed to: %INSTALL_DIR%
echo Electron installed to: %ELECTRON_DIR%
echo.
echo LAUNCH OPTIONS:
echo  1. Double-click "DevStudio" on your Desktop
echo  2. Search "DevStudio" in Start Menu
echo  3. Run: "%INSTALL_DIR%\DevStudio.bat"
echo.
echo.
echo Launching DevStudio now...
echo ========================================

:: Launch the app
start "" "%ELECTRON_DIR%\electron.exe" "%INSTALL_DIR%"

:: Wait and exit
timeout /t 3 >nul
endlocal
exit /b 0
