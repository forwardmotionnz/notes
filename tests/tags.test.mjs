import * as H from './harness.mjs';import {readFileSync} from 'node:fs';
const t=H.suite('tags');await H.start();
for(const plain of [false,true]){
 const gh=H.fakeGitHub({files:{'a.md':'---\ntitle: Keep me\ntags:\n  - Work\n  - "project/notes"\npinned: false\n---\n# Alpha\n\nBody #daily #Work\n','b.md':'# Beta\n#work #project/other\n','.hidden.md':'#secret','binary.png':'#secret'}}),c=await H.context(gh,{noCdn:plain,viewport:{width:390,height:820}});
 if(!plain)await c.route('**/codemirror/5.65.16/**',r=>{const n=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:n.endsWith('.css')?'text/css':'application/javascript',headers:{'access-control-allow-origin':'*'},body:n.startsWith('codemirror.min.')?readFileSync(new URL('./fixtures/codemirror5/'+n,import.meta.url)):''});});
 const p=await H.page(c);p.setDefaultTimeout(5000);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok'&&!pinScanning);await p.evaluate(()=>openFile('a.md'));await p.evaluate(()=>{AUTOSAVE_MS=60000;});
 t.check(`${plain}: chips include property and inline tags`,/Work ×/.test(await p.textContent('#tag-chips'))&&/daily/.test(await p.textContent('#tag-chips')));
 await H.noteAction(p,'#btn-tags');t.check(`${plain}: Tags in the note menu opens the tag bar`,await p.locator('#tag-input').isVisible());const before=await p.evaluate(()=>editor.getValue());await p.locator('#tag-input').fill('new/tag');await p.locator('#tag-add button').click();const after=await p.evaluate(()=>editor.getValue());
 t.check(`${plain}: adding tag preserves other properties and body`,after.includes('title: Keep me\n')&&after.includes('pinned: false\n')&&after.endsWith('# Alpha\n\nBody #daily #Work\n')&&after.includes('"new/tag"'));
 t.check(`${plain}: editing tags keeps a draft`,await p.evaluate(()=>readDraft('a.md')?.text===editor.getValue()));await p.keyboard.press('Control+z');t.check(`${plain}: Undo restores original note`,await p.evaluate(()=>editor.getValue())===before);
 await p.getByRole('button',{name:'Remove frontmatter tag Work',exact:true}).click();t.check(`${plain}: removal edits only properties, inline tag remains`,(await p.evaluate(()=>editor.getValue())).endsWith('Body #daily #Work\n')&&!/tags:.*Work/.test(await p.evaluate(()=>editor.getValue())));
 await p.evaluate(()=>{document.querySelector('#tags-panel').open=true;document.body.classList.add('tree-open');});await p.waitForFunction(()=>document.querySelector('#tags-status').textContent.includes('loaded Markdown'));
 const counts=await p.textContent('#tag-counts');t.check(`${plain}: counts deduplicate case and include nested parents`,counts.includes('#work (2)')&&counts.includes('#project (2)')&&!counts.includes('secret'));
 await p.locator('#tag-counts button').filter({hasText:'#project (2)'}).click();t.check(`${plain}: selecting a tag lists matching paths`,(await p.locator('#tag-notes button').allTextContents()).sort().join(',')==='a.md,b.md');
 await p.locator('#tag-notes button').filter({hasText:'b.md'}).click();await p.waitForFunction(()=>current?.path==='b.md');t.check(`${plain}: tag result opens note and closes phone drawer`,!await p.evaluate(()=>document.body.classList.contains('tree-open')));
 await p.evaluate(()=>applyAccess('Read only'));const locked=await p.evaluate(()=>editor.getValue());await p.evaluate(()=>editTag('blocked',false));t.check(`${plain}: read-only tags cannot modify source`,await p.evaluate(()=>editor.getValue())===locked&&await p.locator('#tag-input').isDisabled());await p.evaluate(()=>applyAccess(''));
 const parse=await p.evaluate(()=>noteTags('---\ntags: ["one", two, "#three"]\n---\n# Heading\n#1984 #valid #café #📚 #group/sub\n`#code` [x](https://a/#link) [[#wiki]] https://x/#url\n<!-- #html --> %% #comment %%\n```md\n#fenced\n```\n    #indented\n').tags);
 t.check(`${plain}: Obsidian tags exclude headings, code, links and comments`,JSON.stringify(parse)===JSON.stringify(['one','two','three','valid','café','📚','group/sub']));
 for(const source of ['---\ntags: [a]\ntags: [b]\n---\nBody','---\ntags: &alias [a]\n---\nBody','---\n"tags": [a]\n---\nBody','---\ntags:\n - a # keep comment\n---\nBody','---\ntags: [a]\nBody','---\ntags : [a]\n---\nBody','---\ntags: a\n  continuation\n---\nBody','---\n  title: Keep\n  tags: [existing]\n---\nBody','---\n? tags\n: [existing]\n---\nBody','---\ntags: old\n\n  continuation\n---\nBody']){
  t.check(`${plain}: ambiguous frontmatter refused ${source.slice(4,24)}`,await p.evaluate(s=>withTag(s,'new',false)===null,source));
 }
 t.check(`${plain}: blank-separated list items all survive`,await p.evaluate(()=>withTag('---\ntags:\n - one\n\n - two\n---\nBody','three',false).includes('["one", "two", "three"]')));
 t.check(`${plain}: prototype-looking tag and path are harmless`,await p.evaluate(()=>{tagIndex=pathMap();tagIndex['__proto__.md']=['__proto__'];renderTags();return document.querySelector('#tag-counts').textContent.includes('#__proto__ (1)');}));
 t.check(`${plain}: phone does not overflow horizontally`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.evaluate(()=>showPointed(pointAt('another','vault','main',[])));t.check(`${plain}: repository switch clears tags`,await p.textContent('#tag-counts')===''&&await p.locator('#note-tags').isHidden());await c.close();
}
{
 const raw='\ufeff---\r\ntitle: Keep\r\ntags: [old]\r\n---\r\nOriginal body\r\n',gh=H.fakeGitHub({files:{'a.md':raw}}),c=await H.context(gh,{noCdn:true}),p=await H.page(c);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok'&&!pinScanning);await p.evaluate(()=>openFile('a.md'));await H.setEditor(p,(await p.evaluate(()=>editor.getValue()))+'Unsaved words\n');await p.evaluate(()=>editTag('new',false));await p.waitForFunction(()=>!accessPending);await p.evaluate(()=>saveCurrent());await p.waitForFunction(()=>!saving&&!dirty());
 t.check('save keeps BOM, original line endings, other properties and unsaved body',gh.files['a.md'].startsWith('\ufeff---\r\ntitle: Keep\r\n')&&gh.files['a.md'].includes('tags: ["old", "new"]\r\n')&&gh.files['a.md'].endsWith('Original body\r\nUnsaved words\r\n'),JSON.stringify(gh.files['a.md']));
 await p.evaluate(()=>{document.querySelector('#tags-panel').open=true;});await p.waitForFunction(()=>document.querySelector('#tags-status').textContent.includes('loaded Markdown'));
 await p.evaluate(()=>followMove('a.md','renamed.md'));t.check('tag index follows rename',await p.evaluate(()=>!!tagIndex['renamed.md']&&!tagIndex['a.md']));await p.evaluate(()=>{current=null;followDelete('renamed.md',false);});t.check('tag index forgets deleted note',await p.evaluate(()=>!tagIndex['renamed.md']));await c.close();
}
{
 const gh=H.fakeGitHub({files:Object.fromEntries(Array.from({length:305},(_,i)=>['n'+i+'.md','#tag'+i]))}),c=await H.context(gh),p=await H.page(c);p.setDefaultTimeout(10000);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok'&&!pinScanning);await p.evaluate(()=>resetNoteReads());
 let count=0;await c.route('**/contents/n*.md?*',r=>{count++;return r.fallback();});await p.evaluate(()=>{document.querySelector('#tags-panel').open=true;});await p.waitForFunction(()=>document.querySelector('#tags-status').textContent.includes('Incomplete'));
 t.check('large tag scan is bounded and labelled incomplete',count===300&&/5 notes beyond limit/.test(await p.textContent('#tags-status')));await c.unroute('**/contents/n*.md?*');
 await p.evaluate(()=>resetNoteReads());let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);await c.route('**/contents/n0.md?*',async r=>{entered();await gate;return r.fallback();});await p.evaluate(()=>{window.tagRun=loadTags();});await started;
 await p.evaluate(()=>showPointed(pointAt('another','vault','main',[])));release();await p.evaluate(()=>tagRun);t.check('late tag reads cannot populate a different repository',await p.textContent('#tag-counts')==='');await c.close();
}
await H.stop();t.finish();
