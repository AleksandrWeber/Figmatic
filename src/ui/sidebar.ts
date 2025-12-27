import * as vscode from 'vscode';
import { Agent } from '../core/agent.ts';
import { getFigmaFile } from '../core/figma/figma-api.ts';
import * as path from 'path';
import * as fs from 'fs';

function extractFileKey(input: string): string {
  const trimmed = input.trim();
  // Match Figma URL patterns: figma.com/file/KEY/... or figma.com/design/KEY/...
  const match = trimmed.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9_]+)/);
  return match ? match[1] : trimmed;
}

export class FigmaticSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'figmatic.sidebar';
  private _view?: vscode.WebviewView;
  private _activeAgent?: Agent;

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
        case 'fontResolution': {
          if (this._activeAgent) {
            this._activeAgent.resolveFontDecision(data.decision);
          }
          break;
        }
      }
    });
  }

  private async _handleGenerate(rawFileKey: string, instructions?: string, figmaToken?: string, geminiToken?: string, customOutputDir?: string) {
    try {
      const fileKey = extractFileKey(rawFileKey);

      // Prioritize VS Code Config for Gemini API Key
      const config = vscode.workspace.getConfiguration('figmatic');
      const configGeminiKey = config.get<string>('geminiApiKey');

      if (figmaToken) process.env.FIGMA_TOKEN = figmaToken;
      if (geminiToken) process.env.GEMINI_API_KEY = geminiToken;
      if (configGeminiKey) process.env.GEMINI_API_KEY = configGeminiKey;

      if (!fileKey) {
        throw new Error('Please provide a Figma File Key or URL');
      }

      this._view?.webview.postMessage({ type: 'status', message: '📡 Connecting to Figma API...' });

      const workspaceFolders = vscode.workspace.workspaceFolders;
      let outputDir = customOutputDir;

      if (!outputDir) {
        if (!workspaceFolders) {
          throw new Error('Please open a workspace folder first or pick a destination.');
        }
        outputDir = workspaceFolders[0].uri.fsPath;
      }

      // Determine Project Directory and Cleanup
      const data = await getFigmaFile(fileKey, (msg) => {
        this._view?.webview.postMessage({ type: 'status', message: msg });
      });
      this._view?.webview.postMessage({ type: 'status', message: `✅ Draft "${data.name}" retrieved.` });

      const projectName = data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'figmatic_project';
      const projectDir = path.join(outputDir, projectName);

      if (fs.existsSync(projectDir)) {
        this._view?.webview.postMessage({ type: 'status', message: `🧹 Cleaning up folder "${projectName}"...` });
        fs.rmSync(projectDir, { recursive: true, force: true });
      }
      fs.mkdirSync(projectDir, { recursive: true });

      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Figmatic: Generating Architect Plan...",
        cancellable: false
      }, async (progress) => {
        this._view?.webview.postMessage({ type: 'status', message: '🧠 AI Architect is planning...' });
        progress.report({ message: "Analyzing architecture..." });

        // Smart Search for First Frame/Component
        const findFirstMainNode = (node: any): any => {
          if (node.type === 'FRAME' || node.type === 'COMPONENT') return node;
          if (node.children) {
            for (const child of node.children) {
              const found = findFirstMainNode(child);
              if (found) return found;
            }
          }
          return null;
        };

        const firstFrame = findFirstMainNode(data.document) || (data.document.children?.[0]?.children?.[0]);
        if (!firstFrame) {
          throw new Error("Could not find any frames or components in this Figma file. Please ensure the file is not empty.");
        }

        const styleFramework = config.get<string>('styleFramework') || 'scss';
        const generateStorybook = config.get<boolean>('generateStorybook') || false;

        this._activeAgent = new Agent();
        const artifacts = await this._activeAgent.processFullPage(firstFrame, fileKey, projectDir, { styleFramework, generateStorybook }, instructions, (msg) => {
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

        // --- Git Initializer ---
        try {
          const { execSync } = require('child_process');
          execSync('git init', { cwd: projectDir, stdio: 'ignore' });
          this._view?.webview.postMessage({ type: 'status', message: '🚀 Git repository initialized' });
        } catch (gitErr) {
          console.warn("Git initialization failed:", gitErr);
        }

        const suggestions = await this._activeAgent.getPostGenerationSuggestions(projectName);
        this._view?.webview.postMessage({ type: 'completed', projectName, suggestions });

        const openAction = "Open Folder";
        vscode.window.showInformationMessage(`✅ Figmatic: Generated ${artifacts.length} artifacts in "${projectName}"!`, openAction)
          .then(selection => {
            if (selection === openAction) {
              const uri = vscode.Uri.file(projectDir);
              vscode.commands.executeCommand('vscode.openFolder', uri, true);
            }
          });
      });
    } catch (err: any) {
      this._view?.webview.postMessage({ type: 'error', message: err.message });
      vscode.window.showErrorMessage(`💥 Figmatic Error: ${err.message}`);
    }
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
          button:disabled { opacity: 0.5; cursor: not-allowed; }
          h2 { font-size: 1.2rem; margin-bottom: 20px; text-align: center; color: var(--vscode-button-background); }
          .logo { text-align: center; margin-bottom: 10px; }
          .logo h1 { color: var(--vscode-button-background); margin: 0; }
          
          #progressContainer { display: none; margin-top: 15px; background: #1e1e1e; padding: 10px; border-radius: 4px; border: 1px solid #333; }
          #timer { color: #61afef; font-family: monospace; font-size: 1.1rem; margin-bottom: 5px; font-weight: bold; }
          #log { color: #abb2bf; font-family: monospace; font-size: 0.85rem; max-height: 200px; overflow-y: auto; }
          
          .font-dialog { margin-top: 10px; background: #2c313a; padding: 10px; border-radius: 4px; border-left: 4px solid #e06c75; }
          .font-dialog h3 { color: #e06c75; margin-top: 0; font-size: 0.9rem; }
          .font-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.8rem; }
          .font-table th, .font-table td { text-align: left; padding: 4px; border-bottom: 1px solid #3e4451; }
          .font-actions { display: flex; gap: 5px; margin-top: 10px; }
          .btn-small { padding: 5px 10px; font-size: 0.75rem; }
          .btn-secondary { background: #4b5263; }
        </style>
      </head>
      <body>
        <div class="logo"><h1>Figmatic</h1></div>
        <div class="container">
          <div class="field">
            <label>Figma URL or File Key</label>
            <input type="text" id="fileKey" placeholder="Paste Figma URL here..." value="U3LB45bgtgmp9HI54EnvTR">
          </div>
          <div class="field">
            <label>Output Directory</label>
            <div style="display: flex; gap: 5px;">
              <input type="text" id="outputDir" placeholder="Current workspace" readonly>
              <button id="pickFolderBtn" style="padding: 5px;">📁</button>
            </div>
          </div>
          <div class="field">
            <label>Instructions (Optional)</label>
            <textarea id="instructions" rows="2" placeholder="e.g. Make it dark theme..."></textarea>
          </div>
          <button id="generateBtn">🚀 Generate Architect Plan</button>
          <div id="progressContainer">
            <div id="timer">Estimated: <span id="timeValue">02:00</span></div>
            <div id="log">> Initializing Agent...</div>
          </div>
          <div id="activeDialogue"></div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const generateBtn = document.getElementById('generateBtn');
          const fileKeyInput = document.getElementById('fileKey');
          const instructionsInput = document.getElementById('instructions');
          const outputDirInput = document.getElementById('outputDir');
          const pickFolderBtn = document.getElementById('pickFolderBtn');
          const progressContainer = document.getElementById('progressContainer');
          const activeDialogue = document.getElementById('activeDialogue');
          const log = document.getElementById('log');
          const timeValue = document.getElementById('timeValue');
          
          let timerInterval;
          let secondsLeft = 120;

          function updateTimer() {
            const m = Math.floor(secondsLeft / 60);
            const s = secondsLeft % 60;
            timeValue.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            if (secondsLeft > 0) secondsLeft--;
          }

          function startTimer() { secondsLeft = 120; updateTimer(); timerInterval = setInterval(updateTimer, 1000); }
          function stopTimer() { clearInterval(timerInterval); }

          pickFolderBtn.addEventListener('click', () => vscode.postMessage({ type: 'pickFolder' }));

          window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'folderPicked') {
              outputDirInput.value = message.path;
            } else if (message.type === 'status') {
              if (message.message.startsWith('⚠️ detected_commercial_fonts:')) {
                const fonts = JSON.parse(message.message.split(':')[1]);
                renderFontDialogue(fonts);
              } else {
                const div = document.createElement('div');
                div.textContent = '> ' + message.message;
                log.appendChild(div);
                log.scrollTop = log.scrollHeight;
              }
            } else if (message.type === 'completed') {
              stopTimer();
              const div = document.createElement('div');
              div.style.color = '#98c379';
              div.style.marginTop = '10px';
              div.textContent = '✅ DONE! Project created.';
              log.appendChild(div);
              generateBtn.disabled = false;
            } else if (message.type === 'error') {
              stopTimer();
              const div = document.createElement('div');
              div.style.color = '#e06c75';
              div.textContent = '❌ ' + message.message;
              log.appendChild(div);
              generateBtn.disabled = false;
            }
          });

          function renderFontDialogue(fonts) {
            let html = '<div class="font-dialog"><h3>⚠️ Commercial Fonts</h3>';
            html += '<p style="font-size:0.75rem;margin:5px 0;">Licensing detected. Replace with Google Fonts?</p>';
            html += '<table class="font-table"><tr><th>Figma</th><th>Google Font</th></tr>';
            fonts.forEach(f => {
              html += '<tr><td>' + f.family + '</td><td>' + f.suggestion + '</td></tr>';
            });
            html += '</table><div class="font-actions">';
            html += '<button class="btn-small" id="replaceFontsBtn">Replace All</button>';
            html += '<button class="btn-small btn-secondary" id="keepFontsBtn">Keep All</button>';
            html += '</div></div>';
            activeDialogue.innerHTML = html;

            document.getElementById('replaceFontsBtn').onclick = () => {
              const decision = {};
              fonts.forEach(f => decision[f.family] = f.suggestion);
              submitDecision(decision);
            };
            document.getElementById('keepFontsBtn').onclick = () => submitDecision({});
          }

          function submitDecision(decision) {
            activeDialogue.innerHTML = '';
            vscode.postMessage({ type: 'fontResolution', decision });
          }

          generateBtn.addEventListener('click', () => {
            generateBtn.disabled = true;
            progressContainer.style.display = 'block';
            activeDialogue.innerHTML = '';
            log.innerHTML = '<div>> Analyzing Figma Design...</div>';
            startTimer();
            vscode.postMessage({ 
              type: 'generate', 
              fileKey: fileKeyInput.value, 
              instructions: instructionsInput.value,
              outputDir: outputDirInput.value
            });
          });
        </script>
      </body>
      </html>
    `;
  }
}
