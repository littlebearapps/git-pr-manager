import * as fs from "fs/promises";
import * as path from "path";
import { ConfigService } from "./ConfigService";
import * as yaml from "yaml";

export interface TemplateContext {
  title: string;
  branch: string;
  baseBranch: string;
  [key: string]: any;
}

/**
 * PRTemplateService - Discovers and renders PR templates
 */
export class PRTemplateService {
  constructor(private config: ConfigService) {}

  /**
   * Discover PR template from common locations
   * Returns path to template or null if not found
   */
  async discoverTemplate(): Promise<string | null> {
    const workingDir = process.cwd();

    // Common template locations (in order of preference)
    const locations = [
      // From config
      ...(await this.getConfigTemplateLocations()),

      // Standard GitHub locations
      path.join(workingDir, ".github/PULL_REQUEST_TEMPLATE.md"),
      path.join(workingDir, ".github/pull_request_template.md"),
      path.join(workingDir, "docs/PULL_REQUEST_TEMPLATE.md"),
      path.join(workingDir, "PULL_REQUEST_TEMPLATE.md"),

      // Template directories
      path.join(workingDir, ".github/PULL_REQUEST_TEMPLATE/default.md"),
      path.join(workingDir, ".github/PULL_REQUEST_TEMPLATE/main.md"),
    ];

    // Check each location
    for (const location of locations) {
      try {
        await fs.access(location);
        return location;
      } catch {
        // File doesn't exist, continue
      }
    }

    return null;
  }

  /**
   * Get template locations from config
   */
  private async getConfigTemplateLocations(): Promise<string[]> {
    try {
      const config = await this.config.getConfig();
      const templatePath = config.pr?.templatePath;

      if (templatePath) {
        // If relative path, resolve from working dir
        const workingDir = process.cwd();
        return [
          path.isAbsolute(templatePath)
            ? templatePath
            : path.join(workingDir, templatePath),
        ];
      }
    } catch {
      // Config doesn't exist or doesn't have template path
    }

    return [];
  }

  /**
   * List available templates in .github/PULL_REQUEST_TEMPLATE/
   */
  async listTemplates(): Promise<string[]> {
    const workingDir = process.cwd();
    const templateDir = path.join(workingDir, ".github/PULL_REQUEST_TEMPLATE");

    try {
      const files = await fs.readdir(templateDir);
      return files
        .filter((f) => f.endsWith(".md"))
        .map((f) => path.join(templateDir, f));
    } catch {
      return [];
    }
  }

  /**
   * Render template with context
   */
  async renderTemplate(
    templatePath: string,
    context: TemplateContext,
  ): Promise<string> {
    // Read template file
    const template = await fs.readFile(templatePath, "utf-8");

    // Simple variable replacement
    // Supports: {{variable}} or {variable} syntax
    let rendered = template;

    // Replace {{variable}} format
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });

    // Replace {variable} format (if not already replaced)
    rendered = rendered.replace(/\{(\w+)\}/g, (match, key) => {
      return context[key] !== undefined ? String(context[key]) : match;
    });

    return rendered;
  }

  /**
   * Create a default PR template
   */
  async createDefaultTemplate(): Promise<void> {
    const workingDir = process.cwd();
    const templatePath = path.join(
      workingDir,
      ".github/PULL_REQUEST_TEMPLATE.md",
    );

    const defaultTemplate = `# {{title}}

## Description

<!-- Describe your changes in detail -->

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing

<!-- Describe the tests you ran to verify your changes -->

- [ ] Tests pass locally
- [ ] New tests added for new functionality
- [ ] All tests pass in CI

## Checklist

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Related Issues

<!-- Link to related issues (e.g., Closes #123) -->
`;

    // Ensure .github directory exists
    const githubDir = path.dirname(templatePath);
    await fs.mkdir(githubDir, { recursive: true });

    // Write template
    await fs.writeFile(templatePath, defaultTemplate, "utf-8");
  }

  /**
   * Parse template frontmatter (if any)
   */
  async parseTemplate(templatePath: string): Promise<{
    content: string;
    metadata: Record<string, any>;
  }> {
    const template = await fs.readFile(templatePath, "utf-8");

    // Check for YAML frontmatter
    const frontmatterMatch = template.match(
      /^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
    );

    if (frontmatterMatch) {
      const metadata = yaml.parse(frontmatterMatch[1]);
      const content = frontmatterMatch[2];

      return { content, metadata };
    }

    return {
      content: template,
      metadata: {},
    };
  }
}
