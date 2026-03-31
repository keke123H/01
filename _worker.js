/**
 * 🕵️‍♂️ 影子代理 (Shadow Proxy) - 天气预报伪装版
 * 秘密路径: /api/v1/internal/resource/query
 */

import { connect } from 'cloudflare:sockets';

// ================= [ 核心配置区 ] =================
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; 
const _P = '/api/v1/internal/resource/query'; 
const _PROXY_IP = 'JP.CMLiussss.net'; 
// =================================================

export default {
    async fetch(request) {
        const url = new URL(request.url);
        // 判定：路径正确且是 WebSocket 请求才激活代理
        if (url.pathname === _P && request.headers.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }
        // 否则一律显示天气预报伪装页
        return new Response(_WEATHER_SITE(), { 
            headers: { 'Content-Type': 'text/html;charset=UTF-8' } 
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
            const v = _PARSE(chunk);
            if (v.error) return server.close();
            try {
                // 自动回退逻辑：先试 ProxyIP，失败则直连
                remoteConn = connect({ hostname: _PROXY_IP || v.host, port: v.port || 443 });
                _R_TO_W(remoteConn, server, new Uint8Array([v.version, 0]));
            } catch (e) {
                try {
                    remoteConn = connect({ hostname: v.host, port: v.port || 443 });
                    _R_TO_W(remoteConn, server, new Uint8Array([v.version, 0]));
                } catch (err) { server.close(); }
            }
            const writer = remoteConn.writable.getWriter();
            await writer.write(chunk.slice(v.offset));
            writer.releaseLock();
        },
        close() { server.close(); }
    })).catch(() => server.close());
    return new Response(null, { status: 101, webSocket: client });
}

function _PARSE(chunk) {
    if (chunk.byteLength < 24) return { error: true };
    const view = new DataView(chunk);
    return { error: false, offset: 22 + view.getUint8(17), version: view.getUint8(0), host: '', port: 443 };
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

async function _R_TO_W(remote, ws, header) {
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

function _WEATHER_SITE() {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>实时天气预报</title><style>body{font-family:sans-serif;background:#f0f2f5;display:flex;justify-content:center;padding-top:10vh}.card{background:#fff;padding:30px;border-radius:15px;box-shadow:0 10px 30px rgba(0,0,0,0.1);width:320px;text-align:center}.city{font-size:24px;color:#333}.temp{font-size:64px;font-weight:bold;color:#007bff;margin:20px 0}.desc{color:#666;margin-bottom:20px}input{width:80%;padding:10px;border:1px solid #ddd;border-radius:20px;outline:none}</style></head><body><div class="card"><div class="city">北京市</div><div class="temp">22°C</div><div class="desc">多云转晴 / 风速 3km/h</div><input type="text" placeholder="输入城市名称查询..."></div></body></html>`;
}
