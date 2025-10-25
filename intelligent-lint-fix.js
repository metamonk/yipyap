#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get lint output
const lintOutput = execSync('npm run lint 2>&1', { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

// Parse lint errors
const fileErrors = {};
const lines = lintOutput.split('\n');
let currentFile = null;

lines.forEach(line => {
  // Match file paths
  if (line.match(/^\/Users\/.*\.(ts|tsx)$/)) {
    currentFile = line.trim();
    fileErrors[currentFile] = [];
  }
  // Match error lines with line numbers
  else if (currentFile && line.match(/^\s+\d+:\d+\s+(error|warning)/)) {
    const match = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+)/);
    if (match) {
      fileErrors[currentFile].push({
        line: parseInt(match[1]),
        col: parseInt(match[2]),
        type: match[3],
        message: match[4]
      });
    }
  }
});

let totalFixes = 0;

// Fix each file
Object.keys(fileErrors).forEach(filePath => {
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let modified = false;

  const errors = fileErrors[filePath];

  errors.forEach(err => {
    const lineIdx = err.line - 1;
    if (lineIdx < 0 || lineIdx >= lines.length) return;

    const line = lines[lineIdx];

    // Fix unused parameters by prefixing with underscore
    if (err.message.includes('is defined but never used. Allowed unused args must match /^_/u')) {
      const varMatch = err.message.match(/'([^']+)' is defined/);
      if (varMatch) {
        const varName = varMatch[1];
        // Replace parameter name with _prefixed version
        lines[lineIdx] = line.replace(new RegExp(`\\b${varName}\\b(?=\\s*[,:\\)])`, 'g'), `_${varName}`);
        modified = true;
        totalFixes++;
      }
    }

    // Comment out console.log lines
    if (err.message.includes('Unexpected console statement') && line.includes('console.log')) {
      lines[lineIdx] = line.replace(/^(\s*)(.*)$/, '$1// $2');
      modified = true;
      totalFixes++;
    }

    // Fix unescaped apostrophes
    if (err.message.includes('can be escaped with')) {
      lines[lineIdx] = line.replace(/'/g, '&apos;');
      modified = true;
      totalFixes++;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`Fixed ${filePath}`);
  }
});

console.log(`\nTotal automatic fixes applied: ${totalFixes}`);
console.log('Run npm run lint again to check remaining errors.');
