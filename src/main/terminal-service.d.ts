import { EventEmitter } from 'events';

declare class TerminalService extends EventEmitter {
    private terminals: Map<string, any>;
    private defaultOptions: TerminalOptions;

    createTerminal(options?: Partial<TerminalOptions>): string;
    write(terminalId: string, data: string): void;
    resize(terminalId: string, cols: number, rows: number): void;
    closeTerminal(terminalId: string): void;
    closeAllTerminals(): void;
    getTerminalCount(): number;

    on(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
}

interface TerminalOptions {
    name: string;
    cols: number;
    rows: number;
    cwd: string;
    env: NodeJS.ProcessEnv;
}

declare const terminalServiceInstance: TerminalService;
export = terminalServiceInstance;