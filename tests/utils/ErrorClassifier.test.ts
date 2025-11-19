import { ErrorClassifier } from "../../src/utils/ErrorClassifier";
import { ErrorType } from "../../src/types";

describe("ErrorClassifier", () => {
  let classifier: ErrorClassifier;

  beforeEach(() => {
    classifier = new ErrorClassifier();
  });

  describe("classify", () => {
    it("should classify test failures correctly", () => {
      const check = {
        name: "Run tests",
        output: {
          title: "pytest failed",
          summary: "FAILED tests/test_user.py::test_login",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TEST_FAILURE);
    });

    it("should classify linting errors correctly", () => {
      const check = {
        name: "Lint",
        output: {
          title: "ESLint found issues",
          summary: "eslint found 5 problems",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.LINTING_ERROR);
    });

    it("should classify type errors correctly", () => {
      const check = {
        name: "Type Check",
        output: {
          title: "TypeScript errors",
          summary: "tsc found type errors",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TYPE_ERROR);
    });

    it("should classify security issues correctly", () => {
      const check = {
        name: "CodeQL",
        output: {
          title: "Security scan",
          summary: "codeql found vulnerabilities",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.SECURITY_ISSUE);
    });

    it("should classify build errors correctly", () => {
      const check = {
        name: "Build",
        output: {
          title: "Build failed",
          summary: "webpack compilation failed",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.BUILD_ERROR);
    });

    it("should classify format errors correctly", () => {
      const check = {
        name: "Format Check",
        output: {
          title: "Format issues",
          summary: "prettier formatting required",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.FORMAT_ERROR);
    });

    it("should return UNKNOWN for unclassified errors", () => {
      const check = {
        name: "Custom Check",
        output: {
          title: "Unknown failure",
          summary: "Something went wrong",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.UNKNOWN);
    });

    it("should handle checks with missing output", () => {
      const check = {
        name: "test",
        output: null,
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TEST_FAILURE);
    });

    it("should handle checks with empty output", () => {
      const check = {
        name: "build",
        output: {
          title: "",
          summary: "",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.BUILD_ERROR);
    });

    it("should be case-insensitive", () => {
      const check = {
        name: "PYTEST",
        output: {
          title: "TEST FAILED",
          summary: "Tests failed",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TEST_FAILURE);
    });

    it("should prioritize test failures over other types", () => {
      const check = {
        name: "test and build",
        output: {
          title: "Failure",
          summary: "test failed during build",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TEST_FAILURE);
    });

    it("should detect Jest test failures", () => {
      const check = {
        name: "jest",
        output: {
          title: "Tests failed",
          summary: "jest test suite failed",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TEST_FAILURE);
    });

    it("should detect Mocha test failures", () => {
      const check = {
        name: "mocha tests",
        output: {
          title: "Tests failed",
          summary: "mocha found failures",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TEST_FAILURE);
    });

    it("should detect Vitest test failures", () => {
      const check = {
        name: "vitest",
        output: {
          title: "Tests failed",
          summary: "vitest suite failed",
        },
      };

      const errorType = classifier.classify(check);
      expect(errorType).toBe(ErrorType.TEST_FAILURE);
    });

    it("should detect various linting tools", () => {
      const linters = ["eslint", "pylint", "flake8", "ruff"];

      linters.forEach((linter) => {
        const check = {
          name: linter,
          output: {
            title: "Lint errors",
            summary: `${linter} found issues`,
          },
        };

        const errorType = classifier.classify(check);
        expect(errorType).toBe(ErrorType.LINTING_ERROR);
      });
    });

    it("should detect various type checkers", () => {
      const checkers = ["mypy", "typescript", "tsc", "typecheck"];

      checkers.forEach((checker) => {
        const check = {
          name: checker,
          output: {
            title: "Type errors",
            summary: `${checker} found issues`,
          },
        };

        const errorType = classifier.classify(check);
        expect(errorType).toBe(ErrorType.TYPE_ERROR);
      });
    });

    it("should detect security scan keywords", () => {
      const keywords = ["security", "secret", "vuln", "dependency"];

      keywords.forEach((keyword) => {
        const check = {
          name: `${keyword} scan`,
          output: {
            title: "Security issue",
            summary: `Found ${keyword} issue`,
          },
        };

        const errorType = classifier.classify(check);
        expect(errorType).toBe(ErrorType.SECURITY_ISSUE);
      });
    });

    it("should detect build tool keywords", () => {
      const tools = ["webpack", "babel", "rollup", "vite", "compile"];

      tools.forEach((tool) => {
        const check = {
          name: tool,
          output: {
            title: "Build failed",
            summary: `${tool} failed`,
          },
        };

        const errorType = classifier.classify(check);
        expect(errorType).toBe(ErrorType.BUILD_ERROR);
      });
    });

    it("should detect format tool keywords", () => {
      const tools = ["prettier", "black", "autopep8", "format"];

      tools.forEach((tool) => {
        const check = {
          name: tool,
          output: {
            title: "Format issue",
            summary: `${tool} formatting needed`,
          },
        };

        const errorType = classifier.classify(check);
        expect(errorType).toBe(ErrorType.FORMAT_ERROR);
      });
    });
  });
});
