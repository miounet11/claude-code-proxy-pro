// 测试代理管理器的独立脚本
const ProxyManager = require('./proxy-manager');

async function testProxyManager() {
  const manager = new ProxyManager();
  
  console.log('初始状态:', manager.getStatus());
  
  // 测试启动代理
  const startResult = await manager.start({
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here',
    model: 'claude-3-opus-20240229'
  });
  console.log('启动结果:', startResult);
  
  // 获取当前状态
  console.log('运行状态:', manager.getStatus());
  
  // 等待5秒后停止
  setTimeout(() => {
    const stopResult = manager.stop();
    console.log('停止结果:', stopResult);
    console.log('最终状态:', manager.getStatus());
  }, 5000);
}

// 运行测试
if (require.main === module) {
  testProxyManager().catch(console.error);
}