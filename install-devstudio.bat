@echo off
echo ========================================
echo DevStudio Desktop - Windows Installer
echo ========================================
echo.

:: Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [ERROR] Node.js is not installed!
  echo Please download and install from: https://nodejs.org
  echo.
  pause
  exit /b 1
)
echo [OK] Node.js is installed

:: Check for Ollama
where ollama >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo [WARNING] Ollama not found in PATH
  echo Download from: https://ollama.com/download/windows
  echo.
)

:: Create directory
set "INSTALL_DIR=%USERPROFILE%\DevStudio"
echo Creating installation directory: %INSTALL_DIR%
mkdir "%INSTALL_DIR%" 2>nul
cd /d "%INSTALL_DIR%"

:: Download package.json
echo.
echo Downloading package configuration...
echo {"name":"devstudio-desktop","version":"1.0.0","main":"main.js","scripts":{"start":"electron .","build":"electron-builder --win portable"},"devDependencies":{"electron":"^28.0.0","electron-builder":"^24.9.1"},"dependencies":{"electron-store":"^8.1.0"}} > package.json

:: Install dependencies
echo.
echo Installing dependencies (this may take 5-10 minutes)...
call npm install

:: Create launch batch file
echo @echo off > DevStudio.bat
echo cd /d "%INSTALL_DIR%" >> DevStudio.bat
echo npm start >> DevStudio.bat

:: Create Desktop Shortcut
powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%USERPROFILE%\Desktop\DevStudio.lnk'); $SC.TargetPath = '%INSTALL_DIR%\DevStudio.bat'; $SC.WorkingDirectory = '%INSTALL_DIR%'; $SC.IconLocation = 'shell32.dll,70'; $SC.Save()"

echo.
echo ========================================
echo Installation Complete!
echo ========================================
echo.
echo Next Steps:
echo 1. Copy your index.html to: %INSTALL_DIR%
echo 2. Create main.js in: %INSTALL_DIR%
echo 3. Install Ollama from: https://ollama.com
echo 4. Run: ollama pull gemma2:latest
echo 5. Launch DevStudio from Desktop shortcut!
echo.
pause
