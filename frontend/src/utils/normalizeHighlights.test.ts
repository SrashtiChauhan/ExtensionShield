import { normalizeHighlights } from './normalizeScanResult';
import { describe, it, expect } from 'vitest';

describe('normalizeHighlights', () => {
  it('should prioritize highlights.why_this_score over key_points and summary', () => {
    const raw = {
      report_view_model: {
        scorecard: { one_liner: 'Score one liner' },
        highlights: {
          why_this_score: ['Bullet 1', 'Bullet 2'],
          key_points: ['Other bullet']
        }
      },
      summary: {
        key_findings: ['Summary bullet']
      }
    };
    const result = normalizeHighlights(raw as any);
    expect(result.oneLiner).toBe('Score one liner');
    expect(result.keyPoints).toEqual(['Bullet 1', 'Bullet 2']);
  });

  it('should filter out empty strings in bullets', () => {
    const raw = {
      report_view_model: {
        highlights: {
          why_this_score: ['Bullet 1', '', '  ', 'Bullet 3']
        }
      }
    };
    const result = normalizeHighlights(raw as any);
    expect(result.keyPoints).toEqual(['Bullet 1', 'Bullet 3']);
  });

  it('should use deterministic fallback for oneLiner if missing', () => {
    const raw = {
      scoring_v2: { decision: 'BLOCK' }
    };
    const result = normalizeHighlights(raw as any);
    expect(result.oneLiner).toContain('blocked');
  });

  it('should return empty whatToWatch if no data exists', () => {
    const raw = {};
    const result = normalizeHighlights(raw as any);
    expect(result.whatToWatch).toEqual([]);
  });
});

