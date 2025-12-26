import * as vscode from 'vscode';
import { Agent } from '../core/agent.ts';
import { getFigmaFile } from '../core/figma/figma-api.ts';
import * as path from 'path';
import * as fs from 'fs';

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
          await this._handleGenerate(data.fileKey, data.instructions);
          break;
        }
      }
    });
  }

  private async _handleGenerate(fileKey: string, instructions?: string) {
    if (!fileKey) {
      vscode.window.showErrorMessage('❌ Please provide a Figma File Key');
      return;
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('❌ Please open a workspace folder first');
      return;
    }

    const outputDir = workspaceFolders[0].uri.fsPath;

    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Figmatic: Generating Architect Plan...",
      cancellable: false
    }, async (progress: vscode.Progress<{ message?: string; increment?: number }>) => {
      try {
        progress.report({ message: "Fetching Figma data..." });
        const data = await getFigmaFile(fileKey);
        const firstFrame = data.document.children[0].children[0];

        progress.report({ message: "Processing sections and assets..." });
        const agent = new Agent();
        const artifacts = await agent.processFullPage(firstFrame, fileKey, {}, instructions);

        progress.report({ message: "Writing files to workspace..." });
        for (const art of artifacts) {
          const filePath = path.join(outputDir, art.path);
          const parentDir = path.dirname(filePath);
          if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
          }
          fs.writeFileSync(filePath, art.content, 'utf-8');
        }

        vscode.window.showInformationMessage(`✅ Figmatic: Generated ${artifacts.length} artifacts!`);
      } catch (err: any) {
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
            <label>Figma File Key</label>
            <input type="text" id="fileKey" placeholder="e.g. U3LB45bgtgmp9HI5..." value="U3LB45bgtgmp9HI54EnvTR">
          </div>
          <div class="field">
            <label>Refinement Instructions (Optional)</label>
            <textarea id="instructions" rows="4" placeholder="e.g. Make the header red and add a shadow..."></textarea>
          </div>
          <button id="generateBtn">🚀 Generate Architect Plan</button>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          const generateBtn = document.getElementById('generateBtn');
          const fileKeyInput = document.getElementById('fileKey');
          const instructionsInput = document.getElementById('instructions');

          generateBtn.addEventListener('click', () => {
            const fileKey = fileKeyInput.value;
            const instructions = instructionsInput.value;
            vscode.postMessage({ type: 'generate', fileKey, instructions });
          });
        </script>
      </body>
      </html>
    `;
  }
}
