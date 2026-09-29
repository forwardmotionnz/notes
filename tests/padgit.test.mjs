import {readFileSync,existsSync} from 'node:fs';
import * as H from './harness.mjs';
const t=H.suite('padgit'),read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('index.html');
t.check('page and home-screen branding is Padgit',html.includes('<title>Padgit</title>')&&JSON.parse(read('manifest.webmanifest')).name==='Padgit');
t.check('pre-move notice is implemented',html.includes('id="domain-notice"'));
t.check('cutover config uses new origin and root callback',existsSync(new URL('../broker/wrangler.padgit.toml',import.meta.url))&&/ALLOWED_ORIGIN\s*=\s*"https:\/\/padgit.com"/.test(read('broker/wrangler.padgit.toml'))&&/REDIRECT_URI\s*=\s*"https:\/\/padgit.com\/"/.test(read('broker/wrangler.padgit.toml')));
t.check('current broker stays on old address until coordinated cutover',/ALLOWED_ORIGIN\s*=\s*"https:\/\/forwardmotionnz.github.io"/.test(read('broker/wrangler.toml'))&&!existsSync(new URL('../CNAME',import.meta.url)));
if(html.includes('id="domain-notice"')){
 await H.start();
 const gh=H.fakeGitHub({files:{'a.md':'hello'}}),ctx=await H.context(gh,{deploy:{migrationFrom:H.APP(),migrationTo:'https://padgit.com/'}}),p=await H.page(ctx);
 await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');await p.evaluate(()=>openFile('a.md'));await H.setEditor(p,'private draft');
 t.check('old address warns to save drafts before moving',await p.locator('#domain-notice').isVisible()&&/drafts.*do not move/.test(await p.textContent('#domain-notice')));
 t.check('notice does not redirect or drop drafts',p.url()===H.APP()&&await p.evaluate(()=>readDraft('a.md').text==='private draft'));
 await p.click('#domain-notice summary');await p.setViewportSize({width:320,height:260});
 t.check('expanded notice leaves room for the phone editor with keyboard',await p.locator('main').evaluate(e=>e.getBoundingClientRect().height)>50);
 await ctx.close();
 const newGh=H.fakeGitHub({files:{'a.md':'hello'}}),url='https://padgit.com/',c=await H.context(newGh,{appUrl:url});
 const served=await (await c.request.get(H.APP())).text();
 await c.route('https://padgit.com/**',r=>r.fulfill({contentType:'text/html',body:served}));
 const q=await H.page(c,url);q.setDefaultTimeout(5000);await q.click('#f-signin');await q.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok');await q.evaluate(()=>openFile('a.md'));
 t.check('sign-in at custom domain returns to root',q.url()===url&&newGh.log.authorize[0].redirect_uri===url);
 t.check('new address does not show old-address warning',!await q.locator('#domain-notice').isVisible());
 await H.setEditor(q,'saved at new address');await q.click('#btn-save');await q.waitForFunction(()=>!saving&&!dirty());
 t.check('custom domain saves normal repository files',newGh.files['a.md']==='saved at new address');
 t.check('storage keys retain existing names',await q.evaluate(()=>!!localStorage.getItem('notes.config.v2')&&!Object.keys(localStorage).some(k=>k.startsWith('padgit.'))));
 await c.close();await H.stop();
}
t.finish();
