import * as H from './harness.mjs';import {readFileSync} from 'node:fs';import vm from 'node:vm';
const parser={};vm.runInNewContext(readFileSync(new URL('./fixtures/marked-18.0.14.min.js',import.meta.url),'utf8'),parser);
const t=H.suite('formatting');await H.start();
for(const plain of [false,true]){
 const gh=H.fakeGitHub({files:{'a.md':'alpha\nbeta\n'}}),c=await H.context(gh,{noCdn:plain,viewport:{width:390,height:820}});
 if(!plain)await c.route('**/codemirror/5.65.16/**',r=>{const n=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:n.endsWith('.css')?'text/css':'application/javascript',headers:{'access-control-allow-origin':'*'},body:n.startsWith('codemirror.min.')?readFileSync(new URL('./fixtures/codemirror5/'+n,import.meta.url)):''});});
 const p=await H.page(c);p.setDefaultTimeout(5000);await H.signIn(p);await p.waitForFunction(()=>treeState==='ok');await p.evaluate(()=>openFile('a.md'));
 const exists=await p.locator('#format-toolbar').count();t.check(`${plain?'plain':'CM'} toolbar exists`,exists===1);
 if(exists){
  const set=async(text,a,b)=>p.evaluate(({text,a,b})=>{editor.setValue(text);current.saved=text;current.touched=false;clearTimeout(autosaveTimer);AUTOSAVE_MS=60000;editor.focus();if(editor.caret)editor.getWrapperElement().setSelectionRange(a,b);else editor.setSelection(editor.posFromIndex(a),editor.posFromIndex(b));},{text,a,b});
  const value=()=>p.evaluate(()=>editor.getValue());
  await set('alpha',0,5);await p.getByRole('button',{name:'Bold',exact:true}).click();t.check(`${plain}: bold selection`,await value()==='**alpha**');
  await p.keyboard.press('Control+z');t.check(`${plain}: undo restores source`,await value()==='alpha');
  await set('**alpha**',2,7);await p.keyboard.press('Control+b');t.check(`${plain}: bold toggles off surrounding markers`,await value()==='alpha');
  await set('alpha',0,5);await p.keyboard.press('Control+i');t.check(`${plain}: italic shortcut`,await value()==='*alpha*');
  for(const [name,expected] of [['Heading','# alpha\n# beta'],['Bulleted list','- alpha\n- beta'],['Numbered list','1. alpha\n2. beta'],['Checklist','- [ ] alpha\n- [ ] beta'],['Quote','> alpha\n> beta']]){
   await set('alpha\nbeta',0,10);await p.getByRole('button',{name,exact:true}).click();t.check(`${plain}: ${name} transforms selected lines`,await value()===expected);
  }
  await set('\nalpha',0,0);await p.getByRole('button',{name:'Heading',exact:true}).click();t.check(`${plain}: format initial blank line preserves following text`,await value()==='# \nalpha');
  await set('alpha',0,5);await p.keyboard.press('Control+Shift+k');t.check(`${plain}: link shortcut keeps switcher closed`,await value()==='[alpha](https://)'&&!await p.locator('#quick-switcher').evaluate(e=>e.open));
  await set('a`b',0,3);await p.getByRole('button',{name:'Code',exact:true}).click();t.check(`${plain}: code handles backticks`,await value()==='``a`b``');
  await set('`alpha`',0,7);await p.getByRole('button',{name:'Code',exact:true}).click();t.check(`${plain}: selected code toggles off`,await value()==='alpha');
  await set('before alpha\nbeta after',7,17);await p.getByRole('button',{name:'Code',exact:true}).click();t.check(`${plain}: multiline code fences whole lines`,await value()==='```\nbefore alpha\nbeta after\n```');
  await set('# alpha\nbeta',0,12);await p.getByRole('button',{name:'Heading',exact:true}).click();t.check(`${plain}: mixed headings do not double prefixes`,await value()==='# alpha\n# beta');
  for(const text of ['`a','a`',' a ']){
   await set(text,0,text.length);await p.getByRole('button',{name:'Code',exact:true}).click();t.check(`${plain}: code preserves rendered boundary ${JSON.stringify(text)}`,parser.marked.parse(await value()).includes('<code>'+text+'</code>'));
  }
  await set(' alpha ',0,7);await p.getByRole('button',{name:'Bold',exact:true}).click();t.check(`${plain}: boundary spaces stay outside emphasis`,await value()===' **alpha** '&&parser.marked.parse(await value()).includes('<strong>alpha</strong>'));
  await set('a[b',0,3);await p.getByRole('button',{name:'Link',exact:true}).click();t.check(`${plain}: brackets remain in rendered link label`,parser.marked.parse(await value()).includes('>a[b</a>'));
  await set('alpha',2,2);await p.getByRole('button',{name:'Bold',exact:true}).click();t.check(`${plain}: empty selection gets editable placeholder`,await value()==='al**text**pha');
  t.check(`${plain}: formatting immediately keeps draft`,await p.evaluate(()=>readDraft('a.md')?.text===editor.getValue()));
  await p.click('#btn-settings');await p.locator('#f-text-size').press('Control+b');t.check(`${plain}: settings shortcut cannot change note`,await value()==='al**text**pha');await p.keyboard.press('Escape');
  await p.evaluate(()=>applyAccess('Read only'));t.check(`${plain}: readonly toolbar disabled`,await p.locator('#format-toolbar button:enabled').count()===0);
  t.check(`${plain}: phone has no page overflow`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }await c.close();
}await H.stop();t.finish();
