/**
 * 🕵️‍♂️ 影子代理 (Shadow Proxy) - 真实天气查询版
 * 功能：动态天气背景 / 真实数据查询 / 故障自动回退
 */

import { connect } from 'cloudflare:sockets';

// ================= [ 核心配置区 ] =================
const _U = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; 
const _P = '/api/v1/internal/resource/query'; 
const _PROXY_IP = '103.90.73.117'; // 你验证过通的节点
// =================================================

export default {
    async fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === _P && request.headers.get('Upgrade') === 'websocket') {
            return await _V_CORE(request);
        }
        // 返回带背景和查询功能的真实天气页
        return new Response(_WEATHER_HTML(), { 
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
                // 自动回退逻辑
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

function _WEATHER_HTML() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>全球城市天气实时查询</title>
    <style>
        body, html { height: 100%; margin: 0; font-family: 'Microsoft YaHei', sans-serif; }
        .bg { 
            background: url('https://bing.biturl.top/?resolution=1920&format=image&index=0&mkt=zh-CN') center/cover no-repeat;
            height: 100%; display: flex; align-items: center; justify-content: center;
        }
        .container { 
            background: rgba(255, 255, 255, 0.85); padding: 40px; border-radius: 20px; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.2); width: 350px; text-align: center;
            backdrop-filter: blur(10px);
        }
        h2 { margin-bottom: 20px; color: #333; }
        input { 
            width: 80%; padding: 12px 20px; border: 1px solid #ddd; 
            border-radius: 25px; outline: none; font-size: 16px;
        }
        button { 
            margin-top: 15px; padding: 10px 30px; border: none; 
            background: #0078d4; color: white; border-radius: 20px; cursor: pointer;
        }
        #result { margin-top: 25px; color: #444; line-height: 1.6; }
        .temp { font-size: 48px; font-weight: bold; color: #0078d4; }
    </style>
</head>
<body>
    <div class="bg">
        <div class="container">
            <h2>实时天气查询</h2>
            <input type="text" id="cityInput" placeholder="请输入城市名称 (如: 北京)">
            <br>
            <button onclick="getWeather()">立即查询</button>
            <div id="result">输入城市名试试看</div>
        </div>
    </div>
    <script>
        async function getWeather() {
            const city = document.getElementById('cityInput').value || '北京';
            const resBox = document.getElementById('result');
            resBox.innerHTML = '正在获取数据...';
            try {
                const response = await fetch(\`https://wttr.in/\${city}?format=j1\`);
                const data = await response.json();
                const current = data.current_condition[0];
                resBox.innerHTML = \`
                    <div style="font-size: 20px;">\${city}</div>
                    <div class="temp">\${current.temp_C}°C</div>
                    <div>天气：\${current.lang_zh ? current.lang_zh[0].value : current.weatherDesc[0].value}</div>
                    <div>湿度：\${current.humidity}% | 风速：\${current.windspeedKmph}km/h</div>
                \`;
            } catch (e) {
                resBox.innerHTML = '查询失败，请输入正确的城市名';
            }
        }
    </script>
</body>
</html>`;
}
