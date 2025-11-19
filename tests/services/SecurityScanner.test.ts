import { SecurityScanner } from '../../src/services/SecurityScanner';
import * as child_process from 'child_process';
import * as fs from 'fs/promises';

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs/promises');

const mockedExec = child_process.exec as jest.MockedFunction<typeof child_process.exec>;
const mockedFsAccess = fs.access as jest.MockedFunction<typeof fs.access>;
const mockedReadFile = fs.readFile as jest.MockedFunction<typeof fs.readFile>;
const mockedWriteFile = fs.writeFile as jest.MockedFunction<typeof fs.writeFile>;

describe('SecurityScanner', () => {
  let scanner: SecurityScanner;

  beforeEach(() => {
    scanner = new SecurityScanner('/test/dir');
    jest.clearAllMocks();
  });

  describe('scanForSecrets', () => {
    it('should detect secrets when found', async () => {
      // Mock which command succeeds
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock detect-secrets finds secrets
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        const output = 'config.py:25: Potential hardcoded password\n.env:10: Base64 High Entropy String';
        callback(null, { stdout: output, stderr: '' });
        return {} as any;
      });

      const result = await scanner.scanForSecrets();

      expect(result.found).toBe(true);
      expect(result.secrets.length).toBe(2);
      expect(result.secrets[0].file).toBe('config.py');
      expect(result.secrets[0].line).toBe(25);
      expect(result.secrets[1].file).toBe('.env');
      expect(result.blocked).toBe(true);
    });

    it('should return no secrets when clean', async () => {
      // Mock which command succeeds
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock detect-secrets finds nothing
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await scanner.scanForSecrets();

      expect(result.found).toBe(false);
      expect(result.secrets.length).toBe(0);
      expect(result.blocked).toBeUndefined();
    });

    it('should skip when detect-secrets not installed', async () => {
      // Mock which command fails (tool not found)
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(new Error('command not found'), { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await scanner.scanForSecrets();

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('not installed');
    });

    it('should restore baseline file after scanning to prevent timestamp-only changes', async () => {
      const originalBaseline = '{"version":"1.0.0","generated_at":"2025-11-18T10:00:00Z"}';

      // Mock readFile to return original baseline
      mockedReadFile.mockResolvedValueOnce(originalBaseline as any);

      // Mock which command succeeds
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock detect-secrets finds nothing
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock writeFile to capture restored baseline
      mockedWriteFile.mockResolvedValueOnce(undefined);

      await scanner.scanForSecrets();

      // Verify baseline was saved
      expect(mockedReadFile).toHaveBeenCalledWith('/test/dir/.secrets.baseline', 'utf-8');

      // Verify baseline was restored
      expect(mockedWriteFile).toHaveBeenCalledWith('/test/dir/.secrets.baseline', originalBaseline, 'utf-8');
    });

    it('should restore baseline file even when secrets are found', async () => {
      const originalBaseline = '{"version":"1.0.0","generated_at":"2025-11-18T10:00:00Z"}';

      // Mock readFile to return original baseline
      mockedReadFile.mockResolvedValueOnce(originalBaseline as any);

      // Mock which command succeeds
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock detect-secrets finds secrets
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: 'config.py:25: Potential secret', stderr: '' });
        return {} as any;
      });

      // Mock writeFile to capture restored baseline
      mockedWriteFile.mockResolvedValueOnce(undefined);

      const result = await scanner.scanForSecrets();

      expect(result.found).toBe(true);

      // Verify baseline was restored even when secrets found
      expect(mockedWriteFile).toHaveBeenCalledWith('/test/dir/.secrets.baseline', originalBaseline, 'utf-8');
    });

    it('should handle missing baseline file gracefully', async () => {
      // Mock readFile to fail (baseline doesn't exist)
      mockedReadFile.mockRejectedValueOnce(new Error('ENOENT: no such file'));

      // Mock which command succeeds
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock detect-secrets finds nothing
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await scanner.scanForSecrets();

      expect(result.found).toBe(false);

      // Verify writeFile was NOT called (no baseline to restore)
      expect(mockedWriteFile).not.toHaveBeenCalled();
    });

    it('should continue scanning if baseline restore fails', async () => {
      const originalBaseline = '{"version":"1.0.0","generated_at":"2025-11-18T10:00:00Z"}';

      // Mock readFile to return original baseline
      mockedReadFile.mockResolvedValueOnce(originalBaseline as any);

      // Mock which command succeeds
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock detect-secrets finds nothing
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock writeFile to fail (permission error)
      mockedWriteFile.mockRejectedValueOnce(new Error('EACCES: permission denied'));

      // Should not throw - scan should complete successfully
      const result = await scanner.scanForSecrets();

      expect(result.found).toBe(false);
      expect(result.skipped).toBeUndefined();
    });
  });

  describe('checkDependencies', () => {
    it('should detect critical vulnerabilities in Python projects', async () => {
      // Mock language detection - Python
      mockedFsAccess.mockRejectedValueOnce(new Error('not found')); // no requirements.txt first call
      mockedFsAccess.mockResolvedValueOnce(undefined); // setup.py exists

      // Mock which pip-audit succeeds
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock pip-audit output
      const vulnOutput = JSON.stringify({
        vulnerabilities: [
          { package: 'requests', version: '2.0.0', severity: 'critical', cve: 'CVE-2023-1234', description: 'Security issue' },
          { package: 'django', version: '2.0.0', severity: 'high', cve: 'CVE-2023-5678', description: 'Another issue' }
        ]
      });

      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: vulnOutput, stderr: '' });
        return {} as any;
      });

      const result = await scanner.checkDependencies();

      expect(result.total).toBe(2);
      expect(result.critical).toBe(1);
      expect(result.high).toBe(1);
      expect(result.shouldBlock).toBe(true);
      expect(result.vulnerabilities).toHaveLength(1); // Only critical
    });

    it('should detect vulnerabilities in Node.js projects', async () => {
      // Mock language detection - Node.js
      mockedFsAccess.mockRejectedValueOnce(new Error('not found')); // no requirements.txt
      mockedFsAccess.mockRejectedValueOnce(new Error('not found')); // no setup.py
      mockedFsAccess.mockResolvedValueOnce(undefined); // package.json exists

      // Mock npm audit output (npm audit can exit with error if vulns found)
      const vulnOutput = JSON.stringify({
        vulnerabilities: {
          lodash: { severity: 'critical' },
          axios: { severity: 'high' }
        }
      });

      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        const error: any = new Error('vulnerabilities found');
        error.stdout = vulnOutput;
        callback(error, { stdout: vulnOutput, stderr: '' });
        return {} as any;
      });

      const result = await scanner.checkDependencies();

      expect(result.total).toBe(2);
      expect(result.critical).toBeGreaterThanOrEqual(0);
    });

    it('should skip when language unsupported', async () => {
      // Mock all language checks fail
      mockedFsAccess.mockRejectedValue(new Error('not found'));

      const result = await scanner.checkDependencies();

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('Unsupported language');
    });

    it('should skip when pip-audit not installed', async () => {
      // Mock language detection - Python
      mockedFsAccess.mockRejectedValueOnce(new Error('not found'));
      mockedFsAccess.mockResolvedValueOnce(undefined); // setup.py

      // Mock which pip-audit fails
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(new Error('command not found'), { stdout: '', stderr: '' });
        return {} as any;
      });

      const result = await scanner.checkDependencies();

      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('not installed');
    });
  });

  describe('scan', () => {
    it('should run complete security scan and pass when clean', async () => {
      // Mock secrets scan - clean
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock dependency scan - clean (language detection)
      mockedFsAccess.mockRejectedValue(new Error('not found'));

      const result = await scanner.scan();

      expect(result.passed).toBe(true);
      expect(result.blockers.length).toBe(0);
    });

    it('should block when secrets found', async () => {
      // Mock secrets found
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: 'test.py:10: Secret', stderr: '' });
        return {} as any;
      });

      // Mock dependency scan
      mockedFsAccess.mockRejectedValue(new Error('not found'));

      const result = await scanner.scan();

      expect(result.passed).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
      expect(result.blockers[0]).toContain('secret');
    });

    it('should block when critical vulnerabilities found', async () => {
      // Mock secrets clean
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        callback(null, { stdout: '', stderr: '' });
        return {} as any;
      });

      // Mock critical vulnerability - need to reject first two checks, then accept package.json
      mockedFsAccess.mockRejectedValueOnce(new Error('not found')); // requirements.txt
      mockedFsAccess.mockRejectedValueOnce(new Error('not found')); // setup.py
      mockedFsAccess.mockResolvedValueOnce(undefined); // package.json
      const vulnOutput = JSON.stringify({
        vulnerabilities: { lodash: { severity: 'critical' } }
      });
      mockedExec.mockImplementationOnce((_cmd, _opts, callback: any) => {
        const error: any = new Error('vulns');
        error.stdout = vulnOutput;
        callback(error, { stdout: vulnOutput, stderr: '' });
        return {} as any;
      });

      const result = await scanner.scan();

      expect(result.passed).toBe(false);
      expect(result.blockers.some(b => b.includes('critical'))).toBe(true);
    });
  });
});
