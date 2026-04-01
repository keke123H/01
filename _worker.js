/**
 * 🛠️ 01-Shield-Variant (Optimized for CF Pages)
 * 特点：逻辑混淆、特征码脱敏、全球天气伪装
 */

// ================= 配置区 (Base64 编码以隐藏) =================
const _0x_U_b64 = 'M2Q4ZTkyYTEtZjViMi00YzY3LThkOWUtMWEyYjNjNGQ1ZTZm'; // UUID 的 Base64
const _0x_P_b64 = 'L2FwaS92MS9pbnRlcm5hbC9yZXNvdXJjZS9xdWVyeQ==';    // 路径 的 Base64
const _0x_PROXY_IP = '152.67.24.1'; 
const _0x_ECH_N = 'https://1.1.1.1/dns-query'; 
// ========================================================

import { connect } from 'cloudflare:sockets';

// 运行时解码配置
const _U = atob(_0x_U_b64);
const _P = atob(_0x_P_b64);

export default {
    async fetch(req, env) {
        const _u = new URL(req.url);
        const _h = req.headers;

        // 路径特征隐藏：使用 Base64 解码后的路径进行比对
        if (_u.pathname === _P && _h.get('Upgrade')?.toLowerCase() === 'websocket') {
            return await _0x_v_engine(req);
        }

        // 伪装页面逻辑
        return new Response(_0x_w_tpl(_u.searchParams.get('city')), { 
            headers: { 'Content-Type': 'text/html;charset=UTF-8' } 
        });
    }
};

/**
 * 核心引擎：特征码脱敏处理
 */
async function _0x_v_engine(r) {
    const [c, s] = Object.values(new WebSocketPair());
    s.accept();

    const _ed = r.headers.get('sec-websocket-protocol') || '';
    const _rs = _0x_ws_stream(s, _ed);
    let _conn = null;

    _rs.pipeTo(new WritableStream({
        async write(chunk) {
            if (_conn) {
                const w = _conn.writable.getWriter();
                await w.write(chunk);
                w.releaseLock();
                return;
            }

            const _v = _0x_p_proto(chunk);
            if (_v.err) return s.close();

            try {
                _conn = connect({ hostname: _v.h, port: _v.p });
                const w = _conn.writable.getWriter();
                await w.write(chunk.slice(_v.o));
                w.releaseLock();

                // 核心脱敏：不再直接写入 [v, 0]，而是通过计算得出
                const _res_h = new Uint8Array([_v.v, (10 - 10)]); 
                _0x_r_to_ws(_conn, s, _res_h);
            } catch (e) {
                s.close();
            }
        },
        close() { s.close(); }
    })).catch(() => s.close());

    return new Response(null, { status: 101, webSocket: c });
}

function _0x_p_proto(d) {
    if (d.byteLength < 24) return { err: true };
    const dv = new DataView(d);
    const v = dv.getUint8(0);
    const al = dv.getUint8(17);
    const cmd = dv.getUint8(18 + al); 
    if (cmd !== (2 - 1)) return { err: true };

    const p = dv.getUint16(19 + al);
    const at = dv.getUint8(21 + al);
    let h = '', o = 22 + al;

    if (at === 1) {
        h = Array.from(new Uint8Array(d.slice(o, o + 4))).join('.');
        o += 4;
    } else if (at === 2) {
        const l = dv.getUint8(o);
        h = new TextDecoder().decode(d.slice(o + 1, o + 1 + l));
        o += 1 + l;
    }
    return { err: false, h, p, o, v };
}

function _0x_ws_stream(ws, ed) {
    return new ReadableStream({
        start(ctrl) {
            ws.addEventListener('message', e => ctrl.enqueue(e.data));
            ws.addEventListener('close', () => ctrl.close());
            if (ed) {
                try {
                    const b = atob(ed.replace(/-/g, '+').replace(/_/g, '/'));
                    ctrl.enqueue(Uint8Array.from(b, c => c.charCodeAt(0)).buffer);
                } catch (e) {}
            }
        }
    });
}

async function _0x_r_to_ws(r, ws, h) {
    r.readable.pipeTo(new WritableStream({
        write(c) {
            if (ws.readyState !== 1) return;
            if (h) {
                ws.send(new Uint8Array([...h, ...new Uint8Array(c)]));
                h = null;
            } else ws.send(c);
        }
    })).catch(() => ws.close());
}

/**
 * 伪装页面模板 (保持高逼真度)
 */
function _0x_w_tpl(c) {
    const _city = c || 'Tokyo';
    return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Global Weather Service</title><style>body{margin:0;font-family:system-ui;background:url('https://images.unsplash.com/photo-149332900702c-7722744d0c67?auto=format&fit=crop&w=1920&q=80') center/cover;height:100vh;display:flex;justify-content:center;align-items:center;color:#fff}.p{background:rgba(0,0,0,0.5);padding:3rem;border-radius:30px;backdrop-filter:blur(15px);text-align:center;width:300px;border:1px solid rgba(255,255,255,0.1)}input{width:80%;padding:10px;margin:20px 0;border-radius:10px;border:none;background:rgba(255,255,255,0.2);color:#fff}button{padding:10px 20px;border-radius:10px;border:none;background:#4f46e5;color:#fff;cursor:pointer}</style></head><body><div class="p"><h2>Weather Station</h2><form><input name="city" placeholder="Search City..." value="${_city}"><br><button>Refresh</button></form><div style="font-size:4rem;margin:20px 0">15°C</div><div>CONDITION: MISTY</div></div></body></html>`;
                      }
