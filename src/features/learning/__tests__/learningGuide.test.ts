/**
 * The Help screen renders LEARNING_ASSISTANT.md through a generated TypeScript
 * string, because Metro can't import .md. That leaves one failure mode: editing
 * the doc and forgetting to regenerate, which ships a Help screen that quietly
 * disagrees with the documentation. This is the thing that notices.
 *
 * Fix a failure with: npm run gen:learning-guide
 */
import { generate, SOURCE, TARGET } from '../../../../scripts/gen-learning-guide.js';
import { LEARNING_GUIDE_MARKDOWN } from '../learningGuideContent';

// The project pins `types: ["jest"]` and has no @types/node, so the one builtin
// this needs is declared here rather than adding a dependency for a single file.
// Jest runs this suite in a node environment, so it is there at runtime.
declare function require(id: string): any;
const { readFileSync } = require('fs') as {
  readFileSync: (path: string, encoding: string) => string;
};

describe('the in-app learning guide', () => {
  it('matches LEARNING_ASSISTANT.md', () => {
    expect(LEARNING_GUIDE_MARKDOWN).toBe(readFileSync(SOURCE, 'utf8'));
  });

  it('has a generated file that is up to date', () => {
    expect(readFileSync(TARGET, 'utf8')).toBe(generate(readFileSync(SOURCE, 'utf8')));
  });

  it('leads with the title the screen expects', () => {
    expect(LEARNING_GUIDE_MARKDOWN.startsWith('# Learning Assistant')).toBe(true);
  });
});
