# DevStudio Project Context for AI Assistant

## Project Overview
DevStudio is a full-featured web-based AI code editor that runs entirely in the browser (with optional Electron desktop support). It features a Monaco editor, file explorer, live HTML preview, AI chat assistant (Ollama/local models + cloud APIs), version history, and GitHub integration.

## File Structure & Responsibilities

| File            | Responsibility                                                                                                                   | When to Edit                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `index.html`    | Main HTML structure, modals, UI skeleton                                                                                         | Changing layout, adding new UI elements, modals                  |
| `styles.css`    | All styling, grid layout, themes, components                                                                                     | Visual changes, responsive design, themes                        |
| `app-core.js`   | App state, storage (localStorage/Electron), initialization, providers config, event listeners, utility functions (toast, modals) | Core app behavior, saving/loading, initialization bugs           |
| `app-editor.js` | Monaco editor setup, fallback editor, language detection, theme/font settings                                                    | Editor loading issues, syntax highlighting, editor behavior      |
| `app-files.js`  | File tree, tabs, folder navigation, file CRUD, preview, version history                                                          | File explorer bugs, creating/deleting files, preview not working |
| `app-ai.js`     | AI provider logic (Ollama/OpenAI/etc.), chat interface, sending messages, parsing JSON operations, auto-apply                    | AI not responding, operations not applying, chat issues          |
| `app-github.js` | GitHub integration, token handling, repo sync, push/pull                                                                         | GitHub connection issues, sync failures                          |
| `app-ui.js`     | Electron desktop features, local folder opening, file system access, modals UI helpers                                           | Desktop app issues, folder picker, file system operations        |

## Key Dependencies
- Monaco Editor (CDN) - code editing
- Tailwind CSS (CDN) - styling
- Font Awesome 6 (CDN) - icons
- Ollama (local) - default AI provider
- Electron (optional) - desktop file system access

## Common Issue Patterns & Likely Files

| Symptom                              | Most Likely File                    |
| ------------------------------------ | ----------------------------------- |
| Editor won't load / blank            | `app-editor.js`                     |
| Can't open/save files                | `app-files.js`                      |
| AI doesn't respond                   | `app-ai.js`                         |
| AI responds but doesn't change files | `app-ai.js` (extractFileOperations) |
| Chat panel not showing messages      | `app-ai.js` (addChatMessage)        |
| File tree not updating               | `app-files.js` (renderFileTree)     |
| Settings not saving                  | `app-core.js` (saveToStorage)       |
| Preview not working                  | `app-files.js` (updatePreview)      |
| GitHub connection fails              | `app-github.js`                     |
| Electron folder picker broken        | `app-ui.js`                         |
| CSS/layout issues                    | `styles.css`                        |
| Tabs not displaying correctly        | `app-files.js` (renderTabs)         |

## Quick Debugging Tips

### AI Operations Not Applying
- Check `app.ai.autoApply` in browser console
- Verify JSON format in AI response matches expected schema
- Look for JSON blocks wrapped in \`\`\`json ... \`\`\`

### Editor Issues
- Check `app.useFallbackEditor` flag
- Verify Monaco CDN is accessible
- Check browser console for loading errors

### File Tree Issues
- Inspect `app.files` object structure in console
- Verify folder paths have trailing slashes for directories
- Check `app.currentFolder` value

### Storage Issues
- Check localStorage for corruption (DevTools > Application > Local Storage)
- For Electron, check electron-store file

## How to Report an Issue

When describing a problem, include:

1. **Symptom**: What's happening vs what should happen
2. **Steps to reproduce**: How to trigger the issue
3. **Console errors**: Any red errors in browser console
4. **Recent changes**: What you modified before issue appeared

## Example Issue Prompt
Issue: AI chat responds but doesn't apply file changes to editor

Context:

Auto-apply is ON in settings

I asked "create a new file called test.js with console.log('hello')"

AI responds with JSON block but file doesn't appear in file tree

Likely file: app-ai.js (extractFileOperations or applyFileOperations methods)

Console errors: None visible

text

## Key Methods Reference

### app-core.js
- `init()` - Application entry point
- `saveToStorage()` / `loadFromStorage()` - Persistence
- `showToast(message, duration)` - Notification system
- `getProjectContext()` - Builds context for AI

### app-editor.js
- `initMonaco()` - Loads and configures Monaco editor
- `setupFallbackEditor()` - Textarea fallback when Monaco fails
- `updateEditorTheme()` - Changes editor color theme

### app-files.js
- `renderFileTree()` - Displays folder/file explorer
- `openFile(filename)` - Loads file into editor
- `updatePreview()` - Refreshes HTML preview iframe
- `applyFileOperations(operations)` - Executes AI-suggested changes

### app-ai.js
- `sendMessage()` - Sends user message to AI
- `callAI(message)` - Makes API request to selected provider
- `extractFileOperations(response)` - Parses JSON from AI response
- `addChatMessage(text, sender)` - Displays message in chat

### app-github.js
- `connectGitHub()` - Authenticates and loads repo
- `deployToGitHub()` - Pushes local files to GitHub

### app-ui.js
- `openLocalFolder()` - Electron folder picker
- `loadLocalFolder(folderPath)` - Reads directory from disk
- `checkLocalOllama()` - Verifies Ollama is running

## Environment Detection

The app uses `window.isElectron` to detect if running in Electron desktop mode:
- `true` - Running as Electron app, has file system access
- `false` - Running in browser, uses localStorage only

## Default AI Configuration

```javascript
{
  provider: 'local',
  model: 'gemma4:latest',
  endpoint: 'http://localhost:11434',
  autoApply: false
}
Common Fixes Checklist
Clear browser localStorage if data corrupted

Check console for JavaScript errors

Verify network tab for failed API calls (Ollama/cloud providers)

Ensure trailing slashes on folder paths (folder/ not folder)

Confirm Monaco CDN is accessible (no CORS/firewall blocks)

For AI issues, test Ollama separately: curl http://localhost:11434/api/tags