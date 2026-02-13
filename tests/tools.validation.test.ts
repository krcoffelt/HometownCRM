import { describe, expect, it } from 'vitest';
import { validateToolArgs } from '../src/ai/tools';

describe('tool argument validation', () => {
  it('rejects invalid create_client arguments', () => {
    const result = validateToolArgs('create_client', {
      email: 'not-enough',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('name');
    }
  });

  it('rejects invalid add_service numeric arguments', () => {
    const result = validateToolArgs('add_service', {
      client_id: 'client_0001',
      service_code: 'SEO_AUDIT',
      qty: -2,
      unit_price: 250,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('qty');
    }
  });
});
