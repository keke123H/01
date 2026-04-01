/**
 * 🛡️ Cloudflare Pages 专用 - 01 原型改良版
 * 功能: VLESS + ECH + 全球天气伪装 (无订阅分发)
 * 更新时间: 2026-04-01
 */

// ================= 核心配置区 (优先修改) =================
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; // 你的 UUID
const _PROXY_IP = '103.90.73.117';                // 你的 Proxy IP
const _P = '/api/v1/internal/resource/query';    // 你的 WS 路径
const _ECH_D = 'cloudflare-ech.com';              // ECH 公共域名
const _ECH_N = 'https://1.1.1.1/dns-query';       // ECH 查询地址
// ========================================================

import { connect } from 'cloudflare:sockets';

export default {
    async fetch(request, env) {
        const _url = new URL(request.url);
        const _h = request.headers;

        // 1. WebSocket 代理逻辑 (核心转发)
        if (_url.pathname === _P && _h.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }

        // 2. 全球天气伪装落地页 (整合搜索功能)
        // 任何非合法 WS 请求或直接访问都会看到此天气搜索页面
        return new Response(_WEATHER_PAGE(_url.searchParams.get('city')), { 
            headers: { 'Content-Type': 'text/html;charset=UTF-8' } 
        });
    }
};

/**
 * VLESS 核心转发引擎 (保持 01 原型逻辑)
 */
async function _V_CORE(request) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    const earlyData = request.headers.get('sec-websocket-protocol') || '';
    const reader = _WS_STREAM(server, earlyData);
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

            try {
                // 建立远程连接
                remoteConn = connect({ hostname: vlessHeader.host, port: vlessHeader.port });
                const writer = remoteConn.writable.getWriter();
                await writer.write(chunk.slice(vlessHeader.offset));
                writer.releaseLock();

                const responseHeader = new Uint8Array([vlessHeader.version, 0]);
                _REMOTE_TO_WS(remoteConn, server, responseHeader);
            } catch (e) {
                server.close();
            }
        },
        close() { server.close(); }
    })).catch(() => server.close());

    return new Response(null, { status: 101, webSocket: client });
}

/**
 * 协议解析逻辑
 */
function _PARSE_VLESS(chunk) {
    if (chunk.byteLength < 24) return { error: true };
    const view = new DataView(chunk);
    const version = view.getUint8(0);
    const addonLen = view.getUint8(17);
    const cmd = view.getUint8(18 + addonLen); 
    if (cmd !== 1) return { error: true };

    const port = view.getUint16(19 + addonLen);
    const addressType = view.getUint8(21 + addonLen);
    let address = '';
    let offset = 22 + addonLen;

    if (addressType === 1) { // IPv4
        address = Array.from(new Uint8Array(chunk.slice(offset, offset + 4))).join('.');
        offset += 4;
    } else if (addressType === 2) { // Domain
        const len = view.getUint8(offset);
        address = new TextDecoder().decode(chunk.slice(offset + 1, offset + 1 + len));
        offset += 1 + len;
    }
    return { error: false, host: address, port, offset, version };
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

/**
 * 伪装页面模板：现代气象雷达 (Glassmorphism 风格)
 */
function _WEATHER_PAGE(city) {
    const defaultCity = city || 'Singapore';
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <title>Global Weather Service</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                margin: 0;
                font-family: 'Inter', system-ui, sans-serif;
                background: url('https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1920&q=80') no-repeat center center fixed;
                background-size: cover;
                height: 100vh;
                display: flex;
                justify-content: center;
                align-items: center;
                color: #fff;
            }
            .glass-panel {
                background: rgba(0, 0, 0, 0.45);
                padding: 3rem;
                border-radius: 40px;
                backdrop-filter: blur(25px);
                border: 1px solid rgba(255, 255, 255, 0.15);
                text-align: center;
                width: 340px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            }
            .search-group { margin: 25px 0; display: flex; gap: 10px; }
            input {
                flex: 1; padding: 12px; border-radius: 15px; border: none;
                background: rgba(255,255,255,0.1); color: white; outline: none;
                font-size: 0.9rem;
            }
            button {
                padding: 12px 20px; border-radius: 15px; border: none;
                background: #6366f1; color: white; cursor: pointer; transition: 0.2s;
            }
            button:hover { background: #4f46e5; }
            .temp { font-size: 5.5rem; margin: 15px 0; font-weight: 200; }
            .city-label { font-size: 1.8rem; font-weight: 600; letter-spacing: -0.5px; }
            .status-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block; margin-right: 5px; }
        </style>
    </head>
    <body>
        <div class="glass-panel">
            <div class="city-label">${defaultCity}</div>
            <form class="search-group" action="/" method="get">
                <input type="text" name="city" placeholder="Search global cities..." value="${defaultCity}">
                <button type="submit">GO</button>
            </form>
            <div class="temp">28°C</div>
            <div style="font-size: 0.9rem; opacity: 0.8; text-transform: uppercase;">Cloudy with Sun</div>
            <div style="margin-top: 40px; font-size: 0.7rem; opacity: 0.5;">
                <span class="status-dot"></span> DATABASE CONNECTED
            </div>
        </div>
    </body>
    </html>`;
}
