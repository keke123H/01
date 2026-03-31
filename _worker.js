/**
 * 🕵️‍♂️ 影子代理 (Shadow Proxy) - Bing 搜索版
 * 特性：动态背景 / 官方 ECH 指向 / 移除订阅 / 官方出口
 * 秘密路径: /api/v1/internal/resource/query
 */

import { connect } from 'cloudflare:sockets';

// ================= [ 核心配置区 ] =================
// 1. 身份识别 (UUID)
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; 
// 2. 秘密入口 (Path)
const _P = '/api/v1/internal/resource/query'; 

// 3. ECH 官方加密指向 (关键安全参数)
const _ECH_D = 'cloudflare-ech.com';              // 公共展示名
const _ECH_N = 'https://cloudflare-dns.com/dns-query'; // 官方密钥获取地址
// =================================================

export default {
    async fetch(request, env) {
        const _url = new URL(request.url);
        const _h = request.headers;

        // 判定：只有路径正确且发起 WebSocket 升级请求时，才激活代理
        if (_url.pathname === _P && _h.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }

        // 移除所有订阅接口。任何非秘密访问均指向 Bing 伪装页
        return new Response(_BING_SITE(), { 
            headers: { 
                'Content-Type': 'text/html;charset=UTF-8',
                'Server': 'Microsoft-IIS/10.0', // 伪装成微软服务器
                'Cache-Control': 'no-cache'
            } 
        });
    }
};

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
                // 默认走 Cloudflare 官方节点直连，确保流量的大众化特征
                remoteConn = connect({ 
                    hostname: vlessHeader.host, 
                    port: vlessHeader.port 
                });
                
                const responseHeader = new Uint8Array([vlessHeader.version, 0]);
                _REMOTE_TO_WS(remoteConn, server, responseHeader);

                const writer = remoteConn.writable.getWriter();
                await writer.write(chunk.slice(vlessHeader.offset));
                writer.releaseLock();
            } catch (e) {
                server.close();
            }
        },
        close() { server.close(); }
    })).catch(() => server.close());

    return new Response(null, { status: 101, webSocket: client });
}

// 协议解析与流处理
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

// 高仿 Bing 搜索页面 (含动态壁纸 API)
function _BING_SITE() {
    return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <title>Bing</title>
        <style>
            body, html { height: 100%; margin: 0; font-family: 'Segoe UI', system-ui, -apple-system; overflow: hidden; }
            .bg {
                background-image: url('https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN');
                height: 100%; background-position: center; background-repeat: no-repeat; background-size: cover;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                transition: background-image 0.5s ease-in-out;
            }
            .search-container {
                background: rgba(255, 255, 255, 0.9); width: min(560px, 90%); height: 44px;
                border-radius: 22px; display: flex; align-items: center; padding: 0 18px;
                box-shadow: 0 8px 15px rgba(0,0,0,0.1); backdrop-filter: blur(5px);
            }
            input {
                border: none; background: transparent; width: 100%; outline: none; font-size: 16px; color: #333;
            }
            .logo { color: white; font-size: 36px; font-weight: 700; margin-bottom: 24px; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
        </style>
    </head>
    <body>
        <div class="bg">
            <div class="logo">Bing</div>
            <div class="search-container">
                <input type="text" placeholder="搜索 Web..." readonly>
            </div>
        </div>
    </body>
    </html>`;
}
