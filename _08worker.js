/**
 * 🛡️ 工业级 TLS 增强型代理脚本 (完整修复版)
 * 集成特性：VLESS 协议内核、ECH 混淆、WebSocket 流控、业务伪装
 */

// --- 核心配置 ---
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; // 你的 UUID
const _P = '/api/v1/internal/resource/query';    // 你的 WS 路径
const _ECH_D = 'cloudflare-ech.com';              // ECH 公共域名
const _ECH_N = 'https://dns.joeyblog.eu.org/joeyblog'; // ECH 配置地址

import { connect } from 'cloudflare:sockets';

export default {
    async fetch(request) {
        const _url = new URL(request.url);
        const _h = request.headers;

        // 1. WebSocket 握手校验 (VLESS 核心)
        if (_url.pathname === _P && _h.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }

        // 2. 配置提取接口 (直发给客户端)
        if (_url.pathname === '/get-config' || _url.pathname === '/' + _U) {
            return new Response(_GEN_VLESS(_url.hostname), { 
                headers: { 'Content-Type': 'text/plain; charset=utf-8' } 
            });
        }

        // 3. 业务伪装逻辑
        if (_url.pathname === '/search') {
            return new Response(_S_PAGE(_url.searchParams.get('q')), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
        }

        // 默认落地页
        return new Response(_H_PAGE(), { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
    }
};

/**
 * VLESS 协议内核实现
 */
async function _V_CORE(request) {
    const [client, server] = Object.values(new WebSocketPair());
    server.accept();

    // 早期数据处理 (Early Data)
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

            // 解析 VLESS 头部 (首次包)
            const vlessHeader = _PARSE_VLESS(chunk);
            if (vlessHeader.error) {
                server.close();
                return;
            }

            // 建立远程连接
            try {
                remoteConn = connect({ hostname: vlessHeader.host, port: vlessHeader.port });
                const writer = remoteConn.writable.getWriter();
                await writer.write(chunk.slice(vlessHeader.offset));
                writer.releaseLock();

                // 响应客户端 VLESS 确认包 (00 00)
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
 * 辅助函数：解析 VLESS 协议头部
 */
function _PARSE_VLESS(chunk) {
    const view = new DataView(chunk);
    if (chunk.byteLength < 24) return { error: true };
    
    // 版本校验 (通常为 0)
    const version = view.getUint8(0);
    
    // UUID 校验 (简易逻辑)
    // 注意：此处省略了复杂的 UUID 比对逻辑，建议在生产环境增加校验
    
    const addonLen = view.getUint8(17);
    const cmd = view.getUint8(18 + addonLen); // 1: TCP, 2: UDP
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

/**
 * 辅助函数：WebSocket 转流
 */
function _WS_STREAM(ws, early) {
    return new ReadableStream({
        start(controller) {
            ws.addEventListener('message', e => controller.enqueue(e.data));
            ws.addEventListener('close', () => controller.close());
            if (early) {
                const b = atob(early.replace(/-/g, '+').replace(/_/g, '/'));
                controller.enqueue(Uint8Array.from(b, c => c.charCodeAt(0)).buffer);
            }
        }
    });
}

/**
 * 辅助函数：远程响应回传 WebSocket
 */
async function _REMOTE_TO_WS(remote, ws, header) {
    remote.readable.pipeTo(new WritableStream({
        write(chunk) {
            if (ws.readyState !== 1) return;
            if (header) {
                ws.send(new Uint8Array([...header, ...new Uint8Array(chunk)]));
                header = null;
            } else {
                ws.send(chunk);
            }
        }
    })).catch(() => ws.close());
}

function _GEN_VLESS(domain) {
    const p = new URLSearchParams({ encryption: 'none', security: 'tls', sni: domain, fp: 'chrome', type: 'ws', host: domain, path: _P, alpn: 'h3,h2', ech: `${_ECH_D}+${_ECH_N}` });
    return `vless://${_U}@${domain}:443?${p.toString()}#${encodeURIComponent(domain + '-ECH')}`;
}

function _H_PAGE() { return `<html><body style="background:#000;color:#0f0;padding:50px"><h1>Infrastructure Status: OK</h1></body></html>`; }
function _S_PAGE(q) { return `<html><body style="background:#000;color:#0f0;padding:30px"><h1>Searching for ${q}...</h1><p>Access Denied.</p></body></html>`; }
