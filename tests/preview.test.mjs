import * as H from './harness.mjs';
const t=H.suite('preview');
await H.start();
const source='---\ntitle: <img src=x onerror=alert(1)>\n---\n# Heading\n\n| A | B |\n| - | - |\n| one | two |\n\n- [x] Done\n- [ ] Next\n\n```js\n<script>alert(1)</script>\n```\n\n[[Other|Read other]]\n\n[Unsafe](javascript:alert(1))\n\n<img src="https://evil.test/leak" onerror="window.pwned=1"><iframe src="https://evil.test"></iframe><svg onload="window.pwned=1"></svg><form><input name="cfg"></form>\n';
for(const noCdn of [false,true]) {
 const note=source+'\n<p onerror="window.pwned=1">Hostile paragraph</p>\n';
 const gh=H.fakeGitHub({files:{'note.md':note,'Other.md':'# Other'}});
 const ctx=await H.context(gh,{noCdn}),p=await H.page(ctx);await H.signIn(p);p.setDefaultTimeout(5000);
 await p.evaluate(()=>openFile('note.md'));
 const present=await p.locator('#btn-preview').count();t.check('preview toggle exists',present===1);
 if(!present){await ctx.close();continue;}
 const commits=gh.commits.length;
 await p.click('#btn-preview');
 if(noCdn){t.check('unavailable CDN explains fallback',/unavailable/i.test(await p.textContent('#preview')));}
 else {
 t.check('headings and table render',await p.locator('#preview h1').count()===1&&await p.locator('#preview td').count()===2);
 t.check('frontmatter shown as text', (await p.textContent('#preview .frontmatter')).includes('<img src=x'));
 t.check('tasks are read only',await p.locator('#preview input:disabled').count()===2);
 t.check('code stays literal',(await p.textContent('#preview pre code')).includes('<script>'));
 t.check('dangerous markup and images absent',await p.locator('#preview script,#preview iframe,#preview svg,#preview form,#preview img,#preview [onerror],#preview a[href^="javascript:"]').count()===0);
 t.check('payload never executes',await p.evaluate(()=>!window.pwned));
 }
 await p.click('#btn-preview');
 t.check('source preserved without writes',(await H.editorValue(p))===note&&gh.commits.length===commits);
 await H.setEditor(p,source+'\n## Draft heading');await p.click('#btn-preview');
 if(!noCdn)t.check('preview includes unsaved draft',await p.locator('#preview h2').textContent()==='Draft heading');
 t.check('draft remains recoverable',await p.evaluate(()=>dirty()&&!!readDraft(current.path)));
 if(!noCdn){await p.getByRole('link',{name:'Read other',exact:true}).click();await p.waitForFunction(()=>current?.path==='Other.md');t.check('wikilink follows existing resolver',await p.locator('#editor-pane').isVisible());}
 await ctx.close();
}
await H.stop();t.finish();
