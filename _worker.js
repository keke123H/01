/**
 * 🛡️ Cloudflare Pages 专用 - VLESS + ECH + 工业级伪装
 * 文件名: _worker.js (必须放在根目录)
 * 更新时间: 2026-03-31
 */

import { connect } from 'cloudflare:sockets';

// ================= 配置区 =================
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; // 你的 UUID
const _P = '/api/v1/internal/resource/query';    // 你的 WS 路径
const _ECH_D = 'cloudflare-ech.com';              // ECH 公共域名
const _ECH_N = 'https://dns.joeyblog.eu.org/joeyblog'; // ECH 配置地址
// ==========================================

export default {
    async fetch(request, env) {
        const _url = new URL(request.url);
        const _h = request.headers;
        const _domain = _url.hostname;

        // 1. 【核心】WebSocket 代理逻辑
        if (_url.pathname === _P && _h.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }

        // 2. 【配置提取】访问 /get-config 或 /UUID 获取节点
        if (_url.pathname.includes('/get-config') || _url.pathname.includes(_U)) {
            return new Response(_GEN_VLESS(_domain), { 
                headers: { 
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-store'
                } 
            });
        }

        // 3. 【业务伪装】搜索页面
        if (_url.pathname === '/search') {
            return new Response(_S_PAGE(_url.searchParams.get('q') || 'Security'), { 
                headers: { 'Content-Type': 'text/html;charset=UTF-8' } 
            });
        }

        // 4. 【默认落地页】企业级监控看板
        return new Response(_H_PAGE(), { 
            headers: { 'Content-Type': 'text/html;charset=UTF-8' } 
        });
    }
};

/**
 * VLESS 核心转发引擎
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
 * 协议解析
 */
function _PARSE_VLESS(chunk) {
    if (chunk.byteLength < 24) return { error: true };
    const view = new DataView(chunk);
    const version = view.getUint8(0);
    const addonLen = view.getUint8(17);
    const cmd = view.getUint8(18 + addonLen); 
    if (cmd !== 1) return { error: true }; // 仅支持 TCP

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

/**
 * 流处理辅助函数
 */
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
 * 节点生成逻辑
 */
function _GEN_VLESS(domain) {
    const p = new URLSearchParams({
        encryption: 'none',
        security: 'tls',
        sni: domain,
        fp: 'chrome',
        type: 'ws',
        host: domain,
        path: _P,
        alpn: 'h3,h2',
        ech: `${_ECH_D}+${_ECH_N}`
    });
    return `vless://${_U}@${domain}:443?${p.toString()}#${encodeURIComponent(domain + '-ECH')}`;
}

/**
 * 伪装页面模板
 */
function _H_PAGE() {
    return `<!DOCTYPE html><html><head><title>System Infrastructure</title><style>body{background:#0a0a0a;color:#00ff41;font-family:monospace;padding:50px;line-height:1.5}#m{border:1px solid #00ff41;padding:20px;box-shadow:0 0 10px #00ff41}</style></head><body><div id="m"><h1>> NODE_STATUS: OPERATIONAL</h1><p>> SECURITY_LEVEL: ENCRYPTED_ECH</p><p>> UPTIME: 2026-03-31_STABLE</p></div></body></html>`;
}

function _S_PAGE(q) {
    return `<html><body style="background:#000;color:#0f0;padding:50px;font-family:sans-serif"><h1>Results for "${q}"</h1><hr><p>Encrypted database connection lost. Access denied by gateway.</p></body></html>`;
        }
 
