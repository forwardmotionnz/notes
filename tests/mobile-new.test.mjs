/* The first note must be reachable after creating it from the phone drawer. */
import * as H from './harness.mjs';
const t=H.suite('mobile-new');
await H.start();
for (const noCdn of [false,true]) {
  const ctx=await H.context(H.fakeGitHub({empty:true,files:{}}),{noCdn,viewport:{width:390,height:844}});
  const p=await H.page(ctx); await H.signIn(p); await p.click('#btn-tree');
  p.removeAllListeners('dialog'); p.on('dialog',d=>d.accept('Hello.md'));
  await H.newNote(p, 'Hello.md'); await p.waitForFunction(()=>current?.path==='Hello.md'); await H.still(p);
  const label=noCdn?'plain editor':'editor';
  t.check(`${label}: New closes the file drawer`,await p.evaluate(()=>!document.body.classList.contains('tree-open')));
  t.check(`${label}: the note can be reached without a scrim`,await p.evaluate(()=>{
    const host=editor.getWrapperElement(),r=host.getBoundingClientRect();
    const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
    return hit===host||host.contains(hit);
  }));
  await p.keyboard.type('My first words');
  t.check(`${label}: typing reaches the new note`,(await H.editorValue(p)).includes('My first words'));
  await ctx.close();
}
await H.stop();t.finish();
