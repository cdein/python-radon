import { exec, ExecException } from "child_process";
import { window, workspace } from "vscode";
import Maintainability from "./Maintainability";
import Rating from "./Rating";
import SourcecodeInformation from "./SourcecodeInformation";

export function calculateCyclomaticComplexity(filepath: string): Promise<Rating[]> {
    return new Promise((resolve, reject) => {
        const executable = getRadonExecutable();
        exec(`${executable} cc ${filepath} -j -a --show-closures`, (err: ExecException | null, stdout: string, stderr: string) => {
            if (err) {
                return reject(err);
            }
            const metrics = JSON.parse(stdout);
            let result: Rating[] = [];
            Object.keys(metrics).forEach(key => {
                if (!filepath.endsWith(key)) { return; };
                result = metrics[key].map(mapMetricToRating);
            });
            resolve(result);
        });
    });
}

export function calculateMaintainablityIndex(filepath: string): Promise<Maintainability> {
    return new Promise((resolve, reject) => {
        const executable = getRadonExecutable();
        exec(`${executable} mi ${filepath} -j -s`, (err: ExecException | null, stdout: string, stderr: string) => {
            if (err) {
                console.error(err);
                return reject(err);
            }
            const metrics = JSON.parse(stdout);
            let result: Maintainability = { index: 0, rank: "F" };
            Object.keys(metrics).forEach(key => {
                if (!filepath.endsWith(key)) { return; };
                result = { index: metrics[key].mi, rank: metrics[key].rank };
            });
            resolve(result);
        });
    });
}

export function calculateSourcecodeInformation(filepath: string): Promise<SourcecodeInformation> {
    return new Promise((resolve, reject) => {
        const executable = getRadonExecutable();
        exec(`${executable} raw ${filepath} -j`, (err: ExecException | null, stdout: string, stderr: string) => {
            if (err) {
                console.error(err);
                return reject(err);
            }
            const metrics = JSON.parse(stdout);
            let result: SourcecodeInformation = { loc: 0, lloc: 0, blank: 0, comments: 0, multi: 0, singleComments: 0, sloc: 0 };
            Object.keys(metrics).forEach(key => {
                if (!filepath.endsWith(key)) { return; };
                result = {...metrics[key], singleComments: metrics[key].single_comments};
            });
            resolve(result);
        });
    });
}

export function getVersion(): Promise<number[]> {
    return new Promise((resolve, reject) => {
        const executable = getRadonExecutable();
        exec(`${executable} -v`, (err: ExecException | null, stdout: string, stderr: string) => {
            if (err) {
                return reject(err);
            }
            resolve(stdout.trim().split(".").map(s => parseInt(s, 10)));
        });
    });
}

function getRadonExecutable() {
    return workspace.getConfiguration("python.radon").get("executable", "radon");
}

function mapMetricToRating(metric: any) {
    const character = metric["col_offset"];
    delete metric["col_offset"];
    metric.character = character;
    if (Array.isArray(metric.closures) && metric.closures.length > 0) {
        metric.closures = metric.closures.map(mapMetricToRating);
    }
    return metric;
}
