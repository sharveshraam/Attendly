import { percentAfterMissingOne, simulate, summarize } from '../engine';

const present = (n: number) => Array.from({ length: n }, () => ({ status: 'present' as const }));
const absent = (n: number) => Array.from({ length: n }, () => ({ status: 'absent' as const }));

describe('summarize — core percentage', () => {
  it('computes attended / conducted and excludes unmarked', () => {
    const r = summarize({
      targetPercent: 75,
      sessions: [...present(3), ...absent(1), { status: 'unmarked' }, { status: 'unmarked' }],
    });
    expect(r.percent).toBe(75);
    expect(r.conducted).toBe(4);
    expect(r.counted).toBe(4);
    expect(r.unmarked).toBe(2);
    expect(r.present).toBe(3);
    expect(r.absent).toBe(1);
  });

  it('never turns unmarked sessions into absences', () => {
    const r = summarize({ sessions: [{ status: 'unmarked' }, { status: 'unmarked' }] });
    expect(r.percent).toBeNull();
    expect(r.absent).toBe(0);
    expect(r.conducted).toBe(0);
    expect(r.risk).toBe('unknown');
  });

  it('excludes excused from the denominator but counts them as conducted', () => {
    const r = summarize({
      sessions: [{ status: 'present' }, { status: 'absent' }, { status: 'excused' }, { status: 'unmarked' }],
    });
    expect(r.percent).toBe(50);
    expect(r.conducted).toBe(3);
    expect(r.counted).toBe(2);
    expect(r.excused).toBe(1);
  });

  it('returns null percent when nothing is counted', () => {
    expect(summarize({ sessions: [] }).percent).toBeNull();
  });

  it('defaults to unmarked when status is omitted', () => {
    const r = summarize({ sessions: [{}] });
    expect(r.unmarked).toBe(1);
    expect(r.percent).toBeNull();
  });
});

describe('summarize — cancelled / rescheduled / extra sessions', () => {
  it('excludes cancelled sessions entirely', () => {
    const r = summarize({
      sessions: [...present(2), { status: 'present', lifecycle: 'cancelled' }, { status: 'absent', lifecycle: 'cancelled' }],
    });
    expect(r.cancelled).toBe(2);
    expect(r.conducted).toBe(2);
    expect(r.percent).toBe(100);
  });

  it('excludes rescheduled originals so the class is not double counted', () => {
    const r = summarize({
      sessions: [
        { status: 'unmarked', lifecycle: 'rescheduled' }, // original slot
        { status: 'present' }, // replacement dated session
      ],
    });
    expect(r.rescheduled).toBe(1);
    expect(r.counted).toBe(1);
    expect(r.percent).toBe(100);
  });

  it('counts extra classes as ordinary sessions', () => {
    const r = summarize({ sessions: [...present(5), { status: 'present' }] });
    expect(r.counted).toBe(6);
    expect(r.percent).toBe(100);
  });
});

describe('summarize — bunk allowance', () => {
  it('computes safe bunk allowance at 75%', () => {
    const r = summarize({ targetPercent: 75, sessions: [...present(16), ...absent(4)] });
    expect(r.percent).toBe(80);
    expect(r.bunkAllowance).toBe(1);
  });

  it('returns 0 allowance when below target', () => {
    const r = summarize({ targetPercent: 75, sessions: [...present(7), ...absent(3)] });
    expect(r.percent).toBe(70);
    expect(r.bunkAllowance).toBe(0);
    expect(r.risk).toBe('at_risk');
  });

  it('flags warning when allowance is 0 or 1 but still at/above target', () => {
    const r = summarize({ targetPercent: 75, sessions: [...present(3), ...absent(1)] });
    expect(r.percent).toBe(75);
    expect(r.bunkAllowance).toBe(0);
    expect(r.risk).toBe('warning');
  });

  it('caps allowance at remaining schedule for a 0% target', () => {
    const r = summarize({ targetPercent: 0, sessions: present(2), futureUnits: 5 });
    expect(r.bunkAllowance).toBe(5);
  });

  it('reports unknown allowance for 0% target without future data', () => {
    const r = summarize({ targetPercent: 0, sessions: present(2), futureUnits: null });
    expect(r.bunkAllowance).toBeNull();
  });
});

describe('summarize — recovery', () => {
  it('computes consecutive classes needed to recover', () => {
    const r = summarize({ targetPercent: 85, sessions: [...present(7), ...absent(3)] });
    expect(r.percent).toBe(70);
    expect(r.recoveryClasses).toBe(10);
    expect(r.bunkAllowance).toBe(0);
  });

  it('returns 0 recovery when already at target', () => {
    const r = summarize({ targetPercent: 75, sessions: [...present(16), ...absent(4)] });
    expect(r.recoveryClasses).toBe(0);
  });

  it('marks a 100% target as unrecoverable once a class is missed', () => {
    const r = summarize({ targetPercent: 100, sessions: [{ status: 'present' }, { status: 'absent' }] });
    expect(r.recoveryClasses).toBeNull();
    expect(r.bunkAllowance).toBe(0);
  });
});

describe('summarize — hours mode', () => {
  it('uses attended minutes and excludes excused', () => {
    const r = summarize({
      mode: 'hours',
      targetPercent: 75,
      sessions: [
        { status: 'present', scheduledMinutes: 90, attendedMinutes: 60 },
        { status: 'absent', scheduledMinutes: 90 },
        { status: 'excused', scheduledMinutes: 180 },
      ],
    });
    expect(r.attendedUnits).toBe(60);
    expect(r.countedUnits).toBe(180);
    expect(r.percent).toBe(33.3);
    expect(r.excused).toBe(1);
    expect(r.recoveryMinutes).toBe(300);
    expect(r.bunkAllowanceMinutes).toBe(0);
  });

  it('rejects attended minutes exceeding scheduled minutes', () => {
    expect(() =>
      summarize({ mode: 'hours', sessions: [{ status: 'present', scheduledMinutes: 30, attendedMinutes: 45 }] }),
    ).toThrow(RangeError);
  });
});

describe('summarize — projections', () => {
  it('projects best and worst case from remaining schedule', () => {
    const r = summarize({ targetPercent: 75, sessions: [...present(8), ...absent(2)], futureUnits: 10 });
    expect(r.projectedBestPercent).toBe(90);
    expect(r.projectedWorstPercent).toBe(40);
  });

  it('reports unknown projections when future schedule is incomplete', () => {
    const r = summarize({ sessions: present(5), futureUnits: null });
    expect(r.projectedBestPercent).toBeNull();
    expect(r.projectedWorstPercent).toBeNull();
  });
});

describe('summarize — validation', () => {
  it('rejects invalid targets', () => {
    expect(() => summarize({ targetPercent: 101, sessions: [] })).toThrow(RangeError);
    expect(() => summarize({ targetPercent: -1, sessions: [] })).toThrow(RangeError);
  });

  it('rejects unknown statuses', () => {
    expect(() => summarize({ sessions: [{ status: 'late' as never }] })).toThrow(RangeError);
  });

  it('rejects negative future units', () => {
    expect(() => summarize({ sessions: [], futureUnits: -3 })).toThrow(TypeError);
  });
});

describe('simulate — what-if scenarios', () => {
  const base = summarize({ targetPercent: 75, sessions: [...present(8), ...absent(2)], futureUnits: 10 });

  it('attending all future classes raises the percentage', () => {
    const r = simulate(base, { attendFuture: 10 });
    expect(r.valid).toBe(true);
    expect(r.percent).toBe(90);
    expect(r.meetsTarget).toBe(true);
    expect(r.remainingFutureUnits).toBe(0);
  });

  it('missing one more class lowers the percentage', () => {
    const r = simulate(base, { missFuture: 1 });
    expect(r.percent).toBeCloseTo(72.7, 1);
    expect(r.meetsTarget).toBe(false);
  });

  it('extra attended classes count toward recovery', () => {
    const low = summarize({ targetPercent: 75, sessions: [...present(7), ...absent(3)], futureUnits: 20 });
    const r = simulate(low, { extraAttended: 10 });
    expect(r.percent).toBe(85);
    expect(r.meetsTarget).toBe(true);
  });

  it('cancelling future classes removes them from projections', () => {
    const r = simulate(base, { cancelFuture: 5 });
    expect(r.remainingFutureUnits).toBe(5);
    expect(r.percent).toBe(80);
  });

  it('rejects scenarios exceeding the remaining schedule', () => {
    const r = simulate(base, { attendFuture: 11 });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/exceeds/i);
  });

  it('refuses scheduled-class simulation without future data', () => {
    const noFuture = summarize({ sessions: present(5), futureUnits: null });
    const r = simulate(noFuture, { missFuture: 1 });
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/incomplete/i);
  });

  it('still allows extra classes without future schedule data', () => {
    const noFuture = summarize({ sessions: [...present(7), ...absent(3)], futureUnits: null });
    const r = simulate(noFuture, { extraAttended: 10 });
    expect(r.valid).toBe(true);
    expect(r.percent).toBe(85);
  });
});

describe('percentAfterMissingOne', () => {
  it('computes the next-class drop', () => {
    const base = summarize({ targetPercent: 75, sessions: [...present(16), ...absent(4)] });
    expect(percentAfterMissingOne(base)).toBe(76.2);
  });

  it('returns null with no data', () => {
    expect(percentAfterMissingOne(summarize({ sessions: [] }))).toBeNull();
  });
});
