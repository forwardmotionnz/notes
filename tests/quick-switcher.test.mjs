import * as H from './harness.mjs';
import {readFileSync} from 'node:fs';
const t=H.suite('quick-switcher');await H.start();
const gh=H.fakeGitHub({files:{'alpha.md':'one','folder/beta.md':'two','beta.md':'three','.hidden.md':'secret','photo.png':'binary','<img onerror=alert(1)>.md':'literal'}});
const ctx=await H.context(gh),p=await H.page(ctx);p.setDefaultTimeout(5000);await H.signIn(p);
await p.waitForFunction(()=>treeState==='ok'&&files.length&&!pinScanning);
const exists=await p.locator('#btn-switcher').count();t.check('quick switcher is offered',exists===1);
if(exists){
 await p.evaluate(()=>openFile('alpha.md'));await p.evaluate(()=>openFile('folder/beta.md'));
 let reads=0;await p.route('**/api.github.com/**',r=>{reads++;return r.fallback();});
 await p.keyboard.press('Control+k');await p.waitForSelector('#quick-switcher[open]');
 t.check('keyboard focuses search',await p.locator('#quick-query').evaluate(e=>e===document.activeElement));
 t.check('recent notes first',(await p.locator('#quick-results [role=option]').allTextContents()).slice(0,2).join('|')==='folder/beta.md|alpha.md');
 await p.fill('#quick-query','BETA');
 t.check('best name match first',(await p.locator('#quick-results [role=option]').allTextContents()).join('|')==='beta.md|folder/beta.md');
 await p.locator('#quick-query').dispatchEvent('keydown',{key:'Enter',isComposing:true});
 t.check('IME confirmation does not open a note',await p.locator('#quick-switcher').evaluate(e=>e.open));
 await p.press('#quick-query','ArrowDown');await p.press('#quick-query','Enter');await p.waitForFunction(()=>current?.path==='folder/beta.md');
 await p.click('#btn-switcher');await p.fill('#quick-query','<img');
 t.check('hostile name stays text',await p.locator('#quick-results img').count()===0&&/onerror/.test(await p.textContent('#quick-results')));
 await p.fill('#quick-query','not found');t.check('empty results explained',/No matching/.test(await p.textContent('#quick-status')));
 await p.press('#quick-query','Escape');await p.waitForFunction(()=>!document.querySelector('#quick-switcher').open);t.check('escape closes dialog',!await p.locator('#quick-switcher').evaluate(e=>e.open));
 const before=reads;await p.click('#btn-switcher');await p.fill('#quick-query','');
 t.check('hidden and binary excluded',!(await p.textContent('#quick-results')).match(/hidden|photo/));
 t.check('opening and filtering make no requests',reads===before);
 await p.fill('#quick-query','alpha');await p.press('#quick-query','Enter');await p.waitForFunction(()=>current?.path==='alpha.md');
 await H.setEditor(p,'words kept while switching');
 await p.click('#btn-switcher');await p.fill('#quick-query','folder/beta');await p.press('#quick-query','Enter');
 await p.waitForFunction(()=>current?.path==='folder/beta.md'&&!saving);
 t.check('switching preserves edited note',gh.files['alpha.md']==='words kept while switching');
 await p.reload();await p.waitForFunction(()=>current?.path==='folder/beta.md');await p.click('#btn-switcher');
 t.check('recents survive reload',(await p.locator('#quick-results [role=option]').first().textContent())==='folder/beta.md');
 const seq=await p.evaluate(()=>openSeq);
 await p.evaluate(()=>{pointAt('other','vault','main',[]);files=[];quickChoose();});
 t.check('old repository cannot be selected',!await p.locator('#quick-switcher').evaluate(e=>e.open)&&await p.evaluate(()=>openSeq)===seq);
 await ctx.close();
}else await ctx.close();
for(const plain of [false,true]){
 const c=await H.context(H.fakeGitHub({files:{'note.md':'Keep this whole line'}}),{noCdn:plain});
 if(!plain)await c.route('**/codemirror/5.65.16/**',r=>{const n=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:n.endsWith('.css')?'text/css':'application/javascript',headers:{'access-control-allow-origin':'*'},body:n.startsWith('codemirror.min.')?readFileSync(new URL('./fixtures/codemirror5/'+n,import.meta.url)):''});});
 const p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');await p.evaluate(()=>openFile('note.md'));
 t.check(plain?'fallback editor tested':'real CodeMirror tested',await p.locator(plain?'.fallback-editor':'.CodeMirror').count()===1);
 // On macOS CodeMirror's Ctrl-K normally kills the rest of the line.
 if(!plain)await p.evaluate(()=>editor.setOption('keyMap','macDefault'));
 for(const key of ['Control+k','Meta+k']){
  await p.evaluate(()=>{editor.focus();if(editor.setCursor)editor.setCursor({line:0,ch:5});else editor.getWrapperElement().setSelectionRange(5,5);});
  await p.keyboard.press(key);
  const actual=await p.evaluate(()=>({open:document.querySelector('#quick-switcher').open,text:editor.getValue()}));
  t.check(`${plain?'plain':'CodeMirror'} ${key} opens switcher without editing`,actual.open&&actual.text==='Keep this whole line',JSON.stringify(actual));
  await p.evaluate(()=>document.querySelector('#quick-switcher').close());
 }
 await c.close();
}
await H.stop();t.finish();
