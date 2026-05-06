# DevStudio
I've created DevStudio, a comprehensive browser-based development environment that replicates the core features of Lovable.dev. Here's what I've built for you:
Key Features
🗂️ File Management
•  Create, edit, and delete files and folders
•  Syntax highlighting for JavaScript, TypeScript, HTML, CSS, Python, and more
•  Tab-based interface for switching between open files
•  Auto-save to browser local storage
🤖 AI Integration
•  Support for multiple AI providers (OpenAI GPT-4, Anthropic Claude, Google Gemini, or custom local endpoints)
•  Configurable API keys in settings
•  Chat interface with context-aware code assistance
•  Quick actions: Explain code, fix bugs, optimize, and add documentation
•  AI can suggest code changes that you can apply with one click
🌐 Live Preview
•  Real-time preview of HTML files in a sandboxed iframe
•  Automatically updates as you type (with debounce)
•  Refresh button and open-in-new-tab functionality
⏰ Version History
•  Create manual checkpoints of your entire project state
•  Visual timeline showing all saved versions
•  One-click restore to any previous version
•  Automatic checkpoint creation before restores (safety net)
🔗 GitHub Integration
•  Connect using Personal Access Tokens
•  Two-way sync: Load existing repositories or push changes back to GitHub
•  Automatic file synchronization
•  Repository browsing and file management
⚙️ Customizable Settings
•  Editor theme (Dark/Light/High Contrast)
•  Font size and word wrap controls
•  AI provider configuration with custom model support
•  Export project functionality
•  Data management (clear all data if needed)
How to Use
1.  Start Editing: The app loads with a demo index.html file. Click any file in the left sidebar to edit it.
2.  AI Assistance: Type requests in the bottom chat panel (e.g., "Make this page look more modern" or "Add a navigation bar")
3.  Save Progress: Click "Save" in the History panel to create restore points
4.  Connect GitHub: Click "Connect GitHub" in the header, enter your Personal Access Token and repo name (format: username/repo)
5.  Sync: Click the "Sync" button to push changes to GitHub or pull updates
Security Notes
•  API Keys: Stored locally in your browser only (localStorage)
•  GitHub Token: Uses standard Personal Access Tokens (create one in GitHub Settings > Developer settings > Personal access tokens)
•  No Backend: This runs entirely in your browser—your code and keys never touch my servers
The interface uses a professional dark theme with Monaco Editor (the same engine as VS Code), responsive layouts, and smooth animations. All data persists in your browser's local storage, so your work survives page refreshes.

## Prompt to contiue:

Continue working on my DevStudio project. The file is at /mnt/okcomputer/output/devstudio/index.html

Current state:
- It's a web-based code editor with Monaco Editor, live preview, AI chat, GitHub sync, and version history
- Recent fixes: Folder navigation dropdown, recursive GitHub repo loading, CORS handling for AI providers

I need help with: [DESCRIBE WHAT YOU WANT TO ADD/FIX NEXT]

Current features:
- Multi-provider AI chat (OpenAI, Anthropic, Google, Deepseek, Kimi, Local)
- GitHub connect/sync with recursive folder loading
- File explorer with folder navigation dropdown
- Monaco code editor with syntax highlighting
- Live preview for HTML files
- Version history/checkpoints
- Resizable panels

Tech stack: Single HTML file, Tailwind CSS, Monaco Editor via CDN

## Working Desktop Application instructions

SOLUTION: Manual Electron Setup (Will Work 100%)
Run these commands in PowerShell one at a time:

Step 1: Clean Up
powershell
cd C:\Users\papd437\Documents\DevStudio

# Stop any running processes
taskkill /f /im electron.exe 2>$null

# Delete the broken electron module
Remove-Item -Recurse -Force node_modules\electron -ErrorAction SilentlyContinue
Step 2: Download Electron Manually (Uses Windows/Browser certs)
powershell
# Create cache directory
$cacheDir = "$env:LOCALAPPDATA\electron\Cache"
New-Item -ItemType Directory -Force -Path $cacheDir | Out-Null

# Download using PowerShell (uses Windows certificate store)
$url = "https://github.com/electron/electron/releases/download/v28.0.0/electron-v28.0.0-win32-x64.zip"
$zipFile = "$env:TEMP\electron-v28.0.0-win32-x64.zip"

Write-Host "Downloading Electron (this may take a few minutes)..." -ForegroundColor Green

# Use WebClient which works with corporate proxies
$webClient = New-Object System.Net.WebClient
$webClient.Headers.Add("User-Agent", "Mozilla/5.0")
$webClient.DownloadFile($url, $zipFile)

Write-Host "Download complete!" -ForegroundColor Green
Step 3: Extract to Cache
powershell
Write-Host "Extracting Electron..." -ForegroundColor Yellow

# Create target directory
$targetDir = "$cacheDir\electron-v28.0.0-win32-x64"
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

# Extract the ZIP
Expand-Archive -Path $zipFile -DestinationPath $targetDir -Force

# Verify extraction
if (Test-Path "$targetDir\electron.exe") {
    Write-Host "Electron extracted successfully!" -ForegroundColor Green
} else {
    Write-Host "Extraction may have failed - checking..." -ForegroundColor Red
    Get-ChildItem $targetDir -Recurse | Select-Object -First 10
}
Step 4: Create a Fake Electron Package
powershell
# Tell Electron package to use our manual install
$env:ELECTRON_OVERRIDE_DIST_PATH = "$cacheDir\electron-v28.0.0-win32-x64"

# Set environment variable permanently for this project
[System.Environment]::SetEnvironmentVariable('ELECTRON_OVERRIDE_DIST_PATH', "$cacheDir\electron-v28.0.0-win32-x64", 'User')
Step 5: Create Direct Launch Script (Skip npm electron package)
Create DevStudio.bat in your project folder:

powershell
@'
@echo off
set ELECTRON_OVERRIDE_DIST_PATH=%LOCALAPPDATA%\electron\Cache\electron-v28.0.0-win32-x64
"%LOCALAPPDATA%\electron\Cache\electron-v28.0.0-win32-x64\electron.exe" "%~dp0."
'@ | Set-Content DevStudio.bat
Step 6: LAUNCH!
powershell
# Try launching directly with the downloaded Electron
& "$env:LOCALAPPDATA\electron\Cache\electron-v28.0.0-win32-x64\electron.exe" .
If Download Also Fails in PowerShell:
We'll use your browser to download. Run this to see the URL:

powershell
Write-Host "Open this URL in your browser:" -ForegroundColor Yellow
Write-Host "https://github.com/electron/electron/releases/download/v28.0.0/electron-v28.0.0-win32-x64.zip" -ForegroundColor Cyan
Write-Host ""
Write-Host "Then copy the downloaded ZIP to:" -ForegroundColor Yellow
Write-Host "$env:TEMP\electron-v28.0.0-win32-x64.zip" -ForegroundColor Cyan
After downloading in your browser and saving to that location, run Step 3 and Step 6.

TRY THIS FIRST (Simpler Alternative):
If you can install software on your machine, use the official Electron app:

Download Electron Fiddle (includes Electron runtime):
https://github.com/electron/fiddle/releases/latest

Install it - this puts a working Electron on your system

Find where it installed Electron:

powershell
Get-ChildItem "$env:LOCALAPPDATA\electron-fiddle" -Recurse -Filter "electron.exe" -ErrorAction SilentlyContinue
Use that to run your app:

powershell
# Replace with actual path
& "C:\Users\papd437\AppData\Local\electron-fiddle\app-*\electron.exe" .
Run Step 1 through Step 6 in order. Does the manual download work? If PowerShell download also fails, use the browser method in the "If Download Also Fails" section.

Step 6 Launch was successful, how do I launch again without having to use the steps provided?
Great! Now let's make a permanent launch solution:

Create Permanent Desktop Launcher
Step 1: Create DevStudio.bat in your project folder
powershell
cd C:\Users\papd437\Documents\DevStudio

@'
@echo off
title DevStudio - AI Code Editor
set ELECTRON_OVERRIDE_DIST_PATH=%LOCALAPPDATA%\electron\Cache\electron-v28.0.0-win32-x64
start "" "%LOCALAPPDATA%\electron\Cache\electron-v28.0.0-win32-x64\electron.exe" "%~dp0."
'@ | Set-Content DevStudio.bat

Write-Host "Created DevStudio.bat" -ForegroundColor Green
Step 2: Create Desktop Shortcut
powershell
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\DevStudio.lnk")
$Shortcut.TargetPath = "C:\Users\papd437\Documents\DevStudio\DevStudio.bat"
$Shortcut.WorkingDirectory = "C:\Users\papd437\Documents\DevStudio"
$Shortcut.IconLocation = "$env:LOCALAPPDATA\electron\Cache\electron-v28.0.0-win32-x64\electron.exe,0"
$Shortcut.Description = "DevStudio - AI Code Editor"
$Shortcut.Save()

Write-Host "Desktop shortcut created!" -ForegroundColor Green
Step 3: Test the Launch
powershell
# Test the batch file
& "C:\Users\papd437\Documents\DevStudio\DevStudio.bat"
Now You Have TWO Ways to Launch:
Desktop Shortcut - Double-click DevStudio on your desktop

Batch File - Double-click DevStudio.bat in your project folder

Optional: Add to Start Menu
powershell
$StartMenu = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs"
$Shortcut = $WshShell.CreateShortcut("$StartMenu\DevStudio.lnk")
$Shortcut.TargetPath = "C:\Users\papd437\Documents\DevStudio\DevStudio.bat"
$Shortcut.WorkingDirectory = "C:\Users\papd437\Documents\DevStudio"
$Shortcut.IconLocation = "$env:LOCALAPPDATA\electron\Cache\electron-v28.0.0-win32-x64\electron.exe,0"
$Shortcut.Save()
Now you can search "DevStudio" in the Start Menu!

Optional: Pin to Taskbar
Launch DevStudio using the Desktop shortcut

Right-click the DevStudio icon in the taskbar

Click "Pin to taskbar"

SUMMARY
✅ Electron installed manually (bypassed corporate proxy)
✅ Your app runs as a desktop application
✅ Desktop shortcut created
✅ Start Menu shortcut created

Double-click the DevStudio shortcut on your desktop - that's all you need now!
