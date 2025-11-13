import { SuggestionEngine } from '../../src/utils/SuggestionEngine';
import { ErrorType } from '../../src/types';

describe('SuggestionEngine', () => {
  let engine: SuggestionEngine;

  beforeEach(() => {
    engine = new SuggestionEngine();
  });

  describe('getSuggestion', () => {
    it('should suggest pytest for Python test failures', () => {
      const suggestion = engine.getSuggestion(
        'FAILED tests/test_user.py::test_login',
        ErrorType.TEST_FAILURE,
        ['tests/test_user.py']
      );

      expect(suggestion.command).toContain('pytest');
      expect(suggestion.command).toContain('tests/test_user.py');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('ai');
    });

    it('should suggest npm test for Node.js test failures', () => {
      const suggestion = engine.getSuggestion(
        'FAILED tests/user.test.ts',
        ErrorType.TEST_FAILURE,
        ['tests/user.test.ts']
      );

      expect(suggestion.command).toContain('npm test');
      expect(suggestion.command).toContain('tests/user.test.ts');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('ai');
    });

    it('should suggest generic npm test when no files specified', () => {
      const suggestion = engine.getSuggestion(
        'Tests failed',
        ErrorType.TEST_FAILURE,
        []
      );

      expect(suggestion.command).toBe('npm test -- --verbose');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('ai');
    });

    it('should suggest ruff for Python linting errors', () => {
      const suggestion = engine.getSuggestion(
        'Linting errors found',
        ErrorType.LINTING_ERROR,
        ['src/main.py']
      );

      expect(suggestion.command).toContain('ruff check --fix');
      expect(suggestion.command).toContain('src/main.py');
      expect(suggestion.autoFixable).toBe(true);
      expect(suggestion.executionStrategy).toBe('deterministic');
      expect(suggestion.confidence).toBe(0.95);
    });

    it('should suggest npm run lint for Node.js linting errors', () => {
      const suggestion = engine.getSuggestion(
        'ESLint errors found',
        ErrorType.LINTING_ERROR,
        ['src/index.ts']
      );

      expect(suggestion.command).toBe('npm run lint -- --fix');
      expect(suggestion.autoFixable).toBe(true);
      expect(suggestion.executionStrategy).toBe('deterministic');
      expect(suggestion.confidence).toBe(0.95);
    });

    it('should suggest npm run lint when no files specified', () => {
      const suggestion = engine.getSuggestion(
        'Linting errors',
        ErrorType.LINTING_ERROR,
        []
      );

      expect(suggestion.command).toBe('npm run lint -- --fix');
      expect(suggestion.autoFixable).toBe(true);
      expect(suggestion.executionStrategy).toBe('deterministic');
      expect(suggestion.confidence).toBe(0.95);
    });

    it('should suggest npm run typecheck for type errors', () => {
      const suggestion = engine.getSuggestion(
        'TS2304: Cannot find name',
        ErrorType.TYPE_ERROR,
        []
      );

      expect(suggestion.command).toBe('npm run typecheck');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('ai');
    });

    it('should suggest black for Python format errors', () => {
      const suggestion = engine.getSuggestion(
        'Format check failed',
        ErrorType.FORMAT_ERROR,
        ['src/app.py']
      );

      expect(suggestion.command).toContain('black');
      expect(suggestion.command).toContain('src/app.py');
      expect(suggestion.autoFixable).toBe(true);
      expect(suggestion.executionStrategy).toBe('deterministic');
      expect(suggestion.confidence).toBe(0.95);
    });

    it('should suggest npm run format for Node.js format errors', () => {
      const suggestion = engine.getSuggestion(
        'Prettier check failed',
        ErrorType.FORMAT_ERROR,
        ['src/index.ts']
      );

      expect(suggestion.command).toBe('npm run format');
      expect(suggestion.autoFixable).toBe(true);
      expect(suggestion.executionStrategy).toBe('deterministic');
      expect(suggestion.confidence).toBe(0.95);
    });

    it('should suggest npm run build for build errors', () => {
      const suggestion = engine.getSuggestion(
        'Build failed',
        ErrorType.BUILD_ERROR,
        []
      );

      expect(suggestion.command).toBe('npm run build');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('ai');
    });

    it('should suggest secret removal for secret detection', () => {
      const suggestion = engine.getSuggestion(
        'secret detected in code',
        ErrorType.SECURITY_ISSUE,
        []
      );

      expect(suggestion.command).toBe('Review and remove secrets from code');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('manual');
    });

    it('should suggest npm audit fix for dependency vulnerabilities', () => {
      const suggestion = engine.getSuggestion(
        'Dependency vulnerability found',
        ErrorType.SECURITY_ISSUE,
        []
      );

      expect(suggestion.command).toBe('npm audit fix');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('manual');
    });

    it('should suggest CodeQL review for CodeQL issues', () => {
      const suggestion = engine.getSuggestion(
        'codeql analysis found issues',
        ErrorType.SECURITY_ISSUE,
        []
      );

      expect(suggestion.command).toBe('Review CodeQL findings at check details URL');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('manual');
    });

    it('should suggest generic security review for other security issues', () => {
      const suggestion = engine.getSuggestion(
        'Security scan failed',
        ErrorType.SECURITY_ISSUE,
        []
      );

      expect(suggestion.command).toBe('Review security scan findings');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('manual');
    });

    it('should return suggestion for unknown error types', () => {
      const suggestion = engine.getSuggestion(
        'Something failed',
        ErrorType.UNKNOWN,
        []
      );

      expect(suggestion.command).toBe('No specific suggestion available');
      expect(suggestion.autoFixable).toBe(false);
      expect(suggestion.executionStrategy).toBe('manual');
    });
  });

  describe('language detection', () => {
    it('should detect Python files for test suggestions', () => {
      const suggestion = engine.getSuggestion(
        'Tests failed',
        ErrorType.TEST_FAILURE,
        ['tests/test_main.py', 'tests/test_auth.py']
      );

      expect(suggestion.command).toContain('pytest');
      expect(suggestion.command).toContain('tests/test_main.py');
      expect(suggestion.command).toContain('tests/test_auth.py');
    });

    it('should detect JavaScript files for test suggestions', () => {
      const suggestion = engine.getSuggestion(
        'Tests failed',
        ErrorType.TEST_FAILURE,
        ['tests/main.test.js', 'tests/auth.test.js']
      );

      expect(suggestion.command).toContain('npm test');
      expect(suggestion.command).toContain('tests/main.test.js');
    });

    it('should detect TypeScript files for test suggestions', () => {
      const suggestion = engine.getSuggestion(
        'Tests failed',
        ErrorType.TEST_FAILURE,
        ['tests/main.test.ts']
      );

      expect(suggestion.command).toContain('npm test');
      expect(suggestion.command).toContain('tests/main.test.ts');
    });

    it('should detect Python files for lint suggestions', () => {
      const suggestion = engine.getSuggestion(
        'Lint errors',
        ErrorType.LINTING_ERROR,
        ['src/main.py', 'src/utils.py']
      );

      expect(suggestion.command).toContain('ruff');
      expect(suggestion.command).toContain('src/main.py');
      expect(suggestion.command).toContain('src/utils.py');
      expect(suggestion.autoFixable).toBe(true);
    });

    it('should detect Python files for format suggestions', () => {
      const suggestion = engine.getSuggestion(
        'Format errors',
        ErrorType.FORMAT_ERROR,
        ['src/app.py', 'tests/test.py']
      );

      expect(suggestion.command).toContain('black');
      expect(suggestion.command).toContain('src/app.py');
      expect(suggestion.command).toContain('tests/test.py');
      expect(suggestion.autoFixable).toBe(true);
    });

    it('should prioritize Python over Node.js when both present', () => {
      const suggestion = engine.getSuggestion(
        'Tests failed',
        ErrorType.TEST_FAILURE,
        ['tests/test.py', 'tests/test.ts']
      );

      // Python should be detected first
      expect(suggestion.command).toContain('pytest');
    });
  });
});
