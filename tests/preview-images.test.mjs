import {readFileSync} from 'node:fs';
import * as H from './harness.mjs';
const t=H.suite('preview-images');await H.start();
const png=readFileSync(new URL('../icon-180.png',import.meta.url)).toString('latin1');
const note='# Pictures\n\n![A local picture](../assets/picture%20one.png)\n\n![[picture one.png|An embedded picture]]\n\n![External](https://evil.test/track)\n\n![Missing](missing.png)\n\n![Vector](../assets/unsafe.svg)\n\n![Disguised](../assets/disguised.png)\n\n![Escape](../../outside.png)\n\n```md\n![Code only](../assets/code.png)\n```\n';
const files={'folder/note.md':note,'other.md':'# Elsewhere','assets/picture one.png':png,'assets/unsafe.svg':'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>','assets/disguised.png':'<svg onload="alert(1)"/>','assets/code.png':png};
const gh=H.fakeGitHub({files,raw:{'assets/picture one.png':true,'assets/code.png':true}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);p.setDefaultTimeout(5000);
const requests=[];p.on('request',r=>requests.push(r.url()));
await p.evaluate(()=>openFile('folder/note.md'));await p.click('#btn-preview');
const has=await p.waitForFunction(()=>document.querySelector('#preview img')?.naturalWidth>0,null,{timeout:3000}).then(()=>true,()=>false);
t.check('repository image is decoded and visible',has);
if(has){
 await p.waitForFunction(()=>!document.querySelector('#preview [data-loading]'));
 t.check('Markdown and Obsidian embeds both render',await p.locator('#preview img').count()===2);
 t.check('images have useful alternatives',await p.locator('#preview img').evaluateAll(xs=>xs.every(x=>x.alt.length>0)));
 t.check('only image data URLs are attached',await p.locator('#preview img').evaluateAll(xs=>xs.every(x=>x.src.startsWith('data:image/png;base64,'))));
 const body=await p.textContent('#preview');
 t.check('external, missing and unsupported images explain omission',body.includes('External: External images are not loaded')&&body.includes('Missing:')&&body.includes('Vector: Use a repository')&&body.includes('Disguised: Not a supported raster image')&&body.includes('Escape: Outside the repository'));
 t.check('duplicate image references share a request',requests.filter(x=>x.includes('/contents/assets/picture%20one.png')).length===1);
 t.check('source and repository remain unchanged',(await H.editorValue(p))===note&&gh.commits.length===0);
 t.check('code images and external hosts are not requested',!requests.some(x=>x.includes('assets/code.png')||x.includes('evil.test')));
 await p.click('#btn-preview');
 let release,entered;const gate=new Promise(r=>release=r),requested=new Promise(r=>entered=r);
 await p.route('**/contents/assets/picture%20one.png?*',async r=>{entered();await gate;await r.fallback();});
 await p.click('#btn-preview');let deadline;
 await Promise.race([requested,new Promise((_,r)=>{deadline=setTimeout(()=>r(Error('Image request not started')),5000);})]).finally(()=>clearTimeout(deadline));
 await p.evaluate(()=>openFile('other.md'));release();await H.settle(p,300);
 t.check('late image cannot appear in another note',await p.locator('#preview img').count()===0&&await p.locator('#editor-pane').isVisible());
}
await c.close();
{
 const many=Object.fromEntries(Array.from({length:21},(_,i)=>[`image${i}.png`,png]));
 many['many.md']=Object.keys(many).map(p=>`![${p}](${p})`).join('\n\n');
 const gh=H.fakeGitHub({files:many,raw:Object.fromEntries(Object.keys(many).map(p=>[p,p.endsWith('.png')]))}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);p.setDefaultTimeout(5000);await p.evaluate(()=>openFile('many.md'));
 let active=0,max=0,reads=0;
 await p.route('**/contents/image*.png?*',async r=>{reads++;active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,20));await r.fallback();active--;});
 await p.click('#btn-preview');await p.waitForFunction(()=>!document.querySelector('#preview [data-loading]'));
 t.check('image requests are bounded to 20 with four workers',reads===20&&max<=4);
 t.check('image limit is explained',/First 20 images only/.test(await p.textContent('#preview')));
 await c.close();
}
{
 const gh=H.fakeGitHub({files:{'note.md':'![Large](large.png)\n\n![Hidden](.private/p.png)\n\n![Symlink](link.png)','large.png':'x'.repeat(1048577),'link.png':png,'.private/p.png':png},raw:{'link.png':true,'.private/p.png':true}});gh.modes={'link.png':'120000'};
 const c=await H.context(gh),p=await H.page(c);await H.signIn(p);p.setDefaultTimeout(5000);await p.waitForFunction(()=>treeState==='ok'&&files.length);await p.evaluate(()=>openFile('note.md'));await p.click('#btn-preview');await p.waitForFunction(()=>!document.querySelector('#preview [data-loading]'));
 t.check('large files, hidden paths and symlinks are refused',await p.locator('#preview img').count()===0&&/1 MB/.test(await p.textContent('#preview'))&&/symlinks/.test(await p.textContent('#preview')));
 await p.click('#btn-preview');
 const oversized=Buffer.concat([Buffer.from(png,'latin1'),Buffer.alloc(1048577)]).toString('base64');
 await p.route('**/contents/large.png?*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({size:0,encoding:'base64',content:oversized})}));
 await p.click('#btn-preview');await p.waitForFunction(()=>!document.querySelector('#preview [data-loading]'));
 t.check('decoded byte limit does not trust reported size',await p.locator('#preview img').count()===0&&/Large: Image exceeds 1 MB/.test(await p.textContent('#preview')));
 await p.click('#btn-preview');
 await p.evaluate(()=>{readImage=async function(){cfg.token='';cfg.refresh='';throw signedOutError();};});await p.click('#btn-preview');await p.waitForFunction(()=>document.querySelector('#settings').open);
 t.check('image authentication failure offers sign-in',await H.dialogOpen(p)&&await p.locator('#preview [data-loading]').count()===0);
 await c.close();
}
{
 const gh=H.fakeGitHub({files:{'note.md':'![[100%.png]]','assets/100%.png':png},raw:{'assets/100%.png':true}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);p.setDefaultTimeout(5000);await p.evaluate(()=>openFile('note.md'));await p.click('#btn-preview');
 await p.waitForFunction(()=>!document.querySelector('#preview [data-loading]'));
 t.check('Obsidian embed uses a literal percent filename',await p.locator('#preview img').count()===1&&await p.locator('#preview img').evaluate(x=>x.naturalWidth>0));
 await c.close();
}
await H.stop();t.finish();
