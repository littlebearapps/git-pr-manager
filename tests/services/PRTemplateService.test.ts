import { PRTemplateService } from '../../src/services/PRTemplateService';
import { ConfigService } from '../../src/services/ConfigService';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('../../src/services/ConfigService');
jest.mock('fs/promises');

const MockedConfigService = ConfigService as jest.MockedClass<typeof ConfigService>;
const mockedFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockedFsReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockedFsReaddir = fs.readdir as jest.MockedFunction<typeof fs.readdir>;
const mockedFsMkdir = fs.mkdir as jest.MockedFunction<typeof fs.mkdir>;
const mockedFsWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;

describe('PRTemplateService', () => {
  let templateService: PRTemplateService;
  let mockConfig: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      getConfig: jest.fn(),
    } as any;

    MockedConfigService.mockImplementation(() => mockConfig);

    templateService = new PRTemplateService(mockConfig);
  });

  describe('discoverTemplate', () => {
    it('should discover template from .github directory', async () => {
      const templatePath = path.join(process.cwd(), '.github/PULL_REQUEST_TEMPLATE.md');

      mockConfig.getConfig.mockResolvedValue({} as any);

      // First location check succeeds
      mockedFsAccess.mockResolvedValueOnce(undefined);

      const result = await templateService.discoverTemplate();

      expect(result).toBe(templatePath);
      expect(mockedFsAccess).toHaveBeenCalledWith(templatePath);
    });

    it('should discover template from config path', async () => {
      const customPath = path.join(process.cwd(), 'docs/pr-template.md');

      mockConfig.getConfig.mockResolvedValue({
        pr: { templatePath: 'docs/pr-template.md' }
      } as any);

      mockedFsAccess.mockImplementationOnce(() => Promise.resolve(undefined));

      const result = await templateService.discoverTemplate();

      expect(result).toBe(customPath);
    });

    it('should try multiple locations in order', async () => {
      mockConfig.getConfig.mockResolvedValue({} as any);

      // First few fail, then one succeeds
      mockedFsAccess
        .mockRejectedValueOnce(new Error('not found'))
        .mockRejectedValueOnce(new Error('not found'))
        .mockResolvedValueOnce(undefined); // Third location exists

      const result = await templateService.discoverTemplate();

      expect(result).not.toBeNull();
      expect(mockedFsAccess).toHaveBeenCalledTimes(3);
    });

    it('should return null when no template found', async () => {
      mockConfig.getConfig.mockResolvedValue({} as any);
      mockedFsAccess.mockRejectedValue(new Error('not found'));

      const result = await templateService.discoverTemplate();

      expect(result).toBeNull();
    });

    it('should handle absolute config path', async () => {
      const absolutePath = '/absolute/path/to/template.md';

      mockConfig.getConfig.mockResolvedValue({
        pr: { templatePath: absolutePath }
      } as any);

      mockedFsAccess.mockResolvedValueOnce(undefined);

      const result = await templateService.discoverTemplate();

      expect(result).toBe(absolutePath);
    });

    it('should handle config error gracefully', async () => {
      mockConfig.getConfig.mockRejectedValue(new Error('Config not found'));

      // Fall back to standard locations
      mockedFsAccess.mockResolvedValueOnce(undefined);

      const result = await templateService.discoverTemplate();

      expect(result).not.toBeNull();
    });
  });

  describe('listTemplates', () => {
    it('should list templates from .github/PULL_REQUEST_TEMPLATE/', async () => {
      const templateDir = path.join(process.cwd(), '.github/PULL_REQUEST_TEMPLATE');

      mockedFsReaddir.mockResolvedValue([
        'default.md',
        'bugfix.md',
        'feature.md',
        'README.txt', // Should be filtered out
      ] as any);

      const result = await templateService.listTemplates();

      expect(result).toHaveLength(3);
      expect(result[0]).toBe(path.join(templateDir, 'default.md'));
      expect(result[1]).toBe(path.join(templateDir, 'bugfix.md'));
      expect(result[2]).toBe(path.join(templateDir, 'feature.md'));
    });

    it('should return empty array when directory does not exist', async () => {
      mockedFsReaddir.mockRejectedValue(new Error('Directory not found'));

      const result = await templateService.listTemplates();

      expect(result).toEqual([]);
    });

    it('should filter non-markdown files', async () => {
      mockedFsReaddir.mockResolvedValue([
        'template.md',
        'config.yml',
        'script.js',
      ] as any);

      const result = await templateService.listTemplates();

      expect(result).toHaveLength(1);
      expect(result[0]).toContain('template.md');
    });
  });

  describe('renderTemplate', () => {
    it('should render template with {{variable}} syntax', async () => {
      const template = '# {{title}}\n\nBranch: {{branch}}\nBase: {{baseBranch}}';

      mockedFsReadFile.mockResolvedValue(template);

      const result = await templateService.renderTemplate('/path/to/template.md', {
        title: 'Test PR',
        branch: 'feature/test',
        baseBranch: 'main',
      });

      expect(result).toBe('# Test PR\n\nBranch: feature/test\nBase: main');
    });

    it('should render template with {variable} syntax', async () => {
      const template = '# {title}\n\nBranch: {branch}';

      mockedFsReadFile.mockResolvedValue(template);

      const result = await templateService.renderTemplate('/path/to/template.md', {
        title: 'Test PR',
        branch: 'feature/test',
        baseBranch: 'main',
      });

      expect(result).toBe('# Test PR\n\nBranch: feature/test');
    });

    it('should handle custom context variables', async () => {
      const template = '{{title}} - {{customField}}';

      mockedFsReadFile.mockResolvedValue(template);

      const result = await templateService.renderTemplate('/path/to/template.md', {
        title: 'Test',
        branch: 'feature',
        baseBranch: 'main',
        customField: 'Custom Value',
      });

      expect(result).toBe('Test - Custom Value');
    });

    it('should leave undefined variables unchanged', async () => {
      const template = '{{title}} - {{undefinedVar}}';

      mockedFsReadFile.mockResolvedValue(template);

      const result = await templateService.renderTemplate('/path/to/template.md', {
        title: 'Test',
        branch: 'feature',
        baseBranch: 'main',
      });

      expect(result).toBe('Test - {{undefinedVar}}');
    });

    it('should handle numbers in context', async () => {
      const template = 'PR #{{prNumber}}';

      mockedFsReadFile.mockResolvedValue(template);

      const result = await templateService.renderTemplate('/path/to/template.md', {
        title: 'Test',
        branch: 'feature',
        baseBranch: 'main',
        prNumber: 123,
      });

      expect(result).toBe('PR #123');
    });
  });

  describe('createDefaultTemplate', () => {
    it('should create default template in .github directory', async () => {
      mockedFsMkdir.mockResolvedValue(undefined);
      mockedFsWriteFile.mockResolvedValue(undefined);

      await templateService.createDefaultTemplate();

      const expectedPath = path.join(process.cwd(), '.github/PULL_REQUEST_TEMPLATE.md');

      expect(mockedFsMkdir).toHaveBeenCalledWith(
        path.dirname(expectedPath),
        { recursive: true }
      );
      expect(mockedFsWriteFile).toHaveBeenCalledWith(
        expectedPath,
        expect.stringContaining('# {{title}}'),
        'utf-8'
      );
    });

    it('should include checklist in default template', async () => {
      mockedFsMkdir.mockResolvedValue(undefined);
      mockedFsWriteFile.mockResolvedValue(undefined);

      await templateService.createDefaultTemplate();

      const writtenContent = (mockedFsWriteFile.mock.calls[0][1] as string);

      expect(writtenContent).toContain('## Checklist');
      expect(writtenContent).toContain('- [ ] Tests pass locally');
      expect(writtenContent).toContain('- [ ] My code follows');
    });
  });

  describe('parseTemplate', () => {
    it('should parse template without frontmatter', async () => {
      const template = '# Title\n\nContent here';

      mockedFsReadFile.mockResolvedValue(template);

      const result = await templateService.parseTemplate('/path/to/template.md');

      expect(result.content).toBe(template);
      expect(result.metadata).toEqual({});
    });

    it('should parse template with YAML frontmatter', async () => {
      const template = `---
name: Bug Fix Template
description: Template for bug fixes
---
# Bug Fix

Description here`;

      mockedFsReadFile.mockResolvedValue(template);

      // Mock yaml module
      const mockYaml = {
        parse: jest.fn().mockReturnValue({
          name: 'Bug Fix Template',
          description: 'Template for bug fixes',
        }),
      };
      jest.mock('yaml', () => mockYaml, { virtual: true });

      const result = await templateService.parseTemplate('/path/to/template.md');

      expect(result.content).toContain('# Bug Fix');
      expect(result.content).not.toContain('---');
    });
  });
});
