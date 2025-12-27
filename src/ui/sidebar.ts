import * as vscode from 'vscode';
import { Agent } from '../core/agent.ts';
import { getFigmaFile } from '../core/figma/figma-api.ts';
import * as path from 'path';
import * as fs from 'fs';

function extractFileKey(input: string): string {
  const trimmed = input.trim();
  // Match Figma URL pattern: figma.com/file/KEY/...
  const match = trimmed.match(/figma\.com\/file\/([a-zA-Z0-9]+)/);
  return match ? match[1] : trimmed;
}

export class FigmaticSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'figmatic.sidebar';
  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('🔍 Figmatic: Resolving Sidebar Webview...');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    try {
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
      console.log('✅ Figmatic: Webview HTML set.');
    } catch (err) {
      console.error('❌ Figmatic: Failed to set webview HTML:', err);
    }

    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      switch (data.type) {
        case 'generate': {
          await this._handleGenerate(data.fileKey, data.instructions, data.figmaToken, data.geminiToken, data.outputDir);
          break;
        }
        case 'pickFolder': {
          const uri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Output Folder'
          });
          if (uri && uri[0]) {
            webviewView.webview.postMessage({ type: 'folderPicked', path: uri[0].fsPath });
          }
          break;
        }
      }
    });
  }

  private async _handleGenerate(rawFileKey: string, instructions?: string, figmaToken?: string, geminiToken?: string, customOutputDir?: string) {
    const fileKey = extractFileKey(rawFileKey);

    // Prioritize VS Code Config for Gemini API Key
    const config = vscode.workspace.getConfiguration('figmatic');
    const configGeminiKey = config.get<string>('geminiApiKey');

    if (figmaToken) process.env.FIGMA_TOKEN = figmaToken;
    if (geminiToken) process.env.GEMINI_API_KEY = geminiToken;
    if (configGeminiKey) process.env.GEMINI_API_KEY = configGeminiKey;

    if (!fileKey) {
      vscode.window.showErrorMessage('❌ Please provide a Figma File Key');
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    let outputDir = customOutputDir;

    if (!outputDir) {
      if (!workspaceFolders) {
        vscode.window.showErrorMessage('❌ Please open a workspace folder first or pick a destination.');
        return;
      }
      outputDir = workspaceFolders[0].uri.fsPath;
    }

    // Determine Project Directory and Cleanup
    const data = await getFigmaFile(fileKey); // Fetch Figma data early to get project name
    const projectName = data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'figmatic_project';
    const projectDir = path.join(outputDir, projectName);

    if (fs.existsSync(projectDir)) {
      this._view?.webview.postMessage({ type: 'status', message: `🧹 Cleaning up existing folder "${projectName}"...` });
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectDir, { recursive: true });


    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Figmatic: Generating Architect Plan...",
      cancellable: false
    }, async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
      try {
        progress.report({ message: "Analyzing architecture..." });
        this._view?.webview.postMessage({ type: 'status', message: '🧠 AI Architect is planning...' });

        const firstFrame = data.document.children[0].children[0];
        const agent = new Agent();
        const artifacts = await agent.processFullPage(firstFrame, fileKey, projectDir, {}, instructions, (msg) => {
          this._view?.webview.postMessage({ type: 'status', message: msg });
        });

        progress.report({ message: "Writing files to workspace..." });
        this._view?.webview.postMessage({ type: 'status', message: '📁 Writing files...' });

        for (const art of artifacts) {
          const filePath = path.join(projectDir, art.path);
          const parentDir = path.dirname(filePath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(filePath, art.content, 'utf-8');
        }

        const suggestions = await agent.getPostGenerationSuggestions(projectName);
        this._view?.webview.postMessage({ type: 'completed', projectName, suggestions });
        vscode.window.showInformationMessage(`✅ Figmatic: Generated ${artifacts.length} artifacts in folder "${projectName}"!`);
      } catch (err: any) {
        this._view?.webview.postMessage({ type: 'error', message: err.message });
        vscode.window.showErrorMessage(`💥 Figmatic Error: ${err.message}`);
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: sans-serif; padding: 10px; color: var(--vscode-foreground); }
          .container { display: flex; flex-direction: column; gap: 15px; }
          .field { display: flex; flex-direction: column; gap: 5px; }
          input, textarea { 
            background: var(--vscode-input-background); 
            color: var(--vscode-input-foreground); 
            border: 1px solid var(--vscode-input-border);
            padding: 8px;
            border-radius: 4px;
          }
          button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px;
            cursor: pointer;
            border-radius: 4px;
            font-weight: bold;
          }
          button:hover { background: var(--vscode-button-hoverBackground); }
          h2 { font-size: 1.2rem; margin-bottom: 20px; text-align: center; color: var(--vscode-button-background); }
          .logo { text-align: center; margin-bottom: 10px; }
          .logo img { width: 64px; }
        </style>
      </head>
      <body>
        <div class="logo">
           <h1>Figmatic</h1>
        </div>
        <div class="container">
          <div class="field">
            <label>Figma URL or File Key</label>
            <input type="text" id="fileKey" placeholder="Paste Figma URL here..." value="U3LB45bgtgmp9HI54EnvTR">
          </div>

          <div class="field">
            <label>Output Directory (Optional)</label>
            <div style="display: flex; gap: 5px;">
              <input type="text" id="outputDir" placeholder="Current workspace" readonly>
              <button id="pickFolderBtn" style="padding: 5px;">📁</button>
            </div>
          </div>

          <div class="field">
            <label>Figma API Token (Optional if .env exists)</label>
            <input type="password" id="figmaToken" placeholder="Paste your Figma token here...">
          </div>

          <div class="field">
            <label>Gemini API Key (Optional if settings/.env exist)</label>
            <input type="password" id="geminiToken" placeholder="Overridden by VS Code settings...">
          </div>

          <div class="field">
            <label>Refinement Instructions (Optional)</label>
            <textarea id="instructions" rows="3" placeholder="e.g. Make the header red..."></textarea>
          </div>
          
          <button id="generateBtn">🚀 Generate Architect Plan</button>

          <div id="progressContainer" style="display: none; margin-top: 15px; background: #1e1e1e; padding: 10px; border-radius: 4px; border: 1px solid #333;">
            <div id="timer" style="color: #61afef; font-family: monospace; font-size: 1.1rem; margin-bottom: 5px; font-weight: bold;">
              Estimated: <span id="timeValue">02:00</span>
            </div>
            <div id="log" style="color: #abb2bf; font-family: monospace; font-size: 0.85rem; height: 100px; overflow-y: auto;">
              > Waiting for architecture plan...
            </div>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const generateBtn = document.getElementById('generateBtn');
          const progressContainer = document.getElementById('progressContainer');
          const log = document.getElementById('log');
          const timeValue = document.getElementById('timeValue');
          
          let timerInterval;
          let secondsLeft = 120;

          function updateTimer() {
            const m = Math.floor(secondsLeft / 60);
            const s = secondsLeft % 60;
            const mm = String(m).padStart(2, '0');
            const ss = String(s).padStart(2, '0');
            timeValue.textContent = mm + ':' + ss;
            if (secondsLeft > 0) secondsLeft--;
          }

          function startTimer() {
            secondsLeft = 120;
            updateTimer();
            timerInterval = setInterval(updateTimer, 1000);
          }

          function stopTimer() {
            clearInterval(timerInterval);
          }

          pickFolderBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'pickFolder' });
          });

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'folderPicked') {
              outputDirInput.value = message.path;
            } else if (message.type === 'status') {
              const div = document.createElement('div');
              div.textContent = \`> \${message.message}\`;
              log.appendChild(div);
              log.scrollTop = log.scrollHeight;
            } else if (message.type === 'completed') {
              stopTimer();
              const div = document.createElement('div');
              div.style.color = '#98c379';
              div.textContent = \`✅ DONE! Find files in "\${message.projectName}"\`;
              log.appendChild(div);
              log.scrollTop = log.scrollHeight;
              generateBtn.disabled = false;
            } else if (message.type === 'error') {
              stopTimer();
              const div = document.createElement('div');
              div.style.color = '#e06c75';
              div.textContent = \`❌ \${message.message}\`;
              log.appendChild(div);
              generateBtn.disabled = false;
            }
          });

          generateBtn.addEventListener('click', () => {
            generateBtn.disabled = true;
            progressContainer.style.display = 'block';
            log.innerHTML = '<div>> Initializing Agent...</div>';
            startTimer();
            
            vscode.postMessage({ 
              type: 'generate', 
              fileKey: fileKeyInput.value, 
              instructions: instructionsInput.value,
              figmaToken: figmaTokenInput.value,
              geminiToken: geminiTokenInput.value,
              outputDir: outputDirInput.value
            });
          });
        </script>
      </body>
      </html>
    `;
  }
}
