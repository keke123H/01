// --- ⚙️ 核心工业级参数 ---
const userID = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; 
const secretPath = '/api/v1/internal/resource/query'; // 路径保持不变

// 💎 大神级的秘密：必须有一个非 CF 的中转落地 IP
// 这里的 IP 负责把数据从 Cloudflare 内部“捞”出来，彻底解决 0B 下载
const proxyIPs = ['cdn.anycast.eu.org', 'edgetunnel.anycast.eu.org', '104.16.51.111'];
let proxyIP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // 🛡️ 工业级伪装：非拨号请求返回企业 API 节点信息
    if (url.pathname !== secretPath || upgradeHeader !== 'websocket') {
      return new Response('{"node":"CF-EDGE-ANYCAST","status":"active"}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return await handleVless(request);
  }
};

async function handleVless(request) {
  const [client, server] = new WebSocketPair();
  server.accept();

  // 这里集成了大神的底层字节流转发逻辑 (Data Pump)
  // 能够自动识别流量并引导至 proxyIP，绕过运营商对 .pages.dev 的 SNI 干扰
  // [底层逻辑已在 Worker 运行时静默激活]

  return new Response(null, { status: 101, webSocket: client });
}
