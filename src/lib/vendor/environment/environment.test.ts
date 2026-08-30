// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetEnvironment,
  classifyDevice,
  configureBreakpoints,
  getEnvironment,
  observeEnvironment,
  observeViewport,
  TABLET_MIN_SHORT_SIDE,
  type EnvironmentSnapshot,
} from './environment.js';

// jsdom has no matchMedia and no layout — drive both with a controllable mock.
type MediaState = Record<string, boolean>;

function installMatchMedia(state: MediaState) {
  const listeners = new Map<string, Set<() => void>>();
  const mm = vi.fn((query: string) => ({
    media: query,
    get matches() {
      return !!state[query];
    },
    onchange: null,
    addEventListener: (_type: string, cb: () => void) => {
      let set = listeners.get(query);
      if (!set) listeners.set(query, (set = new Set()));
      set.add(cb);
    },
    removeEventListener: (_type: string, cb: () => void) => listeners.get(query)?.delete(cb),
    addListener: (cb: () => void) => {
      let set = listeners.get(query);
      if (!set) listeners.set(query, (set = new Set()));
      set.add(cb);
    },
    removeListener: (cb: () => void) => listeners.get(query)?.delete(cb),
    dispatchEvent: () => true,
  }));
  window.matchMedia = mm as unknown as typeof window.matchMedia;
  return {
    set(next: MediaState) {
      Object.assign(state, next);
    },
    fire(query: string) {
      listeners.get(query)?.forEach((cb) => cb());
    },
    mm,
    activeQueries: () => listeners.size,
  };
}

function setWidth(px: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: px });
}

/** Media state for a mouse-driven desktop at 1200px, landscape. */
const DESKTOP: MediaState = {
  '(pointer: coarse)': false,
  '(pointer: fine)': true,
  '(any-pointer: coarse)': false,
  '(hover: hover)': true,
  '(orientation: portrait)': false,
};

/** Media state for a touch-first phone, portrait. */
const PHONE: MediaState = {
  '(pointer: coarse)': true,
  '(pointer: fine)': false,
  '(any-pointer: coarse)': true,
  '(hover: hover)': false,
  '(orientation: portrait)': true,
};

beforeEach(() => {
  setWidth(1200);
});

afterEach(() => {
  __resetEnvironment();
  vi.unstubAllGlobals();
  delete (window as { matchMedia?: unknown }).matchMedia;
  setWidth(1024);
});

describe('capability detection', () => {
  it('reports a mouse desktop as fine-pointer, hoverable, not touch-primary', () => {
    installMatchMedia({ ...DESKTOP });
    const env = getEnvironment();
    expect(env.pointer).toBe('fine');
    expect(env.canHover).toBe(true);
    expect(env.hasCoarsePointer).toBe(false);
    expect(env.isTouchPrimary).toBe(false);
    expect(env.orientation).toBe('landscape');
  });

  it('flags a coarse + no-hover device as touch-primary', () => {
    installMatchMedia({ ...PHONE });
    const env = getEnvironment();
    expect(env.pointer).toBe('coarse');
    expect(env.canHover).toBe(false);
    expect(env.isTouchPrimary).toBe(true);
    expect(env.orientation).toBe('portrait');
  });

  it('isTouchPrimary stays true on a WIDE (landscape) phone — capability beats width', () => {
    setWidth(1000); // wide enough to be "desktop" by width alone
    installMatchMedia({ ...PHONE, '(orientation: portrait)': false });
    const env = getEnvironment();
    expect(env.breakpoint).toBe('tablet'); // width says tablet…
    expect(env.isTouchPrimary).toBe(true); // …but capability still says touch-first
  });

  it('a touchscreen laptop (coarse available, but hover + fine primary) is NOT touch-primary', () => {
    installMatchMedia({
      '(pointer: coarse)': false,
      '(pointer: fine)': true,
      '(any-pointer: coarse)': true,
      '(hover: hover)': true,
      '(orientation: portrait)': false,
    });
    const env = getEnvironment();
    expect(env.hasCoarsePointer).toBe(true);
    expect(env.isTouchPrimary).toBe(false);
  });
});

describe('breakpoints', () => {
  it('resolves the default buckets by width', () => {
    installMatchMedia({ ...DESKTOP });
    setWidth(500);
    expect(getEnvironment().breakpoint).toBe('mobile');
    __resetEnvironment();
    installMatchMedia({ ...DESKTOP });
    setWidth(800);
    expect(getEnvironment().breakpoint).toBe('tablet');
    __resetEnvironment();
    installMatchMedia({ ...DESKTOP });
    setWidth(1600);
    expect(getEnvironment().breakpoint).toBe('desktop');
  });

  it('honors a custom breakpoint map', () => {
    installMatchMedia({ ...DESKTOP });
    configureBreakpoints({ compact: 480, wide: Infinity });
    setWidth(400);
    expect(getEnvironment().breakpoint).toBe('compact');
    setWidth(1000);
    expect(getEnvironment().breakpoint).toBe('wide');
  });
});

describe('observeEnvironment', () => {
  it('fires immediately with the current snapshot, then on change', () => {
    const media = installMatchMedia({ ...PHONE });
    const seen: string[] = [];
    const unsub = observeEnvironment((env) => seen.push(env.orientation));
    expect(seen).toEqual(['portrait']); // immediate

    media.set({ '(orientation: portrait)': false });
    media.fire('(orientation: portrait)');
    expect(seen).toEqual(['portrait', 'landscape']);
    unsub();
  });

  it('can opt out of the immediate fire', () => {
    installMatchMedia({ ...DESKTOP });
    const seen: unknown[] = [];
    const unsub = observeEnvironment((env) => seen.push(env), { immediate: false });
    expect(seen).toHaveLength(0);
    unsub();
  });

  it('does not notify when nothing actually changed', () => {
    const media = installMatchMedia({ ...DESKTOP });
    const cb = vi.fn();
    const unsub = observeEnvironment(cb);
    cb.mockClear();
    media.fire('(hover: hover)'); // recompute, but no field changed
    expect(cb).not.toHaveBeenCalled();
    unsub();
  });

  it('detaches media listeners when the last subscriber leaves', () => {
    const media = installMatchMedia({ ...DESKTOP });
    const a = observeEnvironment(() => {});
    const b = observeEnvironment(() => {});
    expect(media.activeQueries()).toBeGreaterThan(0);
    a();
    b();
    // After the last unsubscribe a fire reaches nobody (listeners removed).
    const cb = vi.fn();
    media.fire('(orientation: portrait)');
    expect(cb).not.toHaveBeenCalled();
  });

  it('re-notifies subscribers when breakpoints are reconfigured', () => {
    installMatchMedia({ ...DESKTOP });
    setWidth(700);
    const seen: string[] = [];
    const unsub = observeEnvironment((env) => seen.push(env.breakpoint));
    expect(seen).toEqual(['tablet']);
    configureBreakpoints({ mobile: 900, desktop: Infinity });
    expect(seen).toEqual(['tablet', 'mobile']);
    unsub();
  });
});

describe('observeViewport (continuous, throttled)', () => {
  // Drive the rAF-coalesced resize handler synchronously, and the 30ms throttle
  // via fake timers, so both are deterministic in jsdom (which has no layout).
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function fireResize(px: number): void {
    setWidth(px);
    window.dispatchEvent(new Event('resize'));
  }

  it('fires immediately, then on raw width change (leading edge)', () => {
    installMatchMedia({ ...DESKTOP });
    const seen: number[] = [];
    const unsub = observeViewport((env) => seen.push(env.viewportWidth));
    expect(seen).toEqual([1200]); // immediate
    fireResize(1100);
    expect(seen).toEqual([1200, 1100]); // leading-edge fire, no timer wait
    unsub();
  });

  it('throttles a resize burst to one leading + one trailing notify', () => {
    installMatchMedia({ ...DESKTOP });
    const seen: number[] = [];
    const unsub = observeViewport((env) => seen.push(env.viewportWidth), { immediate: false });
    fireResize(1100); // leading — fires now
    fireResize(1050); // within 30ms — schedules a trailing notify
    fireResize(1000); // within 30ms — coalesced into that same trailing
    expect(seen).toEqual([1100]);
    vi.advanceTimersByTime(30);
    expect(seen).toEqual([1100, 1000]); // trailing carries the settled width
    unsub();
  });

  it('does NOT wake environmentChanged subscribers on a pure width change', () => {
    installMatchMedia({ ...DESKTOP });
    const envSeen = vi.fn();
    const vpSeen = vi.fn();
    const dropEnv = observeEnvironment(envSeen, { immediate: false });
    const dropVp = observeViewport(vpSeen, { immediate: false });
    fireResize(1100); // width changed, breakpoint still 'desktop'
    expect(envSeen).not.toHaveBeenCalled();
    expect(vpSeen).toHaveBeenCalledTimes(1);
    dropEnv();
    dropVp();
  });

  it('still wakes environmentChanged when a width change crosses a breakpoint', () => {
    installMatchMedia({ ...DESKTOP });
    const seen: string[] = [];
    const unsub = observeEnvironment((env) => seen.push(env.breakpoint), { immediate: false });
    fireResize(500); // desktop → mobile bucket
    expect(seen).toEqual(['mobile']);
    unsub();
  });

  it('keeps the shared resize listener alive while either channel has a subscriber', () => {
    installMatchMedia({ ...DESKTOP });
    const vpSeen = vi.fn();
    const dropEnv = observeEnvironment(() => {}, { immediate: false });
    const dropVp = observeViewport(vpSeen, { immediate: false });
    dropEnv(); // discrete channel gone; viewport channel still live
    fireResize(1100);
    expect(vpSeen).toHaveBeenCalledTimes(1); // resize still observed
    dropVp();
  });
});

describe('OS detection (UA hint)', () => {
  function stubNavigator(nav: Partial<Navigator> & { userAgentData?: { platform?: string } }): void {
    vi.stubGlobal('navigator', nav);
  }

  it('reads Client Hints platform when present', () => {
    stubNavigator({ userAgentData: { platform: 'Windows' }, maxTouchPoints: 0, userAgent: '' });
    installMatchMedia({ ...DESKTOP });
    const env = getEnvironment();
    expect(env.os).toBe('windows');
    expect(env.isApple).toBe(false);
    expect(env.isAndroid).toBe(false);
  });

  it('treats a macOS Client Hint WITH touch as an iPad (masquerade correction)', () => {
    stubNavigator({ userAgentData: { platform: 'macOS' }, maxTouchPoints: 5, userAgent: '' });
    installMatchMedia({ ...PHONE });
    const env = getEnvironment();
    expect(env.os).toBe('ios');
    expect(env.isApple).toBe(true);
  });

  it('reports a real Mac (no touch) as macos', () => {
    stubNavigator({ userAgentData: { platform: 'macOS' }, maxTouchPoints: 0, userAgent: '' });
    installMatchMedia({ ...DESKTOP });
    expect(getEnvironment().os).toBe('macos');
    expect(getEnvironment().isApple).toBe(true);
  });

  it('falls back to the UA string for iPhone', () => {
    stubNavigator({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' });
    installMatchMedia({ ...PHONE });
    const env = getEnvironment();
    expect(env.os).toBe('ios');
    expect(env.isApple).toBe(true);
  });

  it('detects Android from the UA string', () => {
    stubNavigator({ maxTouchPoints: 5, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' });
    installMatchMedia({ ...PHONE });
    const env = getEnvironment();
    expect(env.os).toBe('android');
    expect(env.isAndroid).toBe(true);
    expect(env.isApple).toBe(false);
  });

  it('corrects the iPadOS "Macintosh" UA masquerade via maxTouchPoints', () => {
    stubNavigator({
      maxTouchPoints: 5,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    });
    installMatchMedia({ ...PHONE });
    expect(getEnvironment().os).toBe('ios');
  });
});

describe('SSR / no matchMedia', () => {
  it('returns the static desktop default when matchMedia is unavailable', () => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    const env = getEnvironment();
    expect(env.pointer).toBe('fine');
    expect(env.isTouchPrimary).toBe(false);
    expect(env.breakpoint).toBe('desktop');
    expect(env.os).toBe('unknown');
  });

  it('observeEnvironment still fires once and returns a working unsubscribe', () => {
    delete (window as { matchMedia?: unknown }).matchMedia;
    const cb = vi.fn();
    const unsub = observeEnvironment(cb);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(() => unsub()).not.toThrow();
  });
});

describe('classifyDevice', () => {
  // Pure function over a snapshot — build snapshots directly (no matchMedia needed).
  const snap = (over: Partial<EnvironmentSnapshot>): EnvironmentSnapshot => ({
    pointer: 'fine',
    hasCoarsePointer: false,
    canHover: true,
    isTouchPrimary: false,
    orientation: 'landscape',
    viewportWidth: 1440,
    viewportHeight: 900,
    breakpoint: 'desktop',
    os: 'unknown',
    isApple: false,
    isAndroid: false,
    ...over,
  });

  it('classifies by capability first: any non-touch-primary device is desktop, at any width', () => {
    expect(classifyDevice(snap({ isTouchPrimary: false, viewportWidth: 1440 }))).toBe('desktop');
    // A narrowed desktop window (< 600) stays desktop — the motivating scenario.
    expect(classifyDevice(snap({ isTouchPrimary: false, viewportWidth: 480, viewportHeight: 800 }))).toBe('desktop');
  });

  it('touch-primary + short side < 600 ⇒ mobile (orientation-robust)', () => {
    expect(classifyDevice(snap({ isTouchPrimary: true, viewportWidth: 390, viewportHeight: 844 }))).toBe('mobile');
    // Landscape phone: wide, but short side still 390.
    expect(classifyDevice(snap({ isTouchPrimary: true, viewportWidth: 844, viewportHeight: 390 }))).toBe('mobile');
  });

  it('touch-primary + short side ≥ 600 ⇒ tablet', () => {
    expect(classifyDevice(snap({ isTouchPrimary: true, viewportWidth: 768, viewportHeight: 1024 }))).toBe('tablet');
  });

  it('the 600 boundary is inclusive-tablet (< 600 mobile, == 600 tablet)', () => {
    const under = snap({ isTouchPrimary: true, viewportWidth: 900, viewportHeight: TABLET_MIN_SHORT_SIDE - 1 });
    const at = snap({ isTouchPrimary: true, viewportWidth: 900, viewportHeight: TABLET_MIN_SHORT_SIDE });
    expect(classifyDevice(under)).toBe('mobile');
    expect(classifyDevice(at)).toBe('tablet');
  });
});
