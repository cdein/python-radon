import { basename } from 'path';

import { CancellationToken, CodeLens, CodeLensProvider, commands, Event, EventEmitter, Position, Range, StatusBarAlignment, StatusBarItem, TextDocument, ThemeColor, window, workspace } from 'vscode';

import Maintainability from './Maintainability';
import * as radon from './Radon';
import RadonNotFoundException from './RadonNotFoundException';
import Rating from './Rating';
import SourcecodeInformation from './SourcecodeInformation';
import UnsupportedVersionException from './UnsupportedVersionException';

let TERMINAL_ID = 1;
const colors = {
    status: {
        default: {
            foreground: new ThemeColor("statusBarItem.foreground"),
            background: new ThemeColor("statusBarItem.background")
        },
        warning: {
            foreground: new ThemeColor("statusBarItem.warningForeground"),
            background: new ThemeColor("statusBarItem.warningBackground")
        },
        error: {
            foreground: new ThemeColor("statusBarItem.errorForeground"),
            background: new ThemeColor("statusBarItem.errorBackground")
        }
    }
};

function capitalize(text: string) {
    if (!text) { return text; }
    return text[0].toUpperCase() + text.substring(1);
}

export default class RadonProvider implements CodeLensProvider {

    private codeLenses: CodeLens[] = [];
    private sourcecodeInformations: { [key: string]: SourcecodeInformation } = {};
    private maintainabilities: { [key: string]: Maintainability } = {};
    private ratings: { [key: string]: Rating[] } = {};

    private maintainabilityStatusItem: StatusBarItem | null = null;

    private _onDidChangeCodeLenses: EventEmitter<void> = new EventEmitter<void>();
    public readonly onDidChangeCodeLenses: Event<void> = this._onDidChangeCodeLenses.event;


    constructor() {
        this.registerHandler();
        this.maintainabilityStatusItem = window.createStatusBarItem("python.radon.maintainability", StatusBarAlignment.Left, 50);
        if (window.activeTextEditor) {
            this.retrieveData(window.activeTextEditor.document);
        }
    }

    private registerHandler() {
        workspace.onDidChangeTextDocument(e => {
            this.ratings[e.document.fileName] = [];
            this._onDidChangeCodeLenses.fire();
        });
        workspace.onDidOpenTextDocument(e => this.retrieveData(e));
        workspace.onDidSaveTextDocument(e => this.retrieveData(e));
        window.onDidChangeActiveTextEditor(e => e && this.retrieveData(e.document));

        workspace.onDidCloseTextDocument(event => {
            if (event.fileName in this.maintainabilities) {
                delete this.maintainabilities[event.fileName];
            }
            if (event.fileName in this.ratings) {
                delete this.ratings[event.fileName];
            }
        });
    }

    private retrieveData(document: TextDocument) {
        radon.getVersion().then(version => {
            const [major, minor] = version;
            if (major < 5 || minor < 1) {
                throw new UnsupportedVersionException("You need at least python radon version 5.1 installed. Try pip install \"radon>=5.1\".");
            }
            return Promise.all([
                radon.calculateCyclomaticComplexity(document.fileName),
                radon.calculateMaintainablityIndex(document.fileName),
                radon.calculateSourcecodeInformation(document.fileName)]);
        }).then(([ratings, maintainability, sourcecodeInformation]) => {
            this.sourcecodeInformations[document.fileName] = sourcecodeInformation;
            this.maintainabilities[document.fileName] = maintainability;
            this.ratings[document.fileName] = ratings
                .map(rating => resolveRatingRange(rating, document))
                .filter(rating => !!rating.range);
            this._onDidChangeCodeLenses.fire();
        }).catch((err) => {
            if (err instanceof UnsupportedVersionException || err instanceof RadonNotFoundException) {
                window.showInformationMessage(err.message, ...["Edit settings", "Install Radon"])
                    .then(selection => {
                        if (selection === "Install Radon") {
                            const terminal = window.createTerminal(`Install Radon ${TERMINAL_ID++}`);
                            terminal.show(true);
                            terminal.sendText("pip install --user \"radon>=5.1\"", true);
                        } else if (selection === "Edit settings") {
                            commands.executeCommand('workbench.action.openSettings', 'python.radon.executable');
                        }
                    });
                return;
            }
            window.showErrorMessage(err.message);
        });
    }

    private createRatingCodeLens(rating: Rating): CodeLens {
        const { name, type, complexity, rank, range } = rating;
        const risk = getRiskMessage(rank);
        const message = `${capitalize(type)} "${name}" is rated ${rank} by a complexity of ${complexity}. The risk is ${risk}`;
        return new CodeLens(range, {
            title: message,
            tooltip: message,
            command: ""
        });
    }

    private createMaintainabilityCodeLens(range: Range, filename: string, maintainability: Maintainability,
        sourcecodeInformation: SourcecodeInformation): CodeLens {
        const { index, rank } = maintainability;
        const rangeInformation = getRangeInformation(rank);
        const sourcecodeSummary = getSourcecodeInformation(sourcecodeInformation);
        const message = `${basename(filename)} is rated ${rank} with a maintainability index of ${index.toFixed(2)} ${rangeInformation}`;
        return new CodeLens(range, {
            title: message,
            tooltip: `${message}\n\n${sourcecodeSummary}`,
            command: ""
        });
    }

    private updateMaintainabilityStatus(maintainability: Maintainability): void {
        if (!this.maintainabilityStatusItem) {
            return;
        }
        const [color, backcolor] = getStatusColors(maintainability.index);
        this.maintainabilityStatusItem.color = color;
        this.maintainabilityStatusItem.backgroundColor = backcolor;
        this.maintainabilityStatusItem.text = `$(file-code) ${maintainability.index.toFixed(2)} (${maintainability.rank})`;
        this.maintainabilityStatusItem.tooltip = `Python Radon Maintainability\n\nIndex: ${maintainability.index.toFixed(2)}\nRank: ${maintainability.rank}`;
        this.maintainabilityStatusItem.show();
    }

    public provideCodeLenses(document: TextDocument, token: CancellationToken): CodeLens[] | Thenable<CodeLens[]> {
        if (!workspace.getConfiguration("python.radon").get("enable", true)
            || !this.ratings[document.fileName] || this.ratings[document.fileName].length === 0
            || !this.maintainabilities[document.fileName]) {
            return [];
        }
        this.updateMaintainabilityStatus(this.maintainabilities[document.fileName]);
        this.codeLenses = this.ratings[document.fileName].map(this.createRatingCodeLens);
        let range = document.getWordRangeAtPosition(new Position(0, 0));
        if (range === undefined) {
            return this.codeLenses;
        }
        this.codeLenses.push(this.createMaintainabilityCodeLens(range, document.fileName,
            this.maintainabilities[document.fileName], this.sourcecodeInformations[document.fileName]));
        return this.codeLenses;
    }

    public resolveCodeLens(codeLens: CodeLens, token: CancellationToken) {
        if (!workspace.getConfiguration("python.radon").get("enable", true)) {
            return null;
        }
        return codeLens;
    }
}

function resolveRatingRange(rating: Rating, document: TextDocument): Rating {
    const { lineno, character } = rating;
    const position = new Position(lineno - 1, character);
    const range = document.getWordRangeAtPosition(position);
    if (range) {
        rating.range = range;
    }
    return rating;
}

function getSourcecodeInformation({ loc, lloc, sloc, comments, blank, multi }: SourcecodeInformation): string {
    return `Lines of code: ${loc}
Logical lines of code: ${lloc}
Source lines of code: ${sloc}
Amount of single line comments: ${comments}
Amount of multi line strings: ${multi}
Number of blank lines: ${blank}`;
}

function getRangeInformation(rank: string): string {
    switch (rank) {
        case "B":
            return "(19-10, medium)";
            break;
        case "C":
            return "(9-0, extremely low)";
            break;
        default:
            return "(100-20 = very high)";
    }
}

function getRiskMessage(rank: string): string {
    switch (rank) {
        case "A":
            return "low - simple block";
        case "B":
            return "low - well structured and stable block";
        case "C":
            return "moderate - slightly complex block";
        case "D":
            return "more than moderate - more complex block";
        case "E":
            return "high - complex block, alarming";
        default:
            return "very high - error - prone, unstable block";
    }
}

function getStatusColors(maintainabilityIndex: number): ThemeColor[] {
    if (maintainabilityIndex >= 20) {
        return [colors.status.default.foreground, colors.status.default.background];
    }
    if (maintainabilityIndex >= 10) {
        return [colors.status.warning.foreground, colors.status.warning.background];
    }
    return [colors.status.error.foreground, colors.status.error.background];
}
