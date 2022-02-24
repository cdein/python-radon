import { Range } from "vscode";

export default interface Rating {
    type: string;
    rank: string;
    lineno: number;
    character: number;
    endline: number;
    complexity: number;
    name: string;
    closures: Rating[];
    range: Range;
}
