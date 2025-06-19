const { ThemeSimilarityService } = require('./dist/index.js');

// Mock themes with clear consolidation opportunities
const mockThemes = [
  {
    id: '1',
    name: 'Remove greeting workflow input',
    description: 'Remove greeting parameter from GitHub Actions workflow',
    level: 0,
    childIds: [],
    affectedFiles: ['workflow.yml'],
    codeSnippets: ['workflow changes'],
    confidence: 0.9,
    context: 'Remove greeting from workflow',
    lastAnalysis: new Date()
  },
  {
    id: '2', 
    name: 'Remove greeting workflow input',
    description: 'Remove greeting parameter from local test workflow',
    level: 0,
    childIds: [],
    affectedFiles: ['local-test.yml'],
    codeSnippets: ['local workflow changes'],
    confidence: 0.9,
    context: 'Remove greeting from local workflow',
    lastAnalysis: new Date()
  },
  {
    id: '3',
    name: 'Remove greeting validation',
    description: 'Remove greeting validation from input validation',
    level: 0,
    childIds: [],
    affectedFiles: ['validation.ts'],
    codeSnippets: ['validation changes'],
    confidence: 0.8,
    context: 'Remove greeting validation logic',
    lastAnalysis: new Date()
  },
  {
    id: '4',
    name: 'Add theme service implementation',
    description: 'Implement comprehensive theme analysis service',
    level: 0,
    childIds: [],
    affectedFiles: ['theme-service.ts'],
    codeSnippets: ['service implementation'],
    confidence: 0.9,
    context: 'Add new theme analysis functionality',
    lastAnalysis: new Date()
  },
  {
    id: '5',
    name: 'Add theme similarity service',
    description: 'Implement theme consolidation and similarity detection',
    level: 0,
    childIds: [],
    affectedFiles: ['theme-similarity.ts'],
    codeSnippets: ['similarity implementation'],
    confidence: 0.9,
    context: 'Add theme consolidation functionality',
    lastAnalysis: new Date()
  }
];

console.log('Testing theme consolidation...');
console.log(`Input: ${mockThemes.length} themes`);

const similarityService = new ThemeSimilarityService();
const consolidated = similarityService.consolidateThemes(mockThemes);

console.log(`Output: ${consolidated.length} consolidated themes`);
console.log(`Reduction: ${((mockThemes.length - consolidated.length) / mockThemes.length * 100).toFixed(1)}%`);

console.log('\nFinal themes:');
consolidated.forEach(theme => {
  const prefix = '  '.repeat(theme.level);
  console.log(`${prefix}- ${theme.name} (${theme.confidence.toFixed(2)})`);
  if (theme.childThemes.length > 0) {
    theme.childThemes.forEach(child => {
      const childPrefix = '  '.repeat(child.level);
      console.log(`${childPrefix}- ${child.name} (${child.confidence.toFixed(2)})`);
    });
  }
});