const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let ollamaProcess = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1024,
        minHeight: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        title: 'DevStudio Desktop',
        icon: path.join(__dirname, 'icon.png'),
        backgroundColor: '#0f172a'
    });

    // Load your existing DevStudio HTML
    mainWindow.loadFile('index.html');

    // Open DevTools in development
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Handle Ollama process management
function startOllama() {
    return new Promise((resolve, reject) => {
        try {
            // Check if Ollama is already running
            const checkProcess = spawn('ollama', ['list']);

            checkProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('Ollama is already running');
                    resolve(true);
                } else {
                    // Start Ollama if not running
                    console.log('Starting Ollama...');
                    ollamaProcess = spawn('ollama', ['serve'], {
                        detached: true,
                        stdio: 'ignore'
                    });
                    resolve(true);
                }
            });

            checkProcess.on('error', () => {
                // Ollama not installed
                console.log('Ollama not found');
                resolve(false);
            });
        } catch (error) {
            console.error('Error starting Ollama:', error);
            resolve(false);
        }
    });
}

// IPC Handlers for file system operations
ipcMain.handle('save-file', async (event, { path, content }) => {
    const fs = require('fs').promises;
    try {
        await fs.writeFile(path, content, 'utf8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result;
});

ipcMain.handle('read-file', async (event, filePath) => {
    const fs = require('fs').promises;
    try {
        const content = await fs.readFile(filePath, 'utf8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Start Ollama when the app starts
app.whenReady().then(async () => {
    await startOllama();
    createWindow();
});

app.on('window-all-closed', () => {
    if (ollamaProcess) {
        ollamaProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});