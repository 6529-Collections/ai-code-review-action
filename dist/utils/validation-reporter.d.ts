import { ValidationReport } from '../services/theme-validator';
export declare class ValidationReporter {
    generateReport(validation: ValidationReport): string;
    private formatConsistencySection;
    private formatCrossValidationSection;
    private formatGranularitySection;
    private formatBusinessLogicSection;
    private formatRecommendationsSection;
    private getScoreEmoji;
    saveReport(validation: ValidationReport, filePath?: string): void;
    printSummary(validation: ValidationReport): void;
}
