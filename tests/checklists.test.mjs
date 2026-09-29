import * as H from './harness.mjs';
const t=H.suite('checklists');await H.start();
const original='# Shopping\n\n- [ ] fruit\n  - [ ] apples\n- [ ] bread\n\nParagraph stays.\n\n```md\n- [ ] example only\n```\n';
const gh=H.fakeGitHub({files:{'list.md':original}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');await p.evaluate(()=>openFile('list.md'));await p.click('#btn-preview');
const boxes=p.locator('#preview input[type=checkbox]:enabled');t.check('ordinary note has editable preview tasks',await boxes.count()===3);
if(await boxes.count()===3){
 await H.taskAction(p, 'Edit task: fruit');await p.getByRole('button',{name:'Cancel editing task',exact:true}).click();t.check('Cancel restores rendered task',await p.locator('.task-edit').count()===0);
 await H.taskAction(p, 'Edit task: fruit');await p.locator('.task-edit').press('Escape');t.check('Escape restores rendered task',await p.locator('.task-edit').count()===0);
 await boxes.first().check();await p.waitForFunction(()=>!Object.keys(pinBusy).length);t.check('tick changes only marker',gh.files['list.md']===original.replace('[ ] fruit','[x] fruit'));
 await H.taskAction(p, 'Edit task: fruit');await p.locator('.task-edit').fill('fresh fruit');await p.locator('.task-edit').press('Enter');await p.waitForFunction(()=>!Object.keys(pinBusy).length);t.check('inline text edits plain source',gh.files['list.md'].includes('- [x] fresh fruit\n  - [ ] apples'));
 await H.taskAction(p, 'Move down: fresh fruit');await p.waitForFunction(()=>!Object.keys(pinBusy).length);t.check('moving parent carries nested child',gh.files['list.md'].includes('- [ ] bread\n- [x] fresh fruit\n  - [ ] apples'));
 await H.taskAction(p, 'Remove task: fresh fruit');await p.waitForFunction(()=>!Object.keys(pinBusy).length);t.check('remove includes nested task',!gh.files['list.md'].includes('apples'));
 await p.click('#pin-undo button');await p.waitForFunction(()=>!Object.keys(pinBusy).length);t.check('undo restores complete subtree',gh.files['list.md'].includes('- [x] fresh fruit\n  - [ ] apples'));
 // N37: no "Add a task" box; new tasks are typed in Edit, like any other line.
 t.check('Preview offers no Add a task box',await p.getByPlaceholder('Add a task').count()===0&&await p.locator('#preview').getByRole('button',{name:/^Add/}).count()===0);
 t.check('prose after the list untouched',gh.files['list.md'].includes('  - [ ] apples\n\nParagraph stays.'));
 t.check('code example untouched',gh.files['list.md'].includes('```md\n- [ ] example only\n```'));
 await p.evaluate(()=>applyAccess('Read-only repository'));t.check('read only locks all mutations',await p.locator('#preview input[type=checkbox]:enabled').count()===0);
}
await c.close();
for(const [label,body] of [
 ['ambiguous','    - [ ] code example\n\n> - [ ] quoted task\n'],
 ['loose','- [ ] parent\n\n  paragraph\n  - [ ] child\n- [ ] second\n'],
 ['format','- [ ] **bold** [link](https://example.com)\n\n  continuation\n'],
 ['ordered','1. [ ] first\n2. [ ] second\n']]){
 const gh=H.fakeGitHub({files:{'probe.md':body}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');await p.evaluate(()=>openFile('probe.md'));await p.click('#btn-preview');
 if(label==='ambiguous')t.check('ambiguous code and quoted task cannot mutate source',await p.locator('#preview input[type=checkbox]:enabled').count()===0&&gh.commits.length===0);
 if(label==='loose'){
  await H.taskAction(p, 'Move down: parent');await p.waitForFunction(()=>!Object.keys(pinBusy).length);
  t.check('loose parent keeps paragraphs and nested tasks',gh.files['probe.md']==='- [ ] second\n- [ ] parent\n\n  paragraph\n  - [ ] child\n');
 }
 if(label==='format')t.check('task formatting links and continuation remain visible',await p.locator('#preview strong').textContent()==='bold'&&await p.locator('#preview a[href="https://example.com"]').count()===1&&(await p.textContent('#preview')).includes('continuation'));
 if(label==='ordered'){
  await H.taskAction(p, 'Move down: first');await p.waitForFunction(()=>!Object.keys(pinBusy).length);
  t.check('ordered move preserves numbering',gh.files['probe.md']==='1. [ ] second\n2. [ ] first\n');
  await H.tick(p,'first');await p.waitForFunction(()=>!Object.keys(pinBusy).length);
  t.check('ordered tick keeps numbering',gh.files['probe.md']==='1. [ ] second\n2. [x] first\n');
 }
 await c.close();
}
{
 const gh=H.fakeGitHub({files:{'probe.md':'- [ ] original\n'}}),c=await H.context(gh),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');await p.evaluate(()=>openFile('probe.md'));await p.click('#btn-preview');
 gh.files['probe.md']='- [ ] remote\n';
 await p.locator('#preview input[type=checkbox]').first().check();await p.waitForFunction(()=>!Object.keys(pinBusy).length&&!Object.keys(pinReloading).length);
 t.check('conflict reloads confirmed remote checklist',await p.locator('[aria-label="Edit task: remote"]').count()===1);
 await p.locator('#preview input[type=checkbox]').first().check();await p.waitForFunction(()=>!Object.keys(pinBusy).length);t.check('retry uses fresh version',gh.files['probe.md']==='- [x] remote\n');
 await p.route('**/contents/probe.md',r=>r.request().method()==='PUT'?r.abort():r.fallback());
 await H.taskAction(p, 'Edit task: remote');await p.locator('.task-edit').fill('words never lost');await p.locator('.task-edit').press('Enter');await p.waitForFunction(()=>!Object.keys(pinBusy).length&&!Object.keys(pinReloading).length);
 t.check('failed task text persists as draft',await p.evaluate(()=>readDraft('probe.md')?.text.includes('words never lost')));
 await p.reload();await p.waitForFunction(()=>current?.path==='probe.md');t.check('failed edit survives reload',(await H.editorValue(p)).includes('words never lost'));await c.close();
}
await H.stop();t.finish();
