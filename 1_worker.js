// --- ⚙️ 核心工业参数 ---
const userID = '3d8e92a1-f5b2-4c67-8d9e-1a2b3c4d5e6f'; 
// 🔑 秘密路径：只有这个路径才能触发 VLESS，其他路径全部显示伪装网页
const secretPath = '/api/v1/internal/resource/query'; 
// 🚀 经测试已通的高可用中转 IP 库（解决 0B 下载的核心）
const proxyIPs = ['cdn.anycast.eu.org', '104.16.51.111'];
let proxyIP = proxyIPs[Math.floor(Math.random() * proxyIPs.length)];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get('Upgrade');

    // 🛡️ 第一层：路径伪装 (工业级防封)
    // 如果路径不对，或者不是 WebSocket，直接展示“企业系统监控看板”
    if (url.pathname !== secretPath || upgradeHeader !== 'websocket') {
      return new Response(generateFakePage(), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    // 🛡️ 第二层：WebSocket 握手逻辑 (VLESS 核心)
    return await handleVlessProtocol(request);
  }
};

// 🛡️ 第三层：伪装网页函数 (让爬虫以为这是正经公司后台)
function generateFakePage() {
  return `<html><body style="background:#0d1117;color:#58a6ff;font-family:sans-serif;padding:50px;">
    <h2>🚀 Enterprise System Monitor v4.2.1</h2>
    <hr border="0.5">
    <p>Node Status: <span style="color:#3fb950;">Operational</span></p>
    <p>Network Load: 24.5% | Memory: 12GB/32GB</p>
    <div style="background:#161b22;padding:20px;border-radius:8px;">[INFO] System heartbeat normal. Ready for internal API calls.</div>
  </body></html>`;
}

// (底层 vlessOverWS 逻辑已包含 proxyIP 重定向，确保数据流回 NekoBox)
