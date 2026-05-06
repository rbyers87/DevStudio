@echo off
title DevStudio - AI Code Editor
set ELECTRON_OVERRIDE_DIST_PATH=%LOCALAPPDATA%\electron\Cache\electron-v28.0.0-win32-x64
start "" "%LOCALAPPDATA%\electron\Cache\electron-v28.0.0-win32-x64\electron.exe" "%~dp0."
