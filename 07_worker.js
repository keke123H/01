// ========================================================
// Cloudflare Pages 专用 - 深度混淆极简版（仅VLESS + ECH + 随机路径 + 网页伪装）
// UUID：8f3e2d1c-9b4a-4f5e-8d7c-2a1b3c4d5e6f
// WS路径：/x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c
// 硬编码JP ProxyIP + 强制ECH
// ========================================================

import { connect } from 'cloudflare:sockets';

let _u = '8f3e2d1c-9b4a-4f5e-8d7c-2a1b3c4d5e6f';
let _e = true;
let _d = atob('Y2xvdWRmbGFyZS1lY2guY29t');
let _n = atob('aHR0cHM6Ly9kbnMuam9leWJsb2cuZXUub3JnL2pvZXlibG9n');
let _p = '/x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c';
let _i = 'ProxyIP.JP.CMLiussss.net';
let _v = atob('dmxlc3M6Ly8=');

export default {
    async fetch(r) {
        let u = new URL(r.url);
        if (u.pathname === '/' || u.pathname === '') {
            return new Response(_fake(), { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        }
        if (u.pathname.includes('/sub') || u.pathname === '/' + _u) {
            return await _sub(r, _u, u);
        }
        if (r.headers.get('Upgrade') === atob('d2Vic29ja2V0')) {
            return await _ws(r);
        }
        return new Response('404', { status: 404 });
    }
};

async function _sub(r, user, url) {
    let domain = url.hostname;
    let nodes = [{ ip: domain, name: '原生' }, { ip: _i, name: 'JP' }];
    let links = [];
    nodes.forEach(n => {
        let safe = n.ip.includes(':') ? '[' + n.ip + ']' : n.ip;
        let p = new URLSearchParams({ encryption: 'none', security: 'tls', sni: domain, fp: 'chrome', type: 'ws', host: domain, path: _p });
        if (_e) {
            p.set('alpn', 'h3,h2,http/1.1');
            p.set('ech', _d + '+' + _n);
        }
        links.push(_v + user + '@' + safe + ':443?' + p.toString() + '#' + encodeURIComponent(n.name + (_e ? '-ECH' : '')));
    });
    return new Response(btoa(links.join('\n')), { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
}

async function _ws(r) {
    let pair = new WebSocketPair();
    let [client, server] = Object.values(pair);
    server.accept();
    let early = r.headers.get(atob('c2VjLXdlYnNvY2tldC1wcm90b2NvbA==')) || '';
    let readable = _make(server, early);
    readable.pipeTo(new WritableStream({
        async write(chunk) {
            if (chunk.byteLength < 24) return;
            let res = _parse(chunk, _u);
            if (res.hasError) return server.close();
            try {
                let remote = connect({ hostname: res.host, port: res.port || 443 });
                let w = remote.writable.getWriter();
                await w.write(chunk.slice(res.idx));
                w.releaseLock();
                _stream(remote, server, new Uint8Array([res.ver[0], 0]));
            } catch (e) { server.close(); }
        }
    })).catch(() => {});
    return new Response(null, { status: 101, webSocket: client });
}

function _parse(chunk, token) {
    let v = new DataView(chunk);
    if (v.getUint8(0) !== 0) return { hasError: true };
    let id = new Uint8Array(chunk.slice(1,17));
    if (id.reduce((s,b,i)=>s+(i%2?'':'-')+b.toString(16).padStart(2,'0'),'').slice(1).toLowerCase() !== token) return { hasError: true };
    let cmd = v.getUint8(18); if (cmd !== 1) return { hasError: true };
    let off = 19, port = v.getUint16(off,false); off += 2;
    let type = v.getUint8(off); off++;
    let host = '';
    if (type === 1) { host = v.getUint8(off)+'.'+v.getUint8(off+1)+'.'+v.getUint8(off+2)+'.'+v.getUint8(off+3); off += 4; }
    else if (type === 2) { let len = v.getUint8(off); off++; host = new TextDecoder().decode(chunk.slice(off,off+len)); off += len; }
    else if (type === 3) { host = Array.from(new Uint8Array(chunk.slice(off,off+16))).map(b=>b.toString(16).padStart(2,'0')).join(':').replace(/(:0)+/,'::'); off += 16; }
    return { hasError: false, host, port, idx: off, ver: new Uint8Array([0]) };
}

function _make(s, early) {
    return new ReadableStream({
        start(c) {
            s.addEventListener('message', e => c.enqueue(e.data));
            s.addEventListener('close', () => c.close());
            if (early) try {
                let b = atob(early.replace(/-/g,'+').replace(/_/g,'/'));
                c.enqueue(Uint8Array.from(b, c => c.charCodeAt(0)).buffer);
            } catch(e) {}
        }
    });
}

function _stream(remote, ws, header) {
    remote.readable.pipeTo(new WritableStream({
        write(chunk) {
            if (ws.readyState === 1) {
                if (header) { ws.send(new Blob([header, chunk]).arrayBuffer()); header = null; }
                else ws.send(chunk);
            }
        }
    })).catch(() => ws.close());
}

function _fake() {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CloudTerminal - 安全运维平台</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Courier New",monospace;background:#000;color:#0f0;min-height:100vh;position:relative;overflow:hidden}.matrix{position:fixed;top:0;left:0;width:100%;height:100%;z-index:-1;pointer-events:none}.header{background:rgba(0,40,0,.95);padding:15px 30px;border-bottom:2px solid #0f0;display:flex;justify-content:space-between;align-items:center}.logo{font-weight:bold;font-size:22px;letter-spacing:2px}.nav a{color:#0f0;margin:0 20px;text-decoration:none;font-size:15px}.terminal{width:94%;max-width:920px;margin:40px auto;background:rgba(0,0,0,.92);border:3px solid #0f0;border-radius:12px;box-shadow:0 0 40px #0f0;overflow:hidden}.title{padding:15px 25px;background:rgba(0,30,0,.9);border-bottom:1px solid #0f0;font-weight:bold}.body{padding:30px;height:520px;overflow:auto;line-height:1.6;font-size:15px}.line{display:flex;margin-bottom:14px}.prompt{color:#0f0;margin-right:14px}footer{position:fixed;bottom:15px;left:0;right:0;text-align:center;font-size:13px;opacity:.6}@keyframes fall{to{transform:translateY(100vh)}}</style></head><body><div class="matrix" id="m"></div><div class="header"><div class="logo">CloudTerminal</div><div class="nav"><a href="#">监控</a><a href="#">日志</a><a href="#">节点</a><a href="#">订阅</a><a href="#">设置</a></div><div>在线 • ECH 已启用</div></div><div class="terminal"><div class="title">root@cf-terminal:\~$ 系统已连接 • 安全等级：最高</div><div class="body" id="body"><div class="line"><span class="prompt">root:\~\( </span><span>欢迎使用 CloudTerminal v2.9.4</span></div><div class="line"><span class="prompt">root:\~ \)</span><span>当前伪装模式：网页 + ECH + 随机路径</span></div><div class="line"><span class="prompt">root:\~$</span><span>UUID: 8f3e2d1c-9b4a-4f5e-8d7c-2a1b3c4d5e6f</span></div></div></div><footer>© 2026 CloudTerminal • All Rights Reserved • 全球加速节点</footer><script>const m=document.getElementById('m');for(let i=0;i<85;i++){let c=document.createElement('div');c.style.position='absolute';c.style.left=Math.random()*100+'vw';c.style.animation='fall '+(6+Math.random()*14)+'s linear infinite';c.style.opacity=Math.random()*0.9+0.1;c.style.fontSize=(10+Math.random()*8)+'px';c.textContent=Array(35).fill().map(()=>String.fromCharCode(33+Math.random()*90)).join('');m.appendChild(c);}setInterval(()=>{document.querySelectorAll('#m div').forEach(d=>{if(Math.random()>0.92)d.style.color='#fff';setTimeout(()=>d.style.color='#0f0',160);});},70);const s=document.createElement('style');s.innerHTML='@keyframes fall{to{transform:translateY(100vh)}}';document.head.appendChild(s);</script></body></html>`;
      }
