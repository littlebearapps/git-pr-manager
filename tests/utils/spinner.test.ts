// Mock ora to prevent ESM import errors
jest.mock('ora', () => {
  const mockSpinner = {
    start: jest.fn().mockReturnThis(),
    stop: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    warn: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
    text: '',
    isSpinning: false
  };

  return {
    __esModule: true,
    default: jest.fn(() => mockSpinner)
  };
});

import { Spinner, spinner, createSpinner } from '../../src/utils/spinner';

/**
 * Spinner Tests
 *
 * Note: These tests verify the Spinner class structure and basic functionality.
 * Deep integration testing with ora is limited due to ESM module mocking complexities.
 */
describe('Spinner', () => {
  describe('Class Structure', () => {
    it('should create a Spinner instance', () => {
      const s = new Spinner();

      expect(s).toBeInstanceOf(Spinner);
      expect(typeof s.start).toBe('function');
      expect(typeof s.stop).toBe('function');
      expect(typeof s.succeed).toBe('function');
      expect(typeof s.fail).toBe('function');
      expect(typeof s.warn).toBe('function');
      expect(typeof s.info).toBe('function');
      expect(typeof s.update).toBe('function');
      expect(typeof s.isActive).toBe('function');
    });

    it('should export a global spinner instance', () => {
      expect(spinner).toBeInstanceOf(Spinner);
    });

    it('should create independent instances via createSpinner', () => {
      const s1 = createSpinner();
      const s2 = createSpinner();

      expect(s1).toBeInstanceOf(Spinner);
      expect(s2).toBeInstanceOf(Spinner);
      expect(s1).not.toBe(s2);
      expect(s1).not.toBe(spinner);
    });
  });

  describe('State Management', () => {
    it('should return false for isActive when not started', () => {
      const s = new Spinner();

      expect(s.isActive()).toBe(false);
    });

    it('should not throw when calling methods on inactive spinner', () => {
      const s = new Spinner();

      expect(() => s.update('test')).not.toThrow();
      expect(() => s.stop()).not.toThrow();
    });
  });

  describe('Method Safety', () => {
    it('should handle succeed without message', () => {
      const s = new Spinner();
      // These methods should not throw even if spinner is not active
      expect(() => s.succeed()).not.toThrow();
    });

    it('should handle fail without message', () => {
      const s = new Spinner();
      expect(() => s.fail()).not.toThrow();
    });

    it('should handle warn with message', () => {
      const s = new Spinner();
      expect(() => s.warn('Warning')).not.toThrow();
    });

    it('should handle info with message', () => {
      const s = new Spinner();
      expect(() => s.info('Info')).not.toThrow();
    });
  });
});
