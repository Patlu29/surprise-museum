import { describe, expect, it } from 'vitest';
import { resolveApiMode } from '../mode';

describe('resolveApiMode', () => {
  const configured = { supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: 'key' };
  const empty = { supabaseUrl: '', supabaseAnonKey: '' };

  describe('development', () => {
    it('uses the mock when the Supabase variables are absent, and live when both are set', () => {
      expect(resolveApiMode(empty)).toBe('mock');
      expect(resolveApiMode({ ...empty, production: false })).toBe('mock');
      expect(resolveApiMode({ supabaseUrl: 'https://x.supabase.co', supabaseAnonKey: '' })).toBe(
        'mock',
      );
      expect(resolveApiMode({ supabaseUrl: '', supabaseAnonKey: 'key' })).toBe('mock');
      expect(resolveApiMode(configured)).toBe('live');
    });
  });

  describe('production builds', () => {
    it('never fall back to the mock: blank means live, even with the variables missing', () => {
      expect(resolveApiMode({ ...empty, production: true })).toBe('live');
      expect(resolveApiMode({ ...configured, production: true })).toBe('live');
      expect(resolveApiMode({ ...empty, production: true, flag: '' })).toBe('live');
      expect(resolveApiMode({ ...empty, production: true, flag: 'auto' })).toBe('live');
    });

    it('use the mock only when it is asked for explicitly', () => {
      expect(resolveApiMode({ ...empty, production: true, flag: 'mock' })).toBe('mock');
      expect(resolveApiMode({ ...configured, production: true, flag: ' MOCK ' })).toBe('mock');
    });
  });

  it('lets VITE_API_MODE force either mode in any build, ignoring case and spaces', () => {
    expect(resolveApiMode({ ...configured, flag: 'mock' })).toBe('mock');
    expect(resolveApiMode({ ...configured, flag: ' MOCK ' })).toBe('mock');
    expect(resolveApiMode({ ...empty, flag: 'live' })).toBe('live');
    expect(resolveApiMode({ ...configured, flag: 'auto' })).toBe('live');
    expect(resolveApiMode({ ...empty, flag: '' })).toBe('mock');
  });
});
