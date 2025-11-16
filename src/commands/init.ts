import { ConfigService } from '../services/ConfigService';
import { logger } from '../utils/logger';
import { spinner } from '../utils/spinner';
import prompts from 'prompts';

interface InitOptions {
  template?: 'basic' | 'standard' | 'strict';
  interactive?: boolean;
}

/**
 * Initialize .gpm.yml configuration
 */
export async function initCommand(options: InitOptions): Promise<void> {
  let template = options.template || 'basic';

  // Interactive mode
  if (options.interactive && !options.template) {
    logger.section('🚀 Git Workflow Manager - Configuration Setup');
    logger.blank();

    const answers = await prompts([
      {
        type: 'select',
        name: 'preset',
        message: 'Choose configuration preset:',
        choices: [
          {
            title: 'Basic - Personal projects',
            value: 'basic',
            description: 'Minimal checks, fast iteration'
          },
          {
            title: 'Standard - Team projects (recommended)',
            value: 'standard',
            description: 'Balanced checks, PR reviews required'
          },
          {
            title: 'Strict - Production systems',
            value: 'strict',
            description: 'Maximum protection, multiple reviewers'
          }
        ],
        initial: 1 // Default to 'standard'
      },
      {
        type: 'confirm',
        name: 'preview',
        message: 'Preview configuration before saving?',
        initial: true
      }
    ], {
      onCancel: () => {
        logger.warn('Setup cancelled');
        process.exit(0);
      }
    });

    template = answers.preset;

    // Show preview if requested
    if (answers.preview) {
      logger.blank();
      logger.section('Configuration Preview');
      const configService = new ConfigService();
      const previewConfig = configService.getTemplateConfig(template as 'basic' | 'standard' | 'strict');
      logger.log(JSON.stringify(previewConfig, null, 2));
      logger.blank();

      const confirmAnswers = await prompts([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Create this configuration?',
          initial: true
        }
      ], {
        onCancel: () => {
          logger.warn('Setup cancelled');
          process.exit(0);
        }
      });

      if (!confirmAnswers.proceed) {
        logger.warn('Setup cancelled');
        process.exit(0);
      }
    }

    logger.blank();
  }

  if (!['basic', 'standard', 'strict'].includes(template)) {
    logger.error(`Invalid template: ${template}. Must be one of: basic, standard, strict`);
    process.exit(1);
  }

  try {
    const configService = new ConfigService();

    // Check if config already exists
    const exists = await configService.exists();
    if (exists) {
      // Output JSON error if in JSON mode
      logger.outputJsonResult(false, null, {
        code: 'ERROR',
        message: '.gpm.yml already exists',
        suggestions: ['Delete the existing file or use --force flag to overwrite']
      });

      // Human-readable error (only displays if not in JSON mode)
      logger.warn('.gpm.yml already exists');
      logger.info('Delete the existing file or use a different template');
      process.exit(1);
    }

    spinner.start(`Initializing .gpm.yml with ${template} template...`);

    await configService.init(template as 'basic' | 'standard' | 'strict');

    spinner.succeed(`Created .gpm.yml with ${template} template`);

    // Show what was created
    const config = await configService.getConfig();

    // Build JSON data for structured output
    const jsonData = {
      created: true,
      template,
      filePath: '.gpm.yml',
      config
    };

    // Output JSON if in JSON mode (will only output if jsonMode enabled)
    logger.outputJsonResult(true, jsonData);

    // Human-readable output below (will only output if jsonMode disabled)
    logger.blank();
    logger.section('Configuration');
    logger.log(JSON.stringify(config, null, 2));

    logger.blank();
    logger.success('Workflow configuration initialized successfully!');
    logger.blank();
    logger.section('Next Steps');
    logger.info('1. Review configuration: cat .gpm.yml');
    logger.info('2. Set up GitHub Actions: gpm docs --guide=GITHUB-ACTIONS-INTEGRATION');
    logger.info('3. Configure branch protection: gpm protect');
    logger.blank();
    logger.section('Optional Enhancements');
    logger.info('🎯 Git Hooks (Recommended for AI Agents):');
    logger.info('   gpm install-hooks     # Get reminded before every push');
    logger.info('   • Never miss gpm in your workflow');
    logger.info('   • 100% optional - you choose when to enable');
    logger.blank();
    logger.section('Documentation');
    logger.info('• AI Agent Integration: gpm docs --guide=AI-AGENT-INTEGRATION');
    logger.info('• Full documentation: gpm docs');
    logger.blank();
    logger.info('💡 Tip: Run \'gpm docs\' anytime to see available guides');
  } catch (error: any) {
    spinner.fail('Failed to initialize configuration');
    logger.error(error.message);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}
