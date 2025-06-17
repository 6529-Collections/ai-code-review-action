export interface ActionInputs {
    greeting: string;
    githubToken?: string;
    anthropicApiKey: string;
    enableClaude: boolean;
}
export interface ClaudeResponse {
    success: boolean;
    message: string;
    error?: string;
}
export interface ActionOutputs {
    message: string;
    claudeResponse?: string;
}
