// ترتيب نماذج Gemini لقراءة العطاءات (rankGeminiModels): الأحدث المستقر أولاً، وما لا يقرأ المستندات (صور، صوت) مستبعد
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankGeminiModels } from '../src/utils/ocrService';

test('أحدث flash مستقر أولاً، والمعاينة بعد المستقر', () => {
  const r = rankGeminiModels(['gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-3.7-flash', 'gemini-3.8-flash', 'gemini-2.5-flash']);
  assert.deepEqual(r, ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-flash-preview']);
});

test('نماذج الصور والصوت والبث لا تدخل الترتيب (ومنها nano-banana)', () => {
  const r = rankGeminiModels(['gemini-3.8-flash', 'gemini-nano-banana-2.1', 'gemini-3.1-flash-image', 'gemini-3.8-flash-tts', 'gemini-3.5-transcribe', 'gemini-omni-1.2-flash']);
  assert.deepEqual(r, ['gemini-3.8-flash']);
});

test('gemini-4-hydrogen أولاً إن وُجد، وإلا فالترتيب العام', () => {
  const names = ['gemini-3.8-flash', 'gemini-4-argon', 'gemini-4-hydrogen', 'gemini-2.5-pro'];
  assert.deepEqual(rankGeminiModels(names), ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-2.5-pro', 'gemini-4-argon']);
  assert.equal(rankGeminiModels(['gemini-3.8-flash', 'gemini-2.5-pro'])[0], 'gemini-3.8-flash');
});
