import { ExtensionContext, languages, commands, Disposable, workspace, window } from 'vscode';
import RadonProvider from './RadonProvider';


let disposables: Disposable[] = [];

export function activate(context: ExtensionContext) {
    const codelensProvider = new RadonProvider();

    languages.registerCodeLensProvider({language: "python", scheme: "file"}, codelensProvider);

    commands.registerCommand("python.radon.enable", () => {
        workspace.getConfiguration("python.radon").update("enable", true, true);
    });

    commands.registerCommand("python.radon.disable", () => {
        workspace.getConfiguration("python.radon").update("enable", false, true);
    });
}

export function deactivate() {
	if (disposables) {
        disposables.forEach(item => item.dispose());
    }
    disposables = [];
}
