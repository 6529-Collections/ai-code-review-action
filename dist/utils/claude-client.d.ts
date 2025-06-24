/**
 * Simple Claude client for making AI calls
 */
export declare class ClaudeClient {
    private readonly anthropicApiKey;
    constructor(anthropicApiKey: string);
    callClaude(prompt: string): Promise<string>;
}
