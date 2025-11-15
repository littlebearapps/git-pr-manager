import { describe, it, expect } from '@jest/globals';
import { parseWorktreeList } from '../../src/utils/worktree-parser';

describe('parseWorktreeList', () => {
  it('should parse standard worktree output', () => {
    const output = `worktree /path/to/main
HEAD abc123def
branch refs/heads/main

worktree /path/to/feature
HEAD def456abc
branch refs/heads/feature/test`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(2);
    expect(worktrees[0]).toEqual({
      path: '/path/to/main',
      commit: 'abc123def',
      branch: 'main',
      isMain: false
    });
    expect(worktrees[1]).toEqual({
      path: '/path/to/feature',
      commit: 'def456abc',
      branch: 'feature/test',
      isMain: false
    });
  });

  it('should handle detached HEAD', () => {
    const output = `worktree /path/to/detached
HEAD abc123def
detached`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].branch).toBeNull();
    expect(worktrees[0].path).toBe('/path/to/detached');
    expect(worktrees[0].commit).toBe('abc123def');
  });

  it('should detect bare repository', () => {
    const output = `worktree /path/to/.bare
HEAD 0000000000000000000000000000000000000000
bare`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].isMain).toBe(true);
    expect(worktrees[0].path).toBe('/path/to/.bare');
  });

  it('should handle multiple worktrees with mixed states', () => {
    const output = `worktree /path/to/.bare
HEAD 0000000000000000000000000000000000000000
bare

worktree /path/to/main
HEAD abc123def
branch refs/heads/main

worktree /path/to/feature-a
HEAD 111222333
branch refs/heads/feature/feature-a

worktree /path/to/detached
HEAD 444555666
detached`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(4);

    // Bare repository
    expect(worktrees[0].isMain).toBe(true);
    expect(worktrees[0].branch).toBeNull();

    // Main worktree
    expect(worktrees[1].branch).toBe('main');
    expect(worktrees[1].isMain).toBe(false);

    // Feature worktree
    expect(worktrees[2].branch).toBe('feature/feature-a');
    expect(worktrees[2].isMain).toBe(false);

    // Detached HEAD worktree
    expect(worktrees[3].branch).toBeNull();
    expect(worktrees[3].isMain).toBe(false);
  });

  it('should handle empty output', () => {
    const output = '';

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(0);
  });

  it('should handle branch names with slashes', () => {
    const output = `worktree /path/to/feature
HEAD abc123def
branch refs/heads/feature/my/deep/branch`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].branch).toBe('feature/my/deep/branch');
  });

  it('should trim whitespace from all fields', () => {
    const output = `worktree /path/to/main
HEAD abc123def
branch refs/heads/main  `;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(1);
    expect(worktrees[0].path).toBe('/path/to/main');
    expect(worktrees[0].commit).toBe('abc123def');
    expect(worktrees[0].branch).toBe('main');
  });

  it('should skip incomplete entries', () => {
    const output = `worktree /path/to/main
HEAD abc123def
branch refs/heads/main

worktree /path/to/incomplete
branch refs/heads/incomplete

worktree /path/to/feature
HEAD def456abc
branch refs/heads/feature`;

    const worktrees = parseWorktreeList(output);

    // Should only include the 2 complete entries (with both path and commit)
    expect(worktrees).toHaveLength(2);
    expect(worktrees[0].path).toBe('/path/to/main');
    expect(worktrees[1].path).toBe('/path/to/feature');
  });

  it('should handle windows-style paths', () => {
    const output = `worktree C:\\Users\\test\\project\\.bare
HEAD 0000000000000000000000000000000000000000
bare

worktree C:\\Users\\test\\project\\main
HEAD abc123def
branch refs/heads/main`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(2);
    expect(worktrees[0].path).toBe('C:\\Users\\test\\project\\.bare');
    expect(worktrees[1].path).toBe('C:\\Users\\test\\project\\main');
  });

  it('should handle paths with spaces', () => {
    const output = `worktree /path/to/my project/.bare
HEAD 0000000000000000000000000000000000000000
bare

worktree /path/to/my project/main
HEAD abc123def
branch refs/heads/main`;

    const worktrees = parseWorktreeList(output);

    expect(worktrees).toHaveLength(2);
    expect(worktrees[0].path).toBe('/path/to/my project/.bare');
    expect(worktrees[1].path).toBe('/path/to/my project/main');
  });
});
