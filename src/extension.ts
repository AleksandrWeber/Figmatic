import * as vscode from 'vscode';
import { FigmaticSidebarProvider } from './ui/sidebar.ts';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Figmatic is now active!');

  // Load .env from workspace folders
  if (vscode.workspace.workspaceFolders) {
    for (const folder of vscode.workspace.workspaceFolders) {
      const envPath = path.join(folder.uri.fsPath, '.env');
      if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`✅ Figmatic: Loaded .env from ${folder.name}`);
      }
    }
  }

  const provider = new FigmaticSidebarProvider(context.extensionUri);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(FigmaticSidebarProvider.viewType, provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('figmatic.generate', () => {
      vscode.window.showInformationMessage('🚀 Figmatic: Preparation complete. Use the sidebar to initiate generation!');
    })
  );
}

export function deactivate() { }
