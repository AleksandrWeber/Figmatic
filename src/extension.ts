import * as vscode from 'vscode';
import { FigmaticSidebarProvider } from './ui/sidebar.ts';

export function activate(context: vscode.ExtensionContext) {
  console.log('🚀 Figmatic is now active!');

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
