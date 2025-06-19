import { Theme } from './theme-service';
import * as exec from '@actions/exec';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface AISimilarityResult {
  nameScore: number;
  descriptionScore: number;
  patternScore: number;
  businessScore: number;
  semanticScore: number;
  shouldMerge: boolean;
  confidence: number;
  reasoning: string;
}

export interface SimilarityMetrics {
  nameScore: number; // 0-1 based on theme name similarity
  descriptionScore: number; // 0-1 based on description similarity
  fileOverlap: number; // 0-1 based on affected files overlap
  patternScore: number; // 0-1 based on code pattern similarity
  businessScore: number; // 0-1 based on business impact similarity
  combinedScore: number; // Weighted combination
}

export interface ConsolidatedTheme {
  id: string;
  name: string;
  description: string;
  level: number; // 0=root, 1=child, 2=grandchild
  parentId?: string;
  childThemes: ConsolidatedTheme[];

  // Consolidated data from child themes
  affectedFiles: string[];
  confidence: number; // Average of child confidences
  businessImpact: string; // Combined business impact
  codeSnippets: string[];
  context: string;
  lastAnalysis: Date;

  // Consolidation metadata
  sourceThemes: string[]; // IDs of original themes
  consolidationMethod: 'merge' | 'hierarchy' | 'single';
}

export interface ConsolidationConfig {
  similarityThreshold: number; // 0.8 - threshold for merging
  maxThemesPerParent: number; // 5 - max child themes
  minThemesForParent: number; // 2 - min themes to create parent
  confidenceWeight: number; // 0.3 - how much confidence affects merging
  businessDomainWeight: number; // 0.4 - importance of business similarity
}

export interface MergeDecision {
  action: 'merge' | 'group_under_parent' | 'keep_separate';
  confidence: number;
  reason: string;
  targetThemeId?: string;
}

export class ThemeSimilarityService {
  private config: ConsolidationConfig;
  private anthropicApiKey: string;

  constructor(anthropicApiKey: string, config?: Partial<ConsolidationConfig>) {
    this.anthropicApiKey = anthropicApiKey;
    this.config = {
      similarityThreshold: 0.6, // Lowered from 0.8 to 0.6 for better consolidation
      maxThemesPerParent: 5,
      minThemesForParent: 2,
      confidenceWeight: 0.3,
      businessDomainWeight: 0.4,
      ...config,
    };
    console.log(
      `[CONFIG] Consolidation config: threshold=${this.config.similarityThreshold}, minForParent=${this.config.minThemesForParent}`
    );
  }

  async calculateSimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<SimilarityMetrics> {
    // Use AI for semantic similarity
    const aiSimilarity = await this.calculateAISimilarity(theme1, theme2);

    // Still calculate file overlap (factual)
    const fileOverlap = this.calculateFileOverlap(
      theme1.affectedFiles,
      theme2.affectedFiles
    );

    // Combined score: 80% AI semantic understanding + 20% file overlap
    const combinedScore = aiSimilarity.semanticScore * 0.8 + fileOverlap * 0.2;

    return {
      nameScore: aiSimilarity.nameScore,
      descriptionScore: aiSimilarity.descriptionScore,
      fileOverlap,
      patternScore: aiSimilarity.patternScore,
      businessScore: aiSimilarity.businessScore,
      combinedScore,
    };
  }

  private async calculateAISimilarity(
    theme1: Theme,
    theme2: Theme
  ): Promise<AISimilarityResult> {
    const prompt = this.buildSimilarityPrompt(theme1, theme2);

    try {
      const tempFile = path.join(
        os.tmpdir(),
        `claude-similarity-${Date.now()}.txt`
      );
      fs.writeFileSync(tempFile, prompt);

      let output = '';
      await exec.exec('bash', ['-c', `cat "${tempFile}" | claude`], {
        listeners: {
          stdout: (data: Buffer) => {
            output += data.toString();
          },
        },
      });

      fs.unlinkSync(tempFile);

      const result = this.parseAISimilarityResponse(output);
      console.log(
        `[AI-SIMILARITY] "${theme1.name}" vs "${theme2.name}": ${result.semanticScore.toFixed(2)} (${result.shouldMerge ? 'MERGE' : 'SEPARATE'})`
      );
      console.log(`[AI-SIMILARITY] Reasoning: ${result.reasoning}`);

      return result;
    } catch (error) {
      console.warn(
        `AI similarity failed for "${theme1.name}" vs "${theme2.name}":`,
        error
      );
      // Fallback to basic string matching
      return this.createFallbackSimilarity(theme1, theme2);
    }
  }

  private buildSimilarityPrompt(theme1: Theme, theme2: Theme): string {
    return `You are an expert code reviewer analyzing theme similarity for consolidation.

Compare these two code change themes and determine if they should be merged:

**Theme 1:**
Name: "${theme1.name}"
Description: "${theme1.description}"
Files: ${theme1.affectedFiles.join(', ')}
Confidence: ${theme1.confidence}

**Theme 2:**
Name: "${theme2.name}"  
Description: "${theme2.description}"
Files: ${theme2.affectedFiles.join(', ')}
Confidence: ${theme2.confidence}

Analyze semantic similarity considering:
- Are they the same logical change/feature?
- Do they serve the same business purpose?
- Are they part of the same refactoring effort?
- Would a developer naturally group them together?

Respond in this exact JSON format (no other text):
{
  "nameScore": 0.85,
  "descriptionScore": 0.72,
  "patternScore": 0.68,
  "businessScore": 0.91,
  "semanticScore": 0.79,
  "shouldMerge": true,
  "confidence": 0.88,
  "reasoning": "Both themes relate to removing authentication scaffolding - semantically identical despite different wording"
}`;
  }

  private parseAISimilarityResponse(output: string): AISimilarityResult {
    try {
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          nameScore: parsed.nameScore || 0,
          descriptionScore: parsed.descriptionScore || 0,
          patternScore: parsed.patternScore || 0,
          businessScore: parsed.businessScore || 0,
          semanticScore: parsed.semanticScore || 0,
          shouldMerge: parsed.shouldMerge || false,
          confidence: parsed.confidence || 0,
          reasoning: parsed.reasoning || 'No reasoning provided',
        };
      }
    } catch (error) {
      console.warn('Failed to parse AI similarity response:', error);
    }

    return {
      nameScore: 0,
      descriptionScore: 0,
      patternScore: 0,
      businessScore: 0,
      semanticScore: 0,
      shouldMerge: false,
      confidence: 0,
      reasoning: 'Failed to parse AI response',
    };
  }

  private createFallbackSimilarity(
    theme1: Theme,
    theme2: Theme
  ): AISimilarityResult {
    // Fallback to basic string matching when AI fails
    const nameScore = this.calculateNameSimilarity(theme1.name, theme2.name);
    const descScore = this.calculateDescriptionSimilarity(
      theme1.description,
      theme2.description
    );

    return {
      nameScore,
      descriptionScore: descScore,
      patternScore: 0.3,
      businessScore: 0.3,
      semanticScore: (nameScore + descScore) / 2,
      shouldMerge: nameScore > 0.7,
      confidence: 0.4,
      reasoning: 'AI analysis failed, used basic string matching fallback',
    };
  }

  shouldMerge(similarity: SimilarityMetrics): MergeDecision {
    // Exact or near-exact name matches should always merge
    if (similarity.nameScore >= 0.9) {
      return {
        action: 'merge',
        confidence: similarity.nameScore,
        reason: `Near-identical names: ${similarity.nameScore.toFixed(2)}`,
      };
    }

    // High overall similarity themes
    if (similarity.combinedScore >= this.config.similarityThreshold) {
      return {
        action: 'merge',
        confidence: similarity.combinedScore,
        reason: `High similarity score: ${similarity.combinedScore.toFixed(2)}`,
      };
    }

    // Strong business domain similarity (even with different files)
    if (similarity.businessScore >= 0.7 && similarity.nameScore >= 0.4) {
      return {
        action: 'merge',
        confidence: (similarity.businessScore + similarity.nameScore) / 2,
        reason: `Strong business domain similarity: business=${similarity.businessScore.toFixed(2)}, name=${similarity.nameScore.toFixed(2)}`,
      };
    }

    // Similar names with some business relation
    if (similarity.nameScore >= 0.6 && similarity.businessScore >= 0.5) {
      return {
        action: 'merge',
        confidence: (similarity.nameScore + similarity.businessScore) / 2,
        reason: `Related themes: name=${similarity.nameScore.toFixed(2)}, business=${similarity.businessScore.toFixed(2)}`,
      };
    }

    return {
      action: 'keep_separate',
      confidence: similarity.combinedScore,
      reason: `Insufficient similarity: combined=${similarity.combinedScore.toFixed(2)}, name=${similarity.nameScore.toFixed(2)}, business=${similarity.businessScore.toFixed(2)}`,
    };
  }

  async consolidateThemes(themes: Theme[]): Promise<ConsolidatedTheme[]> {
    console.log(`[CONSOLIDATION] Starting with ${themes.length} themes`);
    if (themes.length === 0) return [];

    // Step 1: Find merge candidates
    console.log(`[CONSOLIDATION] Step 1: Finding merge candidates`);
    const mergeGroups = await this.findMergeGroups(themes);
    console.log(`[CONSOLIDATION] Found ${mergeGroups.size} merge groups`);

    // Step 2: Create consolidated themes
    console.log(`[CONSOLIDATION] Step 2: Creating consolidated themes`);
    const consolidated = this.createConsolidatedThemes(mergeGroups, themes);
    console.log(
      `[CONSOLIDATION] Created ${consolidated.length} consolidated themes`
    );

    // Step 3: Build hierarchies
    console.log(`[CONSOLIDATION] Step 3: Building hierarchies`);
    const hierarchical = this.buildHierarchies(consolidated);
    console.log(
      `[CONSOLIDATION] Final result: ${hierarchical.length} themes (${(((themes.length - hierarchical.length) / themes.length) * 100).toFixed(1)}% reduction)`
    );

    return hierarchical;
  }

  private async findMergeGroups(
    themes: Theme[]
  ): Promise<Map<string, string[]>> {
    const mergeGroups = new Map<string, string[]>();
    const processed = new Set<string>();

    for (let i = 0; i < themes.length; i++) {
      const theme1 = themes[i];

      if (processed.has(theme1.id)) continue;

      const group = [theme1.id];
      processed.add(theme1.id);

      for (let j = i + 1; j < themes.length; j++) {
        const theme2 = themes[j];

        if (processed.has(theme2.id)) continue;

        const similarity = await this.calculateSimilarity(theme1, theme2);
        const decision = this.shouldMerge(similarity);

        console.log(`[MERGE] Comparing "${theme1.name}" vs "${theme2.name}"`);
        console.log(
          `[MERGE] Similarity: name=${similarity.nameScore.toFixed(2)}, desc=${similarity.descriptionScore.toFixed(2)}, files=${similarity.fileOverlap.toFixed(2)}, combined=${similarity.combinedScore.toFixed(2)}`
        );
        console.log(
          `[MERGE] Decision: ${decision.action} (${decision.reason})`
        );

        if (decision.action === 'merge') {
          group.push(theme2.id);
          processed.add(theme2.id);
          console.log(
            `[MERGE] ✅ MERGED: Added "${theme2.name}" to group with "${theme1.name}"`
          );
        }
      }

      mergeGroups.set(theme1.id, group);
    }

    return mergeGroups;
  }

  private createConsolidatedThemes(
    mergeGroups: Map<string, string[]>,
    themes: Theme[]
  ): ConsolidatedTheme[] {
    const themeMap = new Map<string, Theme>();
    themes.forEach((theme) => themeMap.set(theme.id, theme));

    const consolidated: ConsolidatedTheme[] = [];

    for (const [, groupIds] of mergeGroups) {
      const groupThemes = groupIds.map((id) => themeMap.get(id)!);

      if (groupThemes.length === 1) {
        // Single theme - convert to consolidated format
        const theme = groupThemes[0];
        consolidated.push(this.themeToConsolidated(theme));
      } else {
        // Multiple themes - merge them
        consolidated.push(this.mergeThemes(groupThemes));
      }
    }

    return consolidated;
  }

  private buildHierarchies(themes: ConsolidatedTheme[]): ConsolidatedTheme[] {
    // Group themes by business domain
    const domainGroups = this.groupByBusinessDomain(themes);
    const result: ConsolidatedTheme[] = [];

    console.log(`[HIERARCHY] Found ${domainGroups.size} business domains:`);
    for (const [domain, domainThemes] of domainGroups) {
      console.log(
        `[HIERARCHY] Domain "${domain}": ${domainThemes.length} themes (min required: ${this.config.minThemesForParent})`
      );

      if (domainThemes.length >= this.config.minThemesForParent) {
        // Create parent theme
        console.log(`[HIERARCHY] ✅ Creating parent theme for "${domain}"`);
        const parentTheme = this.createParentTheme(domain, domainThemes);

        // Set children
        domainThemes.forEach((child) => {
          child.level = 1;
          child.parentId = parentTheme.id;
        });

        parentTheme.childThemes = domainThemes;
        result.push(parentTheme);
      } else {
        // Keep as root themes
        console.log(
          `[HIERARCHY] ⚠️ Keeping "${domain}" themes as individual (below threshold)`
        );
        result.push(...domainThemes);
      }
    }

    return result;
  }

  private groupByBusinessDomain(
    themes: ConsolidatedTheme[]
  ): Map<string, ConsolidatedTheme[]> {
    const domains = new Map<string, ConsolidatedTheme[]>();

    for (const theme of themes) {
      const domain = this.extractBusinessDomain(theme.name, theme.description);
      console.log(`[DOMAIN] Theme "${theme.name}" → Domain "${domain}"`);

      if (!domains.has(domain)) {
        domains.set(domain, []);
      }
      domains.get(domain)!.push(theme);
    }

    return domains;
  }

  private extractBusinessDomain(name: string, description: string): string {
    const text = (name + ' ' + description).toLowerCase();

    // Business domain keywords
    if (text.includes('greeting') || text.includes('demo')) {
      return 'Remove Demo Functionality';
    }
    if (text.includes('service') || text.includes('architecture')) {
      return 'Service Architecture';
    }
    if (text.includes('git') || text.includes('repository')) {
      return 'Git Integration';
    }
    if (text.includes('theme') || text.includes('analysis')) {
      return 'Theme Analysis';
    }
    if (text.includes('test') || text.includes('validation')) {
      return 'Testing & Validation';
    }
    if (text.includes('interface') || text.includes('type')) {
      return 'Interface Changes';
    }
    if (text.includes('workflow') || text.includes('action')) {
      return 'Workflow Configuration';
    }

    return 'General Changes';
  }

  private createParentTheme(
    domain: string,
    children: ConsolidatedTheme[]
  ): ConsolidatedTheme {
    const allFiles = new Set<string>();
    const allSnippets: string[] = [];
    let totalConfidence = 0;
    const sourceThemes: string[] = [];

    children.forEach((child) => {
      child.affectedFiles.forEach((file) => allFiles.add(file));
      allSnippets.push(...child.codeSnippets);
      totalConfidence += child.confidence;
      sourceThemes.push(...child.sourceThemes);
    });

    return {
      id: `parent-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: domain,
      description: `Consolidated theme for ${children.length} related changes: ${children.map((c) => c.name).join(', ')}`,
      level: 0,
      childThemes: [],
      affectedFiles: Array.from(allFiles),
      confidence: totalConfidence / children.length,
      businessImpact: `Umbrella theme covering ${children.length} related changes in ${domain.toLowerCase()}`,
      codeSnippets: allSnippets.slice(0, 10), // Limit snippets
      context: children.map((c) => c.context).join('\n'),
      lastAnalysis: new Date(),
      sourceThemes,
      consolidationMethod: 'hierarchy',
    };
  }

  private themeToConsolidated(theme: Theme): ConsolidatedTheme {
    return {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      level: 0,
      childThemes: [],
      affectedFiles: theme.affectedFiles,
      confidence: theme.confidence,
      businessImpact: theme.description,
      codeSnippets: theme.codeSnippets,
      context: theme.context,
      lastAnalysis: theme.lastAnalysis,
      sourceThemes: [theme.id],
      consolidationMethod: 'single',
    };
  }

  private mergeThemes(themes: Theme[]): ConsolidatedTheme {
    const allFiles = new Set<string>();
    const allSnippets: string[] = [];
    let totalConfidence = 0;

    themes.forEach((theme) => {
      theme.affectedFiles.forEach((file) => allFiles.add(file));
      allSnippets.push(...theme.codeSnippets);
      totalConfidence += theme.confidence;
    });

    const leadTheme = themes[0];

    return {
      id: `merged-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      name: leadTheme.name,
      description: `Consolidated: ${themes.map((t) => t.name).join(', ')}`,
      level: 0,
      childThemes: [],
      affectedFiles: Array.from(allFiles),
      confidence: totalConfidence / themes.length,
      businessImpact: themes.map((t) => t.description).join('; '),
      codeSnippets: allSnippets,
      context: themes.map((t) => t.context).join('\n'),
      lastAnalysis: new Date(),
      sourceThemes: themes.map((t) => t.id),
      consolidationMethod: 'merge',
    };
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);

    const intersection = words1.filter((word) => words2.includes(word));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }

  private calculateDescriptionSimilarity(desc1: string, desc2: string): number {
    const words1 = desc1.toLowerCase().split(/\s+/);
    const words2 = desc2.toLowerCase().split(/\s+/);

    const intersection = words1.filter((word) => words2.includes(word));
    const union = new Set([...words1, ...words2]);

    return intersection.length / union.size;
  }

  private calculateFileOverlap(files1: string[], files2: string[]): number {
    const set1 = new Set(files1);
    const set2 = new Set(files2);

    const intersection = new Set([...set1].filter((file) => set2.has(file)));
    const union = new Set([...set1, ...set2]);

    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private calculatePatternSimilarity(theme1: Theme, theme2: Theme): number {
    // Extract patterns from context
    const patterns1 = this.extractPatterns(theme1.context);
    const patterns2 = this.extractPatterns(theme2.context);

    const intersection = patterns1.filter((p) => patterns2.includes(p));
    const union = new Set([...patterns1, ...patterns2]);

    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  private calculateBusinessSimilarity(theme1: Theme, theme2: Theme): number {
    const business1 = this.extractBusinessKeywords(theme1.description);
    const business2 = this.extractBusinessKeywords(theme2.description);

    const intersection = business1.filter((k) => business2.includes(k));
    const union = new Set([...business1, ...business2]);

    return union.size === 0 ? 0 : intersection.length / union.size;
  }

  private extractPatterns(context: string): string[] {
    const patterns: string[] = [];
    const text = context.toLowerCase();

    if (text.includes('add') || text.includes('implement'))
      patterns.push('addition');
    if (text.includes('remove') || text.includes('delete'))
      patterns.push('removal');
    if (text.includes('update') || text.includes('modify'))
      patterns.push('modification');
    if (text.includes('refactor')) patterns.push('refactoring');
    if (text.includes('interface') || text.includes('type'))
      patterns.push('type_definition');
    if (text.includes('service') || text.includes('class'))
      patterns.push('service_implementation');
    if (text.includes('test')) patterns.push('testing');
    if (text.includes('configuration') || text.includes('config'))
      patterns.push('configuration');

    return patterns;
  }

  private extractBusinessKeywords(description: string): string[] {
    const keywords: string[] = [];
    const text = description.toLowerCase();

    if (text.includes('greeting')) keywords.push('greeting');
    if (text.includes('authentication') || text.includes('auth'))
      keywords.push('authentication');
    if (text.includes('user') || text.includes('customer'))
      keywords.push('user_experience');
    if (text.includes('api') || text.includes('service'))
      keywords.push('api_service');
    if (text.includes('data') || text.includes('storage'))
      keywords.push('data_management');
    if (text.includes('security')) keywords.push('security');
    if (text.includes('performance')) keywords.push('performance');
    if (text.includes('integration')) keywords.push('integration');
    if (text.includes('workflow') || text.includes('process'))
      keywords.push('workflow');

    return keywords;
  }
}
