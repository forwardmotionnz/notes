import * as H from './harness.mjs';
const t=H.suite('note-tabs');await H.start();
const LONG='Housing/Christchurch suburbs with bigger sections.md',LONG2='A second note with a very long name that never fits in a tab on any screen at all.md';
const gh=H.fakeGitHub({files:{...Object.fromEntries(Array.from({length:15},(_,i)=>['n'+i+'.md','note '+i])),[LONG]:'long',[LONG2]:'longer'}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);
const exists=await p.locator('#note-tabs').count();t.check('open notes strip exists',exists===1);
if(exists){
 await p.evaluate(()=>openFile('n0.md'));await p.evaluate(()=>openFile('n1.md'));await p.evaluate(()=>openFile('n0.md'));
 const paths=()=>p.evaluate(()=>tabPaths());t.check('opening an existing tab never duplicates it',JSON.stringify(await paths())===JSON.stringify(['n0.md','n1.md']));
 // Review of N38: a comment swallowed the tab's click handler; nothing clicked a tab by its name.
 await p.locator('#note-tabs span button',{hasText:'n1'}).first().click();await p.waitForFunction(()=>current?.path==='n1.md',null,{timeout:3000}).catch(()=>{});
 t.check('clicking a tab opens its note',await p.evaluate(()=>current?.path)==='n1.md');
 t.check('and marks that tab as open',await p.evaluate(()=>{const on=[...document.querySelectorAll('#note-tabs span.on button:first-child')];return on.length===1&&on[0].title==='n1.md'&&on[0].getAttribute('aria-pressed')==='true';}));
 await p.locator('#note-tabs span button',{hasText:'n0'}).first().click();await p.waitForFunction(()=>current?.path==='n0.md',null,{timeout:3000}).catch(()=>{});
 t.check('and back again',await p.evaluate(()=>current?.path)==='n0.md');
 await p.reload();await p.waitForFunction(()=>current?.path==='n0.md');t.check('tabs survive reload scoped to repository',JSON.stringify(await paths())===JSON.stringify(['n0.md','n1.md']));
 await p.evaluate(()=>{window.realRead=readNote;readNote=p=>p==='n1.md'?new Promise(resolve=>window.releaseTab=()=>realRead(p).then(resolve)):realRead(p);openFile('n1.md');});await p.waitForFunction(()=>!!window.releaseTab);
 await p.getByRole('button',{name:'Close n1.md',exact:true}).click();await p.evaluate(async()=>{await releaseTab();readNote=realRead;});
 t.check('closing a loading tab cancels its delayed activation',await p.evaluate(()=>current.path==='n0.md'&&!tabPaths().includes('n1.md')));
 await p.evaluate(()=>openFile('n1.md'));await p.evaluate(()=>openFile('n0.md'));
 await H.setEditor(p,'unsaved words');await p.evaluate(()=>{current.conflict=true;});await p.getByRole('button',{name:'Close n0.md',exact:true}).click();await p.waitForFunction(()=>current?.path==='n1.md');
 t.check('closing retains an unsaved draft',await p.evaluate(()=>readDraft('n0.md')?.text==='unsaved words'));
 t.check('closing active chooses neighbouring tab',JSON.stringify(await paths())===JSON.stringify(['n1.md']));
 await p.evaluate(()=>openFile('n0.md'));t.check('reopening restores unsaved words',await H.editorValue(p)==='unsaved words');
 await p.evaluate(()=>{window.originalDraftSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('notes.draft.'))throw Error('full');return originalDraftSet.call(this,k,v);};});await H.setEditor(p,'words without local storage');
 await p.getByRole('button',{name:'Close n0.md',exact:true}).click();t.check('storage failure keeps unsaved editor open',await H.editorValue(p)==='words without local storage'&&(await paths()).includes('n0.md'));
 await p.evaluate(()=>{Storage.prototype.setItem=originalDraftSet;syncDraft();});
 await p.getByRole('button',{name:'Close n1.md',exact:true}).click();t.check('closing background keeps current note',await p.evaluate(()=>current.path)==='n0.md');
 await p.getByRole('button',{name:'Close n0.md',exact:true}).click();t.check('closing last leaves no active editor',await p.evaluate(()=>current===null&&ui.last===null));
 await p.reload();await p.waitForFunction(()=>treeState==='ok');t.check('closed last note stays closed after reload',await p.evaluate(()=>current===null));
 for(let i=0;i<15;i++)await p.evaluate(i=>openFile('n'+i+'.md'),i);t.check('tab count is bounded',(await paths()).length===12);
 await p.evaluate(()=>followDelete('n3.md',true));t.check('background deletion is persisted',await p.evaluate(()=>!JSON.parse(localStorage.getItem(UI_KEY)).openNotes.paths.includes('n3.md')));
 await p.evaluate(()=>{followMove('n14.md','renamed.md');});t.check('rename updates open tab path',(await paths()).includes('renamed.md')&&!(await paths()).includes('n14.md'));
 await p.setViewportSize({width:390,height:820});await p.evaluate(()=>renderTabs());// N38 (approved design): on a phone the open notes are one scrolling row of chips, not a folded list.
 t.check('phone tabs are one scrolling row',!await p.locator('#note-tabs summary').isVisible()&&await p.locator('#note-tabs>div').evaluate(e=>getComputedStyle(e).flexDirection==='row'&&getComputedStyle(e).overflowX==='auto'));
 t.check('phone tabs can be reached',await p.locator('#note-tabs button').first().isVisible()&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 // Owner's report: a long name was cut off in its tab (at both ends on a computer), and on a phone its Close was pushed out of the tab under the next one.
 const tabs=()=>p.evaluate(()=>[...document.querySelectorAll('#note-tabs span')].map(s=>{const r=s.getBoundingClientRect(),x=s.lastChild.getBoundingClientRect(),b=s.firstChild;return{path:b.title,on:s.className==='on',closeInside:x.width>0&&x.left>=r.left&&x.right<=r.right+1,cut:b.scrollWidth>b.clientWidth,align:getComputedStyle(b).textAlign,ellipsis:getComputedStyle(b).display==='block'&&getComputedStyle(b).textOverflow,right:r.right,left:r.left};}));
 for(const width of [390,1280]){
  await p.setViewportSize({width,height:820});
  await p.evaluate(a=>openFile(a),LONG2);await p.evaluate(a=>openFile(a),LONG);let now=await tabs(),long=now.find(x=>x.path===LONG),long2=now.find(x=>x.path===LONG2);
  t.check(`${width}: every tab keeps its Close inside it`,now.length>2&&now.every(x=>x.closeInside));
  t.check(`${width}: the open note's tab shows its whole name`,!!long&&long.on&&!long.cut);
  t.check(`${width}: and is scrolled into view`,!!long&&long.left>=0&&long.right<=width);
  t.check(`${width}: a longer name still ends in an ellipsis, from its start`,!!long2&&long2.cut&&long2.ellipsis==='ellipsis'&&['left','start'].includes(long2.align));
  await p.evaluate(a=>openFile(a),LONG2);now=await tabs();long2=now.find(x=>x.path===LONG2);
  t.check(`${width}: the longest name fits the screen as the open tab, cut with an ellipsis`,!!long2&&long2.on&&long2.cut&&long2.closeInside&&long2.right-long2.left<=width-24&&await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await p.getByRole('button',{name:'Close '+LONG,exact:true}).click({timeout:3000}).catch(()=>{});
  t.check(`${width}: a long tab's Close can be pressed`,!(await paths()).includes(LONG));
  await p.getByRole('button',{name:'Close '+LONG2,exact:true}).click({timeout:3000}).catch(()=>{});
 }
 // Closing the open tab opens its neighbour; let that finish first, or under load it lands in the new repository's tabs (seen on the base commit too).
 await p.waitForFunction(()=>!openingPath);
 await p.evaluate(()=>{cfg.repo='another';renderTabs();});t.check('another repository cannot see previous tabs',(await paths()).length===0);
}
await c.close();await H.stop();t.finish();
