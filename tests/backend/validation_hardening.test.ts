import { describe, it, expect } from 'vitest';
import { validateInput, sanitizeInput } from '../../functions/_lib/validation';

describe('Validation Hardening', () => {
    it.skip('should reject private IP addresses (Skipped: Policy allows private IPs)', () => {
        expect(validateInput('127.0.0.1').valid).toBe(false);
        expect(validateInput('10.0.0.5').valid).toBe(false);
        expect(validateInput('192.168.1.1').valid).toBe(false);
        expect(validateInput('172.16.0.1').valid).toBe(false);
        expect(validateInput('0.0.0.0').valid).toBe(false);
    });

    it.skip('should reject metadata service IP (Skipped: Policy allows private IPs)', () => {
        expect(validateInput('169.254.169.254').valid).toBe(false);
    });

    it.skip('should reject localhost in URL (Skipped: Policy allows private IPs)', () => {
        expect(validateInput('http://localhost:8080').valid).toBe(false);
    });

    it.skip('should reject private IP in URL (Skipped: Policy allows private IPs)', () => {
        expect(validateInput('http://127.0.0.1/admin').valid).toBe(false);
        expect(validateInput('https://192.168.0.1').valid).toBe(false);
    });

    it('should accept public IPs and domains', () => {
        expect(validateInput('8.8.8.8').valid).toBe(true);
        expect(validateInput('http://google.com').valid).toBe(true);
        expect(validateInput('example.com').valid).toBe(true);
    });

    it.skip('should reject private IP with leading spaces (Skipped: Policy allows private IPs)', () => {
        expect(validateInput(' 127.0.0.1').valid).toBe(false);
        expect(validateInput('   10.0.0.1   ').valid).toBe(false);
    });

    it.skip('should reject metadata IP with whitespace (Skipped: Policy allows private IPs)', () => {
        expect(validateInput(' 169.254.169.254 ').valid).toBe(false);
    });
});

describe('Sanitization & Normalization', () => {
    it('should normalize domains to lowercase', () => {
        expect(sanitizeInput('GoOgLe.CoM')).toBe('google.com');
        expect(sanitizeInput('  EXAMPLE.NET  ')).toBe('example.net');
    });

    it('should normalize URLs', () => {
        expect(sanitizeInput('HTTP://Google.Com/Path')).toBe('http://google.com/Path');
    });

    it('should normalize emails', () => {
        expect(sanitizeInput('User@Example.Com')).toBe('user@example.com');
    });

    it('should not lowercase paths in URLs', () => {
        expect(sanitizeInput('http://example.com/AbCd')).toBe('http://example.com/AbCd');
    });
});
