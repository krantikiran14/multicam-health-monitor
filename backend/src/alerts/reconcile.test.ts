import { reconcile } from './reconcile';
import type { Breach } from '../thresholds/evaluate';

function breach(type: Breach['type']): Breach {
  return { type, severity: 'warning', message: type, thresholdValue: null, observedValue: null };
}

describe('reconcile', () => {
  it('opens an alert for a new breach with no open alert', () => {
    const result = reconcile([breach('cpu_high')], []);
    expect(result.toOpen.map((b) => b.type)).toEqual(['cpu_high']);
    expect(result.toResolve).toEqual([]);
  });

  it('does not re-open an alert that is already open (no duplicates)', () => {
    const result = reconcile([breach('cpu_high')], [{ type: 'cpu_high' }]);
    expect(result.toOpen).toEqual([]);
    expect(result.toResolve).toEqual([]);
  });

  it('resolves an open alert whose breach has cleared', () => {
    const result = reconcile([], [{ type: 'cpu_high' }]);
    expect(result.toOpen).toEqual([]);
    expect(result.toResolve).toEqual(['cpu_high']);
  });

  it('opens new and resolves old in the same pass', () => {
    const result = reconcile([breach('offline')], [{ type: 'cpu_high' }]);
    expect(result.toOpen.map((b) => b.type)).toEqual(['offline']);
    expect(result.toResolve).toEqual(['cpu_high']);
  });

  it('handles many types at once', () => {
    const result = reconcile(
      [breach('cpu_high'), breach('fault')],
      [{ type: 'fault' }, { type: 'storage_high' }],
    );
    expect(result.toOpen.map((b) => b.type)).toEqual(['cpu_high']);
    expect(result.toResolve).toEqual(['storage_high']);
  });
});
