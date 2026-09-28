import {readFileSync} from 'node:fs';
import * as H from './harness.mjs';
const t=H.suite('about');await H.start();
const c=await H.context(H.fakeGitHub()),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>configured());await p.click('#btn-settings');
const exists=await p.locator('#app-about').count();t.check('About is available in Settings',exists===1);
if(exists){
 await p.click('#app-about summary');
 const version=await p.textContent('#app-version'),changes=readFileSync(new URL('../CHANGELOG.md',import.meta.url),'utf8');
 t.check('version is 1.0.0 and agrees with changelog',version==='1.0.0'&&changes.includes('## '+version+' —'));
 t.check('source points to configured repository',await p.getAttribute('#about-source','href')==='https://github.com/forwardmotionnz/notes');
 t.check('bug report points to its issue template',await p.getAttribute('#about-bug','href')==='https://github.com/forwardmotionnz/notes/issues/new?template=bug_report.md');
 t.check('privacy and changelog are same-copy pages',await p.getAttribute('#about-privacy','href')==='PRIVACY.html'&&await p.getAttribute('#about-changelog','href')==='CHANGELOG.html');
 t.check('support is absent until configured',!await p.locator('#about-support').isVisible());
 t.check('external tabs cannot control this page',await p.locator('#app-about a').evaluateAll(a=>a.every(x=>x.target==='_blank'&&x.rel.includes('noopener'))));
 await c.close();
 for(const bad of [false,true]){
  const c=await H.context(H.fakeGitHub(),{deploy:{repository:bad?'javascript:alert(1)':'https://github.com/example/my-pad',support:bad?'data:text/html,bad':'https://example.org/support'}}),p=await H.page(c);
  await H.signIn(p);await p.waitForFunction(()=>configured());await p.click('#btn-settings');await p.click('#app-about summary');
  t.check(bad?'unsafe configured links omitted':'fork has its own source and support',bad
   ?!await p.locator('#about-source').isVisible()&&!await p.locator('#about-bug').isVisible()&&!await p.locator('#about-support').isVisible()
   :await p.getAttribute('#about-source','href')==='https://github.com/example/my-pad'&&await p.getAttribute('#about-support','href')==='https://example.org/support');
  await c.close();
 }
}else await c.close();
await H.stop();t.finish();
