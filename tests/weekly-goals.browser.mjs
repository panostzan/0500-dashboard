// Dependency-free smoke test using installed Chrome and Node's WebSocket/CDP.
// Uses a fresh temporary profile and blocks external traffic; no personal data.
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/[\\/]$/, '');
const profile = await mkdtemp(path.join(os.tmpdir(), 'panos365-smoke-'));
const server = http.createServer(async (req, res) => {
    try {
        const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
        const filename = path.resolve(root, '.' + pathname, pathname.endsWith('/') ? 'index.html' : '');
        if (!filename.startsWith(root)) { res.writeHead(403).end(); return; }
        const data = pathname === '/weekly-test.html' ? `<html><head><meta charset="utf-8"><link rel=stylesheet href=/css/styles.css></head><body><div class="dashboard booted"><div class=goals-section style="width:260px" id=goals-section></div></div><script>function isSignedIn(){return false;}</script><script src=/js/data.js></script><script src=/js/weekly-goals.js></script><script src=/js/goals.js></script><script>initGoals();</script></body></html>` : await readFile(filename);
        const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
        res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
let ws;
try {
    const debuggerUrl = await new Promise((resolve, reject) => {
        let stderr = '';
        const timer = setTimeout(() => reject(new Error('Chrome startup timed out')), 15000);
        chrome.on('error', error => { clearTimeout(timer); reject(error); });
        chrome.stderr.on('data', data => {
            stderr += data;
            const match = stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);
            if (match) { clearTimeout(timer); resolve(match[1]); }
        });
        chrome.on('exit', code => { clearTimeout(timer); reject(new Error(`Chrome exited ${code}: ${stderr.slice(-1000)}`)); });
    });
    ws = new WebSocket(debuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let sequence = 0, sessionId;
    const pending = new Map(), errors = [];
    ws.onmessage = event => {
        const msg = JSON.parse(event.data);
        if (msg.id) { const callback = pending.get(msg.id); pending.delete(msg.id); callback?.(msg); }
        if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text + ': ' + msg.params.exceptionDetails.exception?.description);
    };
    function send(method, params = {}) {
        return new Promise((resolve, reject) => {
            const id = ++sequence;
            const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 10000);
            pending.set(id, msg => { clearTimeout(timer); msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result); });
            ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
        });
    }
    const target = await send('Target.createTarget', { url: 'about:blank' });
    sessionId = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setBlockedURLs', { urls: ['https://*'] });
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
    async function evaluate(expression) {
        const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
    }
    async function until(expression) {
        for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 50)); }
        throw new Error(`Condition timed out: ${expression}`);
    }


    await send('Page.navigate', {url:origin+'/weekly-test.html'});
    await until("document.querySelectorAll('.goal-group').length===5");
    const group='[data-section="weekly"]';
    async function run(body) { return evaluate('(async()=>{'+body+'})()'); }
    async function add(name,target,unit) {
        await run(`document.querySelector('${group} .weekly-add').click(); const f=document.querySelector('.weekly-form'); f.elements.name.value=${JSON.stringify(name)}; f.elements.target.value='${target}'; f.elements.unit.value='${unit}'; f.elements.unit.dispatchEvent(new Event('input')); f.requestSubmit();`);
        await until("!document.querySelector('.weekly-form')");
    }
    await add('Send DMs',5,'DMs');
    assert.equal(await evaluate(`document.querySelector('${group} .goal-header .goal-frac').textContent`),'0/1');
    await run(`document.querySelector('${group} .weekly-plus').click()`);
    await until("goalsCache.weekly[0].progress.value===1 && !document.querySelector('[data-saving]')");
    assert.equal(await evaluate(`document.querySelector('${group} [role=progressbar]').getAttribute('aria-valuenow')`),'1');
    await run(`const v=document.querySelector('${group} .weekly-value'); v.value='5'; v.dispatchEvent(new Event('change'));`);
    await until("goalsCache.weekly[0].checked && !document.querySelector('[data-saving]')");
    assert.equal(await evaluate(`document.querySelector('${group} .goal-header .goal-frac').textContent`),'1/1');
    await run(`document.querySelector('${group} .weekly-minus').click()`);
    await until("goalsCache.weekly[0].progress.value===4 && !document.querySelector('[data-saving]')");
    assert.equal(await evaluate(`document.querySelector('${group} .goal-header .goal-frac').textContent`),'0/1');
    await add('Focused robotics',10,'hours');
    await run(`document.querySelectorAll('${group} .weekly-plus')[1].click()`);
    await until("goalsCache.weekly[1].progress.value===0.5 && !document.querySelector('[data-saving]')");
    await send('Page.reload'); await new Promise(r=>setTimeout(r,250));
    await until("document.querySelectorAll('.weekly-value').length===2");
    assert.deepEqual(await evaluate("goalsCache.weekly.map(g=>g.progress.value)"),[4,0.5]);
    await run(`document.querySelector('${group} .weekly-edit').click(); const f=document.querySelector('.weekly-form'); f.elements.target.value='3'; f.requestSubmit();`);
    await until("!document.querySelector('.weekly-form')");
    assert.equal(await evaluate("goalsCache.weekly[0].progress.value"),3);
    assert.equal(await evaluate("goalsCache.weekly[0].checked"),true);
    // Ordinary checkboxes and conversion to numeric tracking.
    await run(`document.querySelector('${group} .weekly-add').click(); const f=document.querySelector('.weekly-form'); f.elements.name.value='Simple weekly'; f.elements.type.value='checkbox'; f.elements.type.dispatchEvent(new Event('change')); f.requestSubmit();`);
    await until("!document.querySelector('.weekly-form')");
    await run(`document.querySelector('${group} .weekly-goal:not(.weekly-measured) .goal-checkbox').click()`);
    await until("goalsCache.weekly[2].checked && !document.querySelector('[data-saving]')");
    await run(`document.querySelector('${group} .weekly-goal:not(.weekly-measured) .weekly-edit').click(); const f=document.querySelector('.weekly-form'); f.elements.type.value='target'; f.elements.type.dispatchEvent(new Event('change')); f.elements.target.value='2'; f.requestSubmit();`);
    await until("!document.querySelector('.weekly-form')");
    assert.equal(await evaluate("goalsCache.weekly[2].progress.target"),2);
    assert.equal(await evaluate("goalsCache.weekly[2].checked"),false);
    // Failed saves preserve the last confirmed value and show an error.
    await run(`window.realUpdate=DataService.updateGoal; DataService.updateGoal=async()=>{throw new Error('offline fixture')}; document.querySelectorAll('${group} .weekly-plus')[1].click();`);
    await until("document.querySelectorAll('.weekly-goal .weekly-error')[1].textContent.includes('Could not save')");
    assert.equal(await evaluate("goalsCache.weekly[1].progress.value"),0.5);
    await run('DataService.updateGoal=window.realUpdate');
    await run(`const v=document.querySelectorAll('.weekly-value')[1]; v.value='-2'; v.dispatchEvent(new Event('change'));`);
    assert.equal(await evaluate("goalsCache.weekly[1].progress.value"),0.5);
    // Cloud adapter roundtrip uses the real DataService with an in-memory Supabase table.
    await run(`
        const rows=[]; window.currentUser={id:'test-user'}; window.isSignedIn=()=>true;
        window.supabaseClient={from(){return {
            select(){return {order(){return {order(){return Promise.resolve({data:rows,error:null})}}}}},
            insert(value){return {select(){return {single(){const row={...value,id:'cloud-weekly'}; rows.push(row); return Promise.resolve({data:{id:row.id},error:null})}}}}},
            update(value){return {eq(key,id){Object.assign(rows.find(r=>r.id===id),value);return Promise.resolve({error:null})}}},
            delete(){return {eq(key,id){rows.splice(rows.findIndex(r=>r.id===id),1);return Promise.resolve({error:null})}}}
        }}};
        const p={value:0,target:10,unit:'hours',step:0.5};
        await DataService.insertGoal('weekly','Cloud robotics',0,p);
        await DataService.updateGoal('cloud-weekly',{text:'Renamed robotics',checked:false,progress:{...p,value:2.5}});
        const loaded=await DataService.loadGoals();
        if(loaded.weekly[0].text!=='Renamed robotics'||loaded.weekly[0].progress.value!==2.5) throw Error('Cloud roundtrip');
        await DataService._mirrorGoalsToLocalStorage();
        if(JSON.parse(localStorage.getItem('0500_goals')).weekly[0].progress.value!==2.5) throw Error('Cloud mirror');
        await DataService.deleteGoal('cloud-weekly');
        if((await DataService.loadGoals()).weekly.length)throw Error('Cloud delete');
        window.isSignedIn=()=>false;
    `);
    assert.equal(errors.length,0,errors.join('\n'));
    const screenshot=await send('Page.captureScreenshot',{format:'png'});
    await writeFile(path.join(profile,'weekly-progress.png'),Buffer.from(screenshot.data,'base64'));
    console.log('PASS: target creation, numeric steps, exact progress, completion and undo, header counts, reload persistence, edit target, checkboxes, conversion, validation, failed-save rollback, mocked cloud insert/update/load/mirror/delete.');
    console.log('Screenshot: '+path.join(profile,'weekly-progress.png'));
} finally {ws?.close();chrome.kill();server.close();}
