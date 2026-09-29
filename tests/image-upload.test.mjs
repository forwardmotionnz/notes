import * as H from './harness.mjs';import {readFileSync} from 'node:fs';
const t=H.suite('image-upload');await H.start();
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5WQAAAAASUVORK5CYII=';
for(const folder of [null,'attachments','./assets','/','photos) old']){
 const files={'notes/a.md':'before after'};if(folder!==null)files['.obsidian/app.json']=JSON.stringify({attachmentFolderPath:folder});
 const gh=H.fakeGitHub({files}),c=await H.context(gh,{noCdn:true}),p=await H.page(c);await H.signIn(p);await p.evaluate(()=>openFile('notes/a.md'));
 let uploaded=[];
 // GitHub creates binary files from base64; omitting sha must never overwrite.
 // https://docs.github.com/en/rest/repos/contents#create-or-update-file-contents
 await c.route('https://api.github.com/**/contents/**',async r=>{if(r.request().method()!=='PUT'||!r.request().url().includes('.png'))return r.fallback();const b=r.request().postDataJSON();uploaded.push({path:decodeURIComponent(new URL(r.request().url()).pathname).split('/contents/')[1],...b});await r.fulfill({status:201,contentType:'application/json',body:JSON.stringify({content:{sha:'image-sha'}})});});
 const supported=await p.evaluate(()=>typeof uploadImage==='function');t.check(`${folder}: paste/drop handler exists`,supported);
 if(supported){
  await p.evaluate(async({png})=>{editor.getWrapperElement().setSelectionRange(7,7);await uploadImage(new File([Uint8Array.from(atob(png),x=>x.charCodeAt(0))],'photo.png',{type:'image/png'}));},{png});
  const dest=folder==='/'?'':folder===null?'notes/':folder==='./assets'?'notes/assets/':folder+'/';
  t.check(`${folder}: respects attachment location`,uploaded.length===1&&uploaded[0].path.startsWith(dest)&&uploaded[0].path.endsWith('.png'));
  t.check(`${folder}: writes exact bytes without overwrite sha`,uploaded[0]?.content===png&&!uploaded[0]?.sha);
  t.check(`${folder}: inserts link at cursor and keeps draft`,await p.evaluate(()=>editor.getValue().startsWith('before ![')&&editor.getValue().endsWith('after')&&readDraft(current.path).text===editor.getValue()));
  if(folder==='photos) old')t.check('parentheses are escaped in Markdown destination',await p.evaluate(()=>editor.getValue().includes('photos%29%20old/')));
  const before=uploaded.length;await p.evaluate(async()=>{await uploadImage(new File(['<svg/>'],'x.svg',{type:'image/svg+xml'}));await uploadImage(new File(['x'.repeat(1048577)],'large.png',{type:'image/png'}));applyAccess('Read only');await uploadImage(new File(['x'],'x.png',{type:'image/png'}));});
  t.check(`${folder}: rejects invalid, oversized and readonly writes`,uploaded.length===before);
 }
 await c.close();
}
for(const plain of [false,true]){
 const gh=H.fakeGitHub({files:{'a.md':'alpha','b.md':'beta'}}),c=await H.context(gh,{noCdn:plain});
 if(!plain)await c.route('**/codemirror/5.65.16/**',r=>{const n=new URL(r.request().url()).pathname.split('/').pop();return r.fulfill({contentType:n.endsWith('.css')?'text/css':'application/javascript',headers:{'access-control-allow-origin':'*'},body:n.startsWith('codemirror.min.')?readFileSync(new URL('./fixtures/codemirror5/'+n,import.meta.url)):''});});
 const p=await H.page(c);p.setDefaultTimeout(5000);await H.signIn(p);await p.evaluate(()=>openFile('a.md'));
 let release,arrived,status=201;let pending=new Promise(r=>arrived=r),gate=new Promise(r=>release=r);
 await c.route('https://api.github.com/**/contents/*.png',async r=>{if(r.request().method()!=='PUT')return r.fallback();arrived();await gate;return r.fulfill({status,contentType:'application/json',body:JSON.stringify(status===201?{content:{sha:'image'}}:{message:'failure'})});});
 const paste=()=>p.evaluate(png=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(png),x=>x.charCodeAt(0))],'x.png',{type:'image/png'}));editor.getWrapperElement().dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));},png);
 await paste();await pending;await paste();t.check(`${plain}: busy upload is explained`,/still uploading/.test(await H.status(p)));await p.evaluate(()=>openFile('b.md'));release();await p.waitForFunction(()=>!imageUploading);
 const value=()=>p.evaluate(()=>editor.getValue());
 t.check(`${plain}: slow paste never inserts into a different note`,await value()==='beta'&&/Image saved as/.test(await H.status(p)));
 await p.evaluate(()=>openFile('a.md'));await p.evaluate(()=>{editor.focus();if(editor.caret)editor.getWrapperElement().setSelectionRange(2,2);else editor.setSelection(editor.posFromIndex(2),editor.posFromIndex(2));});
 await paste();await p.waitForFunction(()=>!imageUploading);t.check(`${plain}: actual paste inserts at cursor`,(await value()).startsWith('al![Image]('));
 await p.keyboard.press('Control+z');t.check(`${plain}: image insertion supports Undo`,await value()==='alpha');
 status=409;await paste();await p.waitForFunction(()=>!imageUploading);t.check(`${plain}: conflict adds no broken link`,await value()==='alpha');
 status=201;await p.evaluate(png=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(png),x=>x.charCodeAt(0))],'x.png',{type:'image/png'}));editor.getWrapperElement().dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},png);await p.waitForFunction(()=>!imageUploading);
 t.check(`${plain}: drop uploads and inserts`,(await value()).includes('![Image]('));
 if(plain){await p.evaluate(()=>{editor.setValue('first line\nsecond line\nthird line');editor.getWrapperElement().setSelectionRange(0,0);});
 const offset=await p.evaluate(()=>{const ta=editor.getWrapperElement(),r=ta.getBoundingClientRect(),s=getComputedStyle(ta);return imageDropOffset({clientX:r.left+parseFloat(s.paddingLeft)+35,clientY:r.top+parseFloat(s.paddingTop)+parseFloat(s.lineHeight)*1.5});});
 t.check('fallback drop locates text at the pointer rather than old caret',offset>=11&&offset<=22);
 }
 await c.close();
}
await H.stop();t.finish();
