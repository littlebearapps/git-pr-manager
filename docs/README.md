# Documentation Index

Complete documentation for Git Workflow Manager organized by category.

## 📂 Documentation Structure

### `/implementation` - Implementation History

Phase-by-phase implementation documentation:

- **[PHASE-1-COMPLETE.md](implementation/PHASE-1-COMPLETE.md)** - Core SDK Infrastructure + Enhanced Error Reporting
  - TypeScript setup, Jest configuration
  - Core services (GitHub, Git, Config)
  - EnhancedCIPoller with rich error reporting
  - ErrorClassifier, SuggestionEngine, OutputFormatter
  - Commands: `checks`, `init`, `status`

- **[PHASE-2-COMPLETE.md](implementation/PHASE-2-COMPLETE.md)** - PR Automation + Intelligent CI Polling
  - PRService (create, merge, validate)
  - PRTemplateService (template discovery)
  - VerifyService (pre-commit checks)
  - Commands: `ship`, `feature`

- **[PHASE-3-COMPLETE.md](implementation/PHASE-3-COMPLETE.md)** - Branch Protection + Security Integration
  - BranchProtectionChecker
  - SecurityScanner (secrets + vulnerabilities)
  - Commands: `protect`, `security`

- **[PHASE-4-COMPLETE.md](implementation/PHASE-4-COMPLETE.md)** - Testing Infrastructure + Workflow Templates
  - Jest testing framework (180 tests)
  - GitHub Actions workflows
  - Configuration presets
  - Integration guides

- **[PHASE-5-PROGRESS.md](implementation/PHASE-5-PROGRESS.md)** - Performance & UX Enhancements ⭐
  - API response caching (40-60% fewer calls)
  - Exponential backoff polling (30-40% faster CI)
  - Machine-readable output (--json)
  - Interactive mode (--interactive)
  - Structured errors with suggestions
  - Command: `auto`

- **[IMPLEMENTATION-HANDOVER.md](implementation/IMPLEMENTATION-HANDOVER.md)** - Phase handover documentation

### `/guides` - User Guides

Practical guides for using git-workflow-manager:

- **[QUICK-REFERENCE.md](guides/QUICK-REFERENCE.md)** - Quick reference for common tasks
  - Command cheat sheet
  - Configuration examples
  - Troubleshooting tips

- **[WORKFLOW-DOCUMENTATION.md](guides/WORKFLOW-DOCUMENTATION.md)** - Detailed workflow documentation
  - Complete workflow explanations
  - Best practices
  - Advanced usage patterns

- **[SUBAGENT_PROMPT.md](guides/SUBAGENT_PROMPT.md)** - Claude Code subagent prompt
  - Subagent configuration
  - Integration with Claude Code
  - Development workflow

- **[REPOSITORY-SECURITY-GUIDE.md](guides/REPOSITORY-SECURITY-GUIDE.md)** - Comprehensive security guide ⭐
  - Repository types & recommended settings
  - GitHub Actions security best practices
  - Secrets management (direnv + keychain)
  - Branch protection presets
  - Security audit checklists

- **[GITHUB-ACTIONS-INTEGRATION.md](guides/GITHUB-ACTIONS-INTEGRATION.md)** - GitHub Actions integration
  - CI/CD workflow patterns
  - Permissions and secrets
  - Common use cases

- **[AI-AGENT-INTEGRATION.md](guides/AI-AGENT-INTEGRATION.md)** - AI agent integration
  - Claude Code integration
  - Machine-readable output
  - Automation patterns

- **[JSON-OUTPUT-SCHEMAS.md](guides/JSON-OUTPUT-SCHEMAS.md)** - JSON output schemas
  - Complete schema reference
  - Example outputs
  - Parsing guidelines

### `/architecture` - Architecture & Design

Technical architecture documentation:

- **[OCTOKIT-SDK-INTEGRATION.md](architecture/OCTOKIT-SDK-INTEGRATION.md)** - Octokit SDK integration details
  - GitHub API integration
  - Service architecture
  - API patterns

- **[OPTION-2-FULL-SDK-MIGRATION-PLAN.md](architecture/OPTION-2-FULL-SDK-MIGRATION-PLAN.md)** - Full SDK migration plan
  - Migration strategy
  - Technical considerations
  - Implementation roadmap

### `/planning` - Planning & Enhancement

Future enhancements and planning documents:

- **[COMPREHENSIVE-ENHANCEMENT-PLAN.md](planning/COMPREHENSIVE-ENHANCEMENT-PLAN.md)** - Complete enhancement plan
  - All 5 phases detailed
  - Success criteria
  - Technical specifications

- **[ENHANCEMENT-IDEAS.md](planning/ENHANCEMENT-IDEAS.md)** - Future enhancement ideas
  - Proposed features
  - Community requests
  - Nice-to-have improvements

## 🎯 Quick Navigation

### For New Users
1. Start with [main README.md](../README.md) for installation and quick start
2. Review [REPOSITORY-SECURITY-GUIDE.md](guides/REPOSITORY-SECURITY-GUIDE.md) for security setup ⭐
3. Check [QUICK-REFERENCE.md](guides/QUICK-REFERENCE.md) for common commands
4. Read [WORKFLOW-DOCUMENTATION.md](guides/WORKFLOW-DOCUMENTATION.md) for detailed workflows

### For Developers
1. Read [PHASE-5-PROGRESS.md](implementation/PHASE-5-PROGRESS.md) for latest implementation
2. Review [OCTOKIT-SDK-INTEGRATION.md](architecture/OCTOKIT-SDK-INTEGRATION.md) for architecture
3. Check [COMPREHENSIVE-ENHANCEMENT-PLAN.md](planning/COMPREHENSIVE-ENHANCEMENT-PLAN.md) for roadmap

### For Contributors
1. Review all phase completion docs in `/implementation`
2. Check [ENHANCEMENT-IDEAS.md](planning/ENHANCEMENT-IDEAS.md) for contribution opportunities
3. Read [IMPLEMENTATION-HANDOVER.md](implementation/IMPLEMENTATION-HANDOVER.md) for context

## 📊 Project Status

- **Current Version**: v1.4.0-beta.1
- **Implementation Status**: Phase 5 Complete (100%)
- **Test Coverage**: 180 tests (152 unit + 28 integration)
- **Production Ready**: Yes (pending final QA)

## 🔗 External Resources

- **Main README**: [../README.md](../README.md)
- **Changelog**: [../CHANGELOG.md](../CHANGELOG.md)
- **License**: [../LICENSE](../LICENSE)
- **npm Package**: [@littlebearapps/git-workflow-manager](https://www.npmjs.com/package/@littlebearapps/git-workflow-manager)
- **GitHub Repository**: [littlebearapps/git-workflow-manager](https://github.com/littlebearapps/git-workflow-manager)

## 💡 Need Help?

- **Issues**: [GitHub Issues](https://github.com/littlebearapps/git-workflow-manager/issues)
- **Email**: nathan@littlebearapps.com
- **Documentation**: Browse this `/docs` folder

---

**Last Updated**: 2025-01-13
**Documentation Version**: 1.4.0-beta.1
