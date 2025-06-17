import { ClaudeResponse } from './types';
export declare class ClaudeClient {
    private apiKey;
    constructor(apiKey: string);
    ping(): Promise<ClaudeResponse>;
}
