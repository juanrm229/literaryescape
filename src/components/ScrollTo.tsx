'use client';
import { useEffect } from 'react';

/** Land on a row when coming back from a document (?from=CODE). */
export function ScrollTo({ id }: { id?: string }) {
  useEffect(() => {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ block: 'center' });
  }, [id]);
  return null;
}
