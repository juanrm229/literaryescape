import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

type Row = Record<string, unknown>;
const rows = async (q: ReturnType<typeof sql>) => ((await db.execute(q)) as unknown as { rows: Row[] }).rows;

/** Everything a writer needs to tune a case. All numbers come from progress + the event log. */
export async function caseAnalytics(caseId: number) {
  const [kpi] = await rows(sql`
    select count(*) filter (where accepted_at is not null)::int as readers,
           count(*) filter (where sent_at is not null)::int as finished,
           count(*) filter (where updated_at > now() - interval '7 days')::int as active7
    from progress where case_id = ${caseId}`);

  const [timing] = await rows(sql`
    select percentile_cont(0.5) within group (order by (data->>'minutes')::float) as median_min
    from event where case_id = ${caseId} and kind = 'sent' and data->>'minutes' is not null`);

  // readers who opened each document (reading order)
  const perDoc = await rows(sql`
    select d.code, d.title, d.berkas_code, d.sort,
           (select count(*)::int from progress p where p.case_id = d.case_id and p.data->'read' ? d.code) as readers
    from document d where d.case_id = ${caseId} and d.lock is null order by d.sort`);

  const wrongNames = await rows(sql`
    select data->>'input' as input, data->>'code' as code, count(*)::int as n
    from event where case_id = ${caseId} and kind = 'name_wrong' group by 1, 2 order by n desc limit 12`);

  const puzzles = await rows(sql`
    select pz.key, pz.title, pz.kind,
      (select count(*)::int from event e where e.case_id = pz.case_id and e.kind = 'puzzle_wrong' and e.data->>'key' = pz.key) as wrong,
      (select count(*)::int from event e where e.case_id = pz.case_id and e.kind = 'puzzle_solve' and e.data->>'key' = pz.key) as solves,
      (select count(*)::int from event e where e.case_id = pz.case_id and e.kind = 'puzzle_hint' and e.data->>'key' = pz.key) as hints,
      (select round(avg((e.data->>'attempts')::float)::numeric, 1) from event e where e.case_id = pz.case_id and e.kind = 'puzzle_solve' and e.data->>'key' = pz.key) as avg_attempts
    from puzzle pz where pz.case_id = ${caseId} order by pz.sort`);

  const topPuzzleWrong = await rows(sql`
    select data->>'key' as key, data->>'input' as input, count(*)::int as n
    from event where case_id = ${caseId} and kind = 'puzzle_wrong' group by 1, 2 order by n desc limit 10`);

  const clues = await rows(sql`
    select (data->>'n')::int as n, count(distinct reader_id)::int as readers
    from event where case_id = ${caseId} and kind = 'hint' group by 1 order by 1`);

  const daily = await rows(sql`
    with days as (select generate_series(current_date - 13, current_date, interval '1 day')::date as day)
    select to_char(d.day, 'DD Mon') as day, d.day = current_date as today,
           coalesce((select count(distinct reader_id)::int from event e where e.case_id = ${caseId} and e.at::date = d.day), 0) as readers
    from days d order by d.day`);

  return {
    readers: Number(kpi?.readers ?? 0), finished: Number(kpi?.finished ?? 0), active7: Number(kpi?.active7 ?? 0),
    medianMinutes: timing?.median_min == null ? null : Math.round(Number(timing.median_min)),
    perDoc: perDoc.map((r) => ({ code: String(r.code), title: String(r.title), berkas: String(r.berkas_code), readers: Number(r.readers) })),
    wrongNames: wrongNames.map((r) => ({ input: String(r.input ?? ''), code: String(r.code ?? ''), n: Number(r.n) })),
    puzzles: puzzles.map((r) => ({ key: String(r.key), title: String(r.title), kind: String(r.kind), wrong: Number(r.wrong), solves: Number(r.solves), hints: Number(r.hints), avgAttempts: r.avg_attempts == null ? null : Number(r.avg_attempts) })),
    topPuzzleWrong: topPuzzleWrong.map((r) => ({ key: String(r.key), input: String(r.input ?? ''), n: Number(r.n) })),
    clues: clues.map((r) => ({ n: Number(r.n), readers: Number(r.readers) })),
    daily: daily.map((r) => ({ day: String(r.day), today: !!r.today, readers: Number(r.readers) })),
  };
}
