'use client';

import { useActionState } from 'react';
import type { FormState } from '@/app/admin/actions';

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/** A server-action form with a status line. */
export function AdminForm({ action, submit, children, danger }: { action: Action; submit: string; children: React.ReactNode; danger?: boolean }) {
  const [state, run, pending] = useActionState(action, null);
  return (
    <form action={run} className="adm-form">
      {children}
      <button className={`cta${danger ? '' : ' yellow'}`} disabled={pending} style={danger ? { background: '#3a1512', color: '#f3b3ab' } : undefined}>{pending ? 'Saving…' : submit}</button>
      {state?.msg && <p className={`adm-msg${state.ok ? ' ok' : ''}`}>{state.msg}</p>}
    </form>
  );
}
