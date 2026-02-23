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
