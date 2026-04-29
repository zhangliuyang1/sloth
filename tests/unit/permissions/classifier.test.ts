import { describe, it, expect } from 'vitest';
import { classifyBashCommand } from '../../../src/permissions/classifier.js';

describe('Bash command classifier', () => {
  it('should allow read-only commands', () => {
    expect(classifyBashCommand('ls -la')).toBe('allow');
    expect(classifyBashCommand('git status')).toBe('allow');
    expect(classifyBashCommand('git log --oneline -5')).toBe('allow');
    expect(classifyBashCommand('cat package.json')).toBe('allow');
    expect(classifyBashCommand('pwd')).toBe('allow');
    expect(classifyBashCommand('node --version')).toBe('allow');
  });

  it('should confirm dangerous commands', () => {
    expect(classifyBashCommand('rm -rf node_modules')).toBe('confirm');
    expect(classifyBashCommand('git push --force origin main')).toBe('confirm');
    expect(classifyBashCommand('git reset --hard HEAD~1')).toBe('confirm');
    expect(classifyBashCommand('DROP TABLE users')).toBe('confirm');
  });

  it('should ask for normal write commands', () => {
    expect(classifyBashCommand('npm install lodash')).toBe('ask');
    expect(classifyBashCommand('mkdir build')).toBe('ask');
    expect(classifyBashCommand('npx tsc')).toBe('ask');
  });
});
