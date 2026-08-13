#!/usr/bin/env node
/**
 * Bundles LEARNING_ASSISTANT.md into a TypeScript string for the in-app Help
 * screen.
 *
 * Metro cannot import .md directly, so the doc has to reach the bundle as source.
 * The markdown file stays the original — it is what renders on GitHub and what
 * anyone reads in the repo — and this copies it across on demand, so the two
 * cannot drift silently.
 *
 *   node scripts/gen-learning-guide.js      (or: npm run gen:learning-guide)
 *
 * `learningGuideContent.spec` fails if the generated file is out of date, so a
 * doc edit that skips this step is caught by the test run rather than shipping a
 * stale Help screen.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'LEARNING_ASSISTANT.md');
const TARGET = path.join(ROOT, 'src', 'features', 'learning', 'learningGuideContent.ts');

const HEADER = `// AUTO-GENERATED from LEARNING_ASSISTANT.md — do not edit by hand.
// Regenerate with: npm run gen:learning-guide
// (Metro cannot import .md directly, so the doc is bundled here as a string.)

`;

function generate(markdown) {
  return `${HEADER}export const LEARNING_GUIDE_MARKDOWN = ${JSON.stringify(markdown)};\n`;
}

function main() {
  const markdown = fs.readFileSync(SOURCE, 'utf8');
  const next = generate(markdown);
  const current = fs.existsSync(TARGET) ? fs.readFileSync(TARGET, 'utf8') : '';

  if (current === next) {
    console.log('learningGuideContent.ts is already up to date');
    return;
  }
  fs.writeFileSync(TARGET, next);
  console.log(`wrote ${path.relative(ROOT, TARGET)} (${markdown.length.toLocaleString()} chars)`);
}

module.exports = { generate, SOURCE, TARGET };

if (require.main === module) main();
