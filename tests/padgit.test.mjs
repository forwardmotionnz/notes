import {readFileSync,existsSync} from 'node:fs';
import * as H from './harness.mjs';
const t=H.suite('padgit'),read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),html=read('index.html');
t.check('page and home-screen branding is Padgit',html.includes('<title>Padgit</title>')&&JSON.parse(read('manifest.webmanifest')).name==='Padgit');
// The move to padgit.com is done (owner, 2026-09-30): the pre-move notice is gone.
t.check('no address-change notice any more',!html.includes('domain-notice')&&!/migrationFrom|migrationTo/.test(html));
t.check('cutover config uses new origin and root callback',existsSync(new URL('../broker/wrangler.padgit.toml',import.meta.url))&&/ALLOWED_ORIGIN\s*=\s*"https:\/\/padgit.com"/.test(read('broker/wrangler.padgit.toml'))&&/REDIRECT_URI\s*=\s*"https:\/\/padgit.com\/"/.test(read('broker/wrangler.padgit.toml')));
t.check('current broker stays on old address until coordinated cutover',/ALLOWED_ORIGIN\s*=\s*"https:\/\/forwardmotionnz.github.io"/.test(read('broker/wrangler.toml'))&&!existsSync(new URL('../CNAME',import.meta.url)));
{
 await H.start();
 const newGh=H.fakeGitHub({files:{'a.md':'hello'}}),url='https://padgit.com/',c=await H.context(newGh,{appUrl:url});
 const served=await (await c.request.get(H.APP())).text();
 await c.route('https://padgit.com/**',r=>r.fulfill({contentType:'text/html',body:served}));
 const q=await H.page(c,url);q.setDefaultTimeout(5000);await q.click('#f-signin');await q.waitForFunction(()=>typeof configured==='function'&&configured()&&treeState==='ok');await q.evaluate(()=>openFile('a.md'));
 t.check('sign-in at custom domain returns to root',q.url().split('#')[0]===url&&newGh.log.authorize[0].redirect_uri===url);
 await H.setEditor(q,'saved at new address');await q.click('#btn-save');await q.waitForFunction(()=>!saving&&!dirty());
 t.check('custom domain saves normal repository files',newGh.files['a.md']==='saved at new address');
 t.check('storage keys retain existing names',await q.evaluate(()=>!!localStorage.getItem('notes.config.v2')&&!Object.keys(localStorage).some(k=>k.startsWith('padgit.'))));
 await c.close();await H.stop();
}
t.finish();
