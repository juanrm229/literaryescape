'use client';

import { useCallback } from 'react';
import { DocReader } from './DocReader';
import { useUI } from './Shell';

export function RekamanTape({ slug, code, html }: { slug: string; code: string; html: string }) {
  const { toast } = useUI();
  const onEnd = useCallback(() => toast('Untuk pertama kalinya sejak 8 Februari 1979, tidak ada bunyi dayung.', { ms: 6000 }), [toast]);
  return <DocReader slug={slug} code={code} skin="tape-phone" html={html} onTapeEnd={onEnd} />;
}
