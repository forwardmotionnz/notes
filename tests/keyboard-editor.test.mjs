/* A keyboard can shrink/pan the visual viewport without resizing the layout:
   https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport
   These events are simulated; real phone keyboard/standalone testing remains
   an owner smoke test. Editor layout uses real CodeMirror, never its stub. */
import { readFileSync } from 'node:fs';
import * as H from './harness.mjs';
const t = H.suite('keyboard');
await H.start();
const text = Array.from({ length: 90 }, (_, i) => i === 89 ? 'Wrapped ' + 'word '.repeat(60) + '<b data-keyboard-probe>literal text</b>' : `Line ${i + 1}`).join('\n');
for (const fallback of [false, true]) {
  const label = fallback ? 'plain editor' : 'CodeMirror';
  const gh = H.fakeGitHub({ files: { 'long.md': text } });
  const ctx = await H.context(gh, { noCdn: fallback, viewport: { width: 390, height: 820 } });
  if (!fallback) await ctx.route('**/cdnjs.cloudflare.com/**', route => {
    const name = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ contentType: name.endsWith('.css') ? 'text/css' : 'application/javascript',
      body: name.startsWith('codemirror.min.') ? readFileSync(new URL(`./fixtures/codemirror5/${name}`, import.meta.url)) : '' });
  });
  await ctx.addInitScript(() => {
    window.keyboardMarkup = false;
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType === 1 && (node.matches('[data-keyboard-probe]') || node.querySelector('[data-keyboard-probe]'))) window.keyboardMarkup = true;
      }
    }).observe(document, { childList: true, subtree: true });
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 820, width: 390, offsetTop: 0, offsetLeft: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  });
  const p = await H.page(ctx);
  await H.signIn(p);
  await H.clickRow(p, 'long.md');
  await p.waitForFunction(() => current?.path === 'long.md' && editor);
  await p.evaluate(() => {
    editor.focus();
    if (editor.setCursor) editor.setCursor({ line: 89, ch: 10000 });
    else {
      const ta = editor.getWrapperElement();
      ta.setSelectionRange(ta.value.length, ta.value.length);
      ta.scrollTop = ta.scrollHeight;
    }
  });
  const changeViewport = async (properties, event = 'resize') => {
    await p.evaluate(({ properties, event }) => {
      Object.assign(visualViewport, properties);
      visualViewport.dispatchEvent(new Event(event));
    }, { properties, event });
    await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const geometry = () => p.evaluate(() => {
    const shell = document.querySelector('#shell').getBoundingClientRect();
    const host = editor.getWrapperElement(), rect = host.getBoundingClientRect();
    const header = document.querySelector('header').getBoundingClientRect();
    const buttons = ['btn-save', 'btn-settings', 'btn-tree', 'btn-pins'].map(id => document.getElementById(id)).filter(Boolean);
    const caret = editor.cursorCoords ? editor.cursorCoords(null, 'window') : {
      top: rect.top + host.scrollHeight - host.scrollTop - parseFloat(getComputedStyle(host).paddingBottom) - parseFloat(getComputedStyle(host).lineHeight),
      bottom: rect.top + host.scrollHeight - host.scrollTop - parseFloat(getComputedStyle(host).paddingBottom)
    };
    return { top: shell.top, bottom: shell.bottom, headerTop: header.top, headerBottom: header.bottom,
      caret, editorBottom: rect.bottom, font: parseFloat(getComputedStyle(host).fontSize),
      reachable: buttons.every(b => { const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= 390 && r.top >= visualViewport.offsetTop && r.bottom <= visualViewport.offsetTop + visualViewport.height; }),
      overflow: document.documentElement.scrollWidth > innerWidth };
  });
  await changeViewport({ height: 360 });
  let g = await geometry();
  t.check(`${label}: shell ends above the keyboard`, g.bottom <= 361, JSON.stringify(g));
  t.check(`${label}: last-line caret stays in the editor above the keyboard`, g.caret.top >= g.headerBottom && g.caret.bottom <= Math.min(360, g.editorBottom) + 1, JSON.stringify(g.caret));
  t.check(`${label}: phone text is at least 16px`, g.font >= 16);
  await changeViewport({ offsetTop: 120 }, 'scroll');
  g = await geometry();
  t.check(`${label}: header follows the panned visible viewport`, Math.abs(g.headerTop - 120) < 1 && g.reachable, JSON.stringify(g));
  t.check(`${label}: pan does not put the caret under the keyboard`, g.caret.top >= g.headerBottom && g.caret.bottom <= 481, JSON.stringify(g.caret));
  t.check(`${label}: note, selection and repository are untouched`, await p.evaluate(expected => editor.getValue() === expected && !dirty() && (editor.caret ? editor.caret() : editor.indexFromPos(editor.getCursor())) === expected.length, text) && gh.commits.length === 0);
  t.check(`${label}: caret measurement never parses note markup`, !await p.evaluate(() => window.keyboardMarkup));
  // Browser panning must not snap a reader back to the caret.
  const reading = await p.evaluate(() => {
    if (editor.scrollTo) { editor.scrollTo(null, 100); return editor.getScrollInfo().top; }
    const ta = editor.getWrapperElement(); ta.scrollTop = 100; return ta.scrollTop;
  });
  await changeViewport({ offsetTop: 100 }, 'scroll');
  t.check(`${label}: viewport panning preserves manual reading scroll`, await p.evaluate(() => editor.getScrollInfo ? editor.getScrollInfo().top : editor.getWrapperElement().scrollTop) === reading);
  await changeViewport({ height: 820, offsetTop: 0 });
  g = await geometry();
  t.check(`${label}: closing the keyboard restores the full height`, Math.abs(g.bottom - 820) < 1 && g.headerTop === 0 && !g.overflow);
  await changeViewport({ height: 410, scale: 2, offsetTop: 90 });
  g = await geometry();
  t.check(`${label}: pinch zoom keeps the layout available for normal panning`, g.top === 0 && g.bottom === 820);
  if (fallback) {
    const words = Array(25).fill('the quick brown fox jumps over the lazy dog blueberry strawberry orange.').join(' ');
    await changeViewport({ height: 820, scale: 1, offsetTop: 0 });
    await p.evaluate(words => {
      editor.setValue(words); const ta = editor.getWrapperElement();
      ta.focus(); ta.setSelectionRange(409, 409); ta.scrollTop = 0;
    }, words);
    await changeViewport({ height: 360 });
    const before = await p.locator('.fallback-editor').evaluate(ta => ta.scrollTop);
    // The browser's native ArrowRight reveals the adjacent character on the
    // same wrapped line. It should not need to repair a clipped caret.
    await p.keyboard.press('ArrowRight');
    const after = await p.locator('.fallback-editor').evaluate(ta => ta.scrollTop);
    t.check('plain editor: a caret within a wrapped word is already visible', Math.abs(after - before) <= 1, JSON.stringify({ before, after }));
    t.check('plain editor: measuring a mid-word caret preserves the text', await p.evaluate(() => editor.getValue()) === words);
  }
  await ctx.close();
}
await H.stop();
t.finish();
