import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import * as H from './harness.mjs';
const axeSource=readFileSync(new URL('./fixtures/axe-4.11.3.min.js',import.meta.url),'utf8');
const t=H.suite('accessibility'),reports=[];
await H.start();
for(const width of [1280,390])for(const theme of ['light','dark']){
 const c=await H.context(H.fakeGitHub({files:{'todo.md':'# Tasks\n- [ ] Plan tomorrow\n','note.md':'# A note\n\nA paragraph and [a link](https://example.com).\n\n- [x] Done\n\n![Notes icon](image.png)','image.png':readFileSync(new URL('../icon-180.png',import.meta.url)).toString('latin1')},raw:{'image.png':true}}),{viewport:{width,height:844}});
 await c.route('**/codemirror/5.65.16/**',r=>{const n=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:n.endsWith('.css')?'text/css':'application/javascript',body:n.startsWith('codemirror.min.')?readFileSync(new URL('./fixtures/codemirror5/'+n,import.meta.url)):''});});
 const p=await H.page(c);p.setDefaultTimeout(5000);await p.emulateMedia({colorScheme:theme});
 async function scan(view){
  await H.still(p);await p.evaluate(axeSource);
  const result=await p.evaluate(async()=>{const r=await axe.run(document,{resultTypes:['violations','incomplete']});return {violations:r.violations,incomplete:r.incomplete};});
  reports.push({width,theme,view,...result});
  const serious=result.violations.filter(v=>['serious','critical'].includes(v.impact));
  t.check(`${width} ${theme} ${view}: zero serious/critical violations`,!serious.length,JSON.stringify(serious.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
 }
 await scan('sign-in');await H.signIn(p);await p.evaluate(()=>openFile('todo.md'));await scan('tasks');
 await p.evaluate(()=>openFile('note.md'));await scan('editor');
 await p.click('#btn-preview');await p.waitForFunction(()=>!document.querySelector('#preview [data-loading]'));await scan('preview');
 if(width===390)await p.click('#btn-tree');await p.fill('#filter','paragraph');await p.click('#btn-search');await p.waitForFunction(()=>!searchRunning);await scan('files/search');
 if(width===390)await p.click('#btn-tree');await p.click('#btn-settings');await scan('settings');
 // The audit itself must notice a broken accessible name; no rule exclusions.
 await p.evaluate(()=>{const b=document.createElement('button');b.id='axe-probe';document.querySelector('#settings').appendChild(b);});
 const probe=await p.evaluate(async()=> (await axe.run(document)).violations.some(v=>v.id==='button-name'&&v.nodes.some(n=>n.target.includes('#axe-probe'))));
 t.check(`${width} ${theme}: audit detects injected unnamed button`,probe);
 await c.close();
}
{
 const c=await H.context(H.fakeGitHub({files:{'note.md':'# Plain editor'}}),{noCdn:true}),p=await H.page(c);
 await H.signIn(p);await p.evaluate(()=>openFile('note.md'));await p.evaluate(axeSource);
 const r=await p.evaluate(()=>axe.run(document));reports.push({view:'plain editor',...r});
 const bad=r.violations.filter(v=>['serious','critical'].includes(v.impact));
 t.check('CDN fallback: zero serious/critical violations',!bad.length,JSON.stringify(bad.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))));
 await c.close();
}
mkdirSync('tests/screens',{recursive:true});writeFileSync(`tests/screens/accessibility-${H.engine()}.json`,JSON.stringify(reports,null,2));
await H.stop();t.finish();
