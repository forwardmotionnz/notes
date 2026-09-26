/* A phone with the on-screen keyboard up: the caret and the header stay in view. */
import * as H from './harness.mjs';

const t = H.suite('keyboard');
await H.start();

const LONG = Array.from({ length: 80 }, (_, i) => `line ${i + 1}`).join('\n') + '\n';
const W = 390, FULL = 844, KEYBOARD = 336;          // an iPhone 14 and its keyboard

// iOS keeps the page the full height and reports what is left above the
// keyboard through window.visualViewport (height, and offsetTop when it pans
// the page). This stands in for it, driven by the test.
async function phone() {
  const gh = H.fakeGitHub({ files: { 'inbox.md': LONG, 'todo.md': '- [ ] one\n' } });
  const ctx = await H.context(gh, { viewport: { width: W, height: FULL } });
  await ctx.addInitScript(() => {
    const vv = new EventTarget();
    Object.assign(vv, { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    // As iOS does: the keyboard coming or going is a resize; Safari panning
    // the page to reach the caret is a scroll.
    window.keyboard = (px, pan = 0) => {
      vv.height = innerHeight - px;
      vv.dispatchEvent(new Event('resize'));
      if (pan !== vv.offsetTop) { vv.offsetTop = vv.pageTop = pan; vv.dispatchEvent(new Event('scroll')); }
    };
  });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 400);
  return { gh, ctx, p };
}

// Inside the visible area, and the thing actually under its own centre
// (not covered by something else).
const onScreen = (p, sel) => p.evaluate(sel => {
  const el = document.querySelector(sel);
  if (!el) return 'missing';
  const r = el.getBoundingClientRect(), vv = window.visualViewport;
  if (r.width === 0) return 'hidden';
  if (r.top < vv.offsetTop - 0.5 || r.bottom > vv.offsetTop + vv.height + 0.5) return `outside ${Math.round(r.top)}-${Math.round(r.bottom)} of ${vv.offsetTop}-${vv.offsetTop + vv.height}`;
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return hit === el || el.contains(hit) ? 'ok' : 'covered by ' + (hit && (hit.id || hit.tagName));
}, sel);

for (const pan of [0, 120]) {
  const label = pan ? 'keyboard up, page panned' : 'keyboard up';
  const { ctx, p } = await phone();
  await p.click('#btn-tree');
  await H.settle(p, 250);
  await H.clickRow(p, 'inbox.md');
  await H.settle(p, 300);
  // Caret at the very end of a long note, then the keyboard comes up.
  await p.evaluate(() => { const ta = document.querySelector('#cm-stub'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
  await p.evaluate(([k, pan]) => window.keyboard(k, pan), [KEYBOARD, pan]);
  await H.settle(p, 200);
  await H.still(p);
  for (const b of ['#btn-tree', '#btn-save', '#btn-pins', '#btn-settings']) {
    t.check(`${label}: ${b} stays on screen and tappable`, (await onScreen(p, b)) === 'ok', await onScreen(p, b));
  }
  t.check(`${label}: the editor ends at the keyboard`, (await onScreen(p, '#cm-stub')) === 'ok' ||
    (await p.evaluate(() => { const r = document.querySelector('#cm-stub').getBoundingClientRect(), vv = visualViewport;
      return r.top >= vv.offsetTop && r.bottom <= vv.offsetTop + vv.height + 0.5; })), await onScreen(p, '#cm-stub'));
  await p.keyboard.type('\nnew words at the end');
  await H.settle(p, 150);
  const caret = await p.evaluate(() => {
    const ta = document.querySelector('#cm-stub'), r = ta.getBoundingClientRect(), vv = visualViewport;
    // The caret is on the last line: in view when the textarea shows its end,
    // give or take one line and its bottom padding.
    const cs = getComputedStyle(ta), line = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    return { scrolledToEnd: ta.scrollHeight - (ta.scrollTop + ta.clientHeight) <= line + parseFloat(cs.paddingBottom) + 2,
             gap: Math.round(ta.scrollHeight - (ta.scrollTop + ta.clientHeight)), line,
             boxVisible: r.top >= vv.offsetTop - 0.5 && r.bottom <= vv.offsetTop + vv.height + 0.5 };
  });
  t.check(`${label}: typing at the end keeps the caret in view`, caret.scrolledToEnd && caret.boxVisible, JSON.stringify(caret));
  t.check(`${label}: and what was typed is there`, (await H.editorValue(p)).endsWith('new words at the end'));

  await p.evaluate(() => window.keyboard(0, 0));
  await H.settle(p, 200);
  t.check(`${label}: keyboard down, the app fills the screen again`, await p.evaluate(() =>
    Math.abs(document.getElementById('shell').getBoundingClientRect().bottom - innerHeight) < 1));
  t.check(`${label}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
  await ctx.close();
}

/* ===== pinch zoom also shrinks the visible area; that is not a keyboard ===== */
{
  const { ctx, p } = await phone();
  await p.evaluate(() => {
    const vv = window.visualViewport;
    vv.scale = 2; vv.height = innerHeight / 2; vv.offsetTop = 200;
    vv.dispatchEvent(new Event('resize'));
  });
  await H.settle(p, 150);
  t.check('zoomed in: the app keeps its full size', await p.evaluate(() => {
    const r = document.getElementById('shell').getBoundingClientRect();
    return Math.abs(r.height - innerHeight) < 1 && Math.abs(r.top) < 1;
  }));
  await ctx.close();
}

/* ===== the pinned tasks sheet, at real keyboard heights ===== */
// What is left above the keyboard on real phones: an iPhone 14 with Safari's
// form bar (417 of 844), and an iPhone SE (343 of 667).
for (const [label, height, keyboard] of [['iPhone 14', FULL, FULL - 417], ['iPhone SE', 667, 667 - 343]]) {
  const gh = H.fakeGitHub({ files: { 'todo.md': '- [ ] one\n' } });
  const ctx = await H.context(gh, { viewport: { width: W === 390 && height === 667 ? 375 : W, height } });
  await ctx.addInitScript(() => {
    const vv = new EventTarget();
    Object.assign(vv, { width: innerWidth, height: innerHeight, offsetTop: 0, offsetLeft: 0, pageTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => vv });
    window.keyboard = px => { vv.height = innerHeight - px; vv.dispatchEvent(new Event('resize')); };
  });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 300);
  await p.click('#btn-pins');
  await H.settle(p, 300);
  await H.still(p);                                 // the sheet has finished sliding in
  await p.focus('#pin-input');
  await p.evaluate(k => window.keyboard(k), keyboard);
  await H.settle(p, 250);
  await H.still(p);
  t.check(`pins sheet, ${label}: the "Add a task" box stays above the keyboard`, (await onScreen(p, '#pin-input')) === 'ok', await onScreen(p, '#pin-input'));
  t.check(`pins sheet, ${label}: and its Add button`, (await onScreen(p, '#pin-go')) === 'ok', await onScreen(p, '#pin-go'));
  await ctx.close();
}

/* ===== iOS zooms into any field with text under 16px, and then the fit is off ===== */
{
  const { ctx, p } = await phone();
  const small = await p.evaluate(() => {
    const fields = [...document.querySelectorAll('input:not([type=checkbox]), textarea, select, [contenteditable]')];
    return fields.map(f => [f.id || f.className || f.tagName, parseFloat(getComputedStyle(f).fontSize)]).filter(([, px]) => px < 16);
  });
  t.check('on a phone every field is at least 16px, so iOS does not zoom when it is tapped', small.length === 0, JSON.stringify(small));
  await ctx.close();
}

/* ===== panning is not a reason to move the note ===== */
{
  const { ctx, p } = await phone();
  await p.evaluate(() => openFile('inbox.md'));
  await H.settle(p, 400);
  await p.evaluate(() => { const ta = document.querySelector('#cm-stub'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); window.cmScrolls = 0; window.cmRefreshes = 0; });
  await p.evaluate(k => window.keyboard(k), KEYBOARD);
  await H.settle(p, 100);
  const up = await p.evaluate(() => [window.cmRefreshes, window.cmScrolls]);
  t.check('keyboard up while typing: the editor re-measures and shows the caret, once', up[0] === 1 && up[1] === 1, JSON.stringify(up));
  // Rereading above the caret, then Safari pans the page.
  await p.evaluate(() => { const vv = visualViewport; for (const y of [10, 40, 80, 20]) { vv.offsetTop = vv.pageTop = y; vv.dispatchEvent(new Event('scroll')); } });
  await H.settle(p, 100);
  const panned = await p.evaluate(() => [window.cmRefreshes, window.cmScrolls]);
  t.check('panning does not pull the note back to the caret, nor re-measure it', panned[0] === 1 && panned[1] === 1, JSON.stringify(panned));
  // The keyboard goes and comes back while the filter, not the note, has focus.
  await p.evaluate(k => { document.getElementById('filter').focus(); window.keyboard(0); window.keyboard(k); }, KEYBOARD);
  await H.settle(p, 100);
  const other = await p.evaluate(() => [window.cmRefreshes, window.cmScrolls]);
  t.check('typing elsewhere: the note is re-measured but not moved to its caret', other[0] === 3 && other[1] === 1, JSON.stringify(other));
  await ctx.close();
}

/* ===== Android: the page itself is resized ===== */
{
  const gh = H.fakeGitHub({ files: { 'inbox.md': LONG } });
  const ctx = await H.context(gh, { viewport: { width: W, height: FULL } });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.settle(p, 300);
  t.check('Android is asked to resize the page for the keyboard', await p.evaluate(() =>
    /interactive-widget=resizes-content/.test(document.querySelector('meta[name=viewport]').content)));
  await p.setViewportSize({ width: W, height: FULL - KEYBOARD });
  await H.settle(p, 200);
  t.check('resized: Save and settings still on screen', (await onScreen(p, '#btn-save')) === 'ok' &&
    (await onScreen(p, '#btn-settings')) === 'ok');
  await ctx.close();
}

await H.stop();
t.finish();
