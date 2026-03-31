/**
 * 🕵️‍♂️ 影子代理 (Shadow Proxy) - 终极定制版
 * 功能：高仿 Bing 搜索 / 动态背景 / 官方 ECH 指向 / CF日本官方出口
 * 路径: /api/v1/internal/resource/query
 */

import { connect } from 'cloudflare:sockets';

// ================= [ 核心配置区 ] =================
// 1. 你的私人标识 (UUID)
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; 
// 2. 秘密连接路径 (Path)
const _P = '/api/v1/internal/resource/query'; 

// 3. 出口中转 (使用 Cloudflare 官方日本 Anycast IP)
// 解决 EOF 报错，并确保 YouTube 等视频流走 CF 官方骨干网
const _PROXY_IP = '162.159.134.40'; 

// 4. ECH 官方加密指向 (用于客户端手动配置参考)
const _ECH_D = 'cloudflare-ech.com';              
const _ECH_N = 'https://cloudflare-dns.com/dns-query'; 
// =================================================

export default {
    async fetch(request, env) {
        const _url = new URL(request.url);
        const _h = request.headers;

        // 【代理逻辑】只有秘密路径且是 WebSocket 请求时才激活
        if (_url.pathname === _P && _h.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }

        // 【伪装逻辑】其他所有访问均显示 Bing 搜索页，彻底隐藏订阅入口
        return new Response(_BING_SITE(), { 
            headers: { 
                'Content-Type': 'text/html;charset=UTF-8',
                'Server': 'Microsoft-IIS/10.0', // 深度伪装服务器指纹
                'X-XSS-Protection': '1; mode=block'
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
                // 【核心变动】使用 Cloudflare 日本官方 IP 中转，提升 YouTube 稳定性
                remoteConn = connect({ 
                    hostname: _PROXY_IP, 
                    port: 443 
                });
                
                // 发送握手确认包
                const responseHeader = new Uint8Array([vlessHeader.version, 0]);
                _REMOTE_TO_WS(remoteConn, server, responseHeader);

                const writer = remoteConn.writable.getWriter();
                await writer.write(chunk.slice(vlessHeader.offset));
                writer.releaseLock();
            } catch (e) {
                console.error("Connect error:", e);
                server.close();
            }
        },
        close() { server.close(); }
    })).catch(() => server.close());

    return new Response(null, { status: 101, webSocket: client });
}

// 协议解析
function _PARSE_VLESS(chunk) {
    if (chunk.byteLength < 24) return { error: true };
    const view = new DataView(chunk);
    return { error: false, offset: 22 + view.getUint8(
            
