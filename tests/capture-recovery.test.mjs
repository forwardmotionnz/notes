/* Failed serial task writes keep every capture, including newer typing. */
import * as H from './harness.mjs';
const t=H.suite('capture-recovery');await H.start();
for (const status of [0,503,429]) {
  const gh=H.fakeGitHub();const ctx=await H.context(gh);const p=await H.page(ctx);await H.signIn(p);await H.settle(p,500);
  let release,seen;const sent=new Promise(r=>seen=r);const gate=new Promise(r=>release=r);let fail=true;
  await ctx.route('https://api.github.com/**/contents/todo.md',async r=>{
    if(r.request().method()!=='PUT'||!fail)return r.fallback();
    seen();await gate;
    // Keep the rate limit active through failure recovery; reset explicitly below.
    return status?r.fulfill({status,headers:status===429?{'Retry-After':'60'}:{},body:'{}'}):r.abort();
  });
  for(const text of ['ALPHA','BETA','GAMMA']) {
    await p.fill('#pin-input',text);await p.click('#pin-go');if(text==='ALPHA')await sent;
  }
  await p.fill('#pin-input','NEW TYPING');release();await p.evaluate(()=>pinWriting);
  const recovered=await p.inputValue('#pin-input');
  t.check(`${status}: all submissions and newer typing survive`,['ALPHA','BETA','GAMMA','NEW TYPING'].every(x=>recovered.split('\n').includes(x)),JSON.stringify(recovered));
  fail=false;await p.evaluate(()=>apiRetryAt=0);await p.click('#btn-refresh');
  await p.waitForFunction(()=>!!pinCache['todo.md']);
  await p.click('#pin-go');await p.evaluate(()=>pinWriting);
  t.check(`${status}: retry saves each recovered line as its own task`,['ALPHA','BETA','GAMMA','NEW TYPING'].every(x=>gh.files['todo.md'].includes('- [ ] '+x+'\n')),gh.files['todo.md']);
  await ctx.close();
}
await H.stop();t.finish();
