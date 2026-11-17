import { apiRequest } from './api.js';

export function reportWord(word: string): Promise<void> {
  return apiRequest('/reports/words', { method: 'POST', body: JSON.stringify({ word }) });
}
