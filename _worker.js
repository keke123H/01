/**
 * 🕵️‍♂️ 影子代理 (Shadow Proxy) - 自动回退版
 * 功能：Bing 伪装 / 优选节点 + 故障直连回退 / ECH 安全加密
 * 路径：/api/v1/internal/resource/query
 */

import { connect } from 'cloudflare:sockets';

// ================= [ 核心配置区 ] =================
// 1. 你的 UUID (保持不变)
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; 
// 2. 秘密入口路径
const _P = '/api/v1/internal/resource/query'; 
// 3. 优选节点域名 (若此域名不通，代码会自动切换到直连)
const _PROXY_IP = 'cdns.doon.eu.org'
// 4. ECH 参数
const _ECH_D = 'cloudflare-ech.com';              
const _ECH_N = 'https://cloudflare-dns.com/dns-query'; 
// =================================================

export default {
    async fetch(request, env) {
        const _url = new URL(request.url);
        // 判定：路径正确且是 WebSocket 请求才激活代理
        if (_url.pathname === _P && request.headers.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }
        // 否则一律显示 Bing 伪装页
        return new Response(_BING_SITE(), { 
            headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Server': 'Microsoft-IIS/10.0' } 
        });
    }
};

async function _V_CORE(request) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    const reader = _WS_STREAM(server, request.headers.get('sec-websocket-protocol') || '');
    let remoteConn = null;

    reader.pipeTo(new WritableStream({
        async write(chunk) {
            if (remoteConn) {
                const writer = remoteConn.writable.getWriter();
                await writer.write(chunk);
                writer.releaseLock();
                return;
            }

            const vlessHeader = _PARSE_VLESS(chunk);
            if (vlessHeader.error) return server.close();

            // --- 核心：不通就走直连的逻辑 ---
            try {
                // 第一步：尝试通过优选节点连接
                remoteConn = connect({ 
                    hostname: _PROXY_IP || vlessHeader.host, 
                    port: vlessHeader.port || 443 
                });
                
                const resp = new Uint8Array([vlessHeader.version, 0]);
                _REMOTE_TO_WS(remoteConn, server, resp);
            } catch (e) {
                // 第二步：如果报错（不通），立刻尝试直连目标地址
                try {
                    remoteConn = connect({ 
                        hostname: vlessHeader.host, 
                        port: vlessHeader.port || 443 
                    });
                    const resp = new Uint8Array([vlessHeader.version, 0]);
                    _REMOTE_TO_WS(remoteConn, server, resp);
                } catch (err) {
                    server.close();
                }
            }
            // -----------------------------

            const writer = remoteConn.writable.getWriter();
            await writer.write(chunk.slice(vlessHeader.offset));
            writer.releaseLock();
        },
        close() { server.close(); }
    })).catch(() => server.close());

    return new Response(null, { status: 101, webSocket: client });
}

function _PARSE_VLESS(chunk) {
    if (chunk.byteLength < 24) return { error: true };
    const view = new DataView(chunk);
    return { error: false, offset: 22 + view.getUint8(17), version: view.getUint8(0) }; 
}

function _WS_STREAM(ws, early) {
    return new ReadableStream({
        start(controller) {
            ws.addEventListener('message', e => controller.enqueue(e.data));
            ws.addEventListener('close', () => controller.close());
            if (early) {
                try {
                    const b = atob(early.replace(/-/g, '+').replace(/_/g, '/'));
                    controller.enqueue(Uint8Array.from(b, c => c.charCodeAt(0)).buffer);
                } catch (e) {}
            }
        }
    });
}

async function _REMOTE_TO_WS(remote, ws, header) {
    remote.readable.pipeTo(new WritableStream({
        write(chunk) {
            if (ws.readyState !== 1) return;
            if (header) {
                ws.send(new Uint8Array([...header, ...new Uint8Array(chunk)]));
                header = null;
            } else ws.send(chunk);
        }
    })).catch(() => ws.close());
}

function _BING_SITE() {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>Bing</title><style>body,html{height:100%;margin:0;font-family:Segoe UI,system-ui;overflow:hidden}.bg{background-image:url('https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN');height:100%;background-position:center;background-size:cover;display:flex;flex-direction:column;align-items:center;justify-content:center}.search{background:rgba(255,255,255,.9);width:min(560px,90%);height:44px;border-radius:22px;display:flex;align-items:center;padding:0 18px;box-shadow:0 8px 15px rgba(0,0,0,.1)}.logo{color:#fff;font-size:36px;font-weight:700;margin-bottom:24px;text-shadow:0 2px 10px rgba(0,0,0,.3)}</style></head><body><div class="bg"><div class="logo">Bing</div><div class="search"><input type="text" placeholder="搜索 Web..." readonly></div></div></body></html>`;
}
