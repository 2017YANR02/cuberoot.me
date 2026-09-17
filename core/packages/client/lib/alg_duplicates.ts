import { tr } from '@/i18n/tr';

export async function duplicateAware<T>(request: Promise<T>): Promise<T> {
  try { return await request; }
  catch (error) {
    if (error instanceof Error && error.message.includes('duplicate_alg')) {
      throw new Error(tr({ zh: '输入了重复的公式：忽略括号后，本情况已有相同公式', en: 'Duplicate algorithm: this case already contains the same algorithm, ignoring parentheses' }));
    }
    throw error;
  }
}
