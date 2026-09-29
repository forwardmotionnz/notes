import * as H from './harness.mjs';
const t=H.suite('reading');await H.start();
for(const width of [1280,390]){
 const c=await H.context(H.fakeGitHub({files:{'a.md':'# A\n\n'+'Readable words '.repeat(100)}}),{viewport:{width,height:820},noCdn:true}),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');await p.evaluate(()=>openFile('a.md'));await p.click('#btn-settings');
 const exists=await p.locator('#f-text-size').count();t.check(`${width}: text size setting exists`,exists===1);
 if(exists){
  await p.selectOption('#f-text-size','larger');await p.keyboard.press('Escape');
  t.check(`${width}: larger editor text`,await p.locator('.fallback-editor').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))===20);
  const r=await p.locator('.fallback-editor').boundingBox();t.check(`${width}: bounded reading width`,r.width<=800&&r.width<=width);
  await p.reload();await p.waitForFunction(()=>!!current);t.check(`${width}: size persists`,await p.locator('.fallback-editor').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))===20);
  await p.evaluate(()=>previewView(true));t.check(`${width}: preview uses size`,await p.locator('#preview').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))===20);
  t.check(`${width}: no horizontal page overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }await c.close();
}await H.stop();t.finish();
