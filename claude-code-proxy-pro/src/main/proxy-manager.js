const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');
const net = require('net');
const axios = require('axios');
const { logger } = require('./logger');
const { AppError, ErrorType } = require('./error-handler');

class ProxyManager {
  constructor() {
    this.app = null;
    this.server = null;
    this.port = 8082;
    this.isRunning = false;
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.bigModel = process.env.BIG_MODEL || 'claude-3-opus-20240229';
    this.smallModel = process.env.SMALL_MODEL || 'claude-3-haiku-20241022';
  }

  // 检查端口是否可用
  async checkPort(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          // 端口被占用
          resolve(false);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  }
  
  // 检查端口是否被自己的进程占用
  async isOwnProcess(port) {
    try {
      const response = await axios.get(`http://localhost:${port}/health`, {
        timeout: 1000
      });
      return response.data && response.data.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  // 获取可用端口
  async getAvailablePort() {
    let port = this.port;
    while (!(await this.checkPort(port))) {
      port++;
    }
    return port;
  }

  // 启动代理服务
  async start(config = {}) {
    if (this.isRunning) {
      logger.warn('ProxyManager', 'Proxy already running');
      return { success: false, error: 'Proxy already running' };
    }

    try {
      // 验证配置
      if (!config.apiKey) {
        throw new AppError('API key is required', ErrorType.CONFIG);
      }
      
      if (!config.baseUrl) {
        throw new AppError('Base URL is required', ErrorType.CONFIG);
      }
      
      this.apiKey = config.apiKey;
      this.baseUrl = config.baseUrl;
      this.bigModel = config.bigModel || this.bigModel;
      this.smallModel = config.smallModel || this.smallModel;
      
      // 智能端口管理
      let targetPort = config.port || this.port;
      let portAvailable = await this.checkPort(targetPort);
      
      if (!portAvailable) {
        // 检查是否是自己的进程
        const isOwn = await this.isOwnProcess(targetPort);
        
        if (isOwn) {
          logger.info('ProxyManager', 'Port occupied by own process, stopping it first', { port: targetPort });
          // 停止当前实例
          await this.forceStopPort(targetPort);
          // 等待一下确保端口释放
          await new Promise(resolve => setTimeout(resolve, 1000));
          portAvailable = await this.checkPort(targetPort);
        }
        
        // 如果端口仍然不可用，寻找新端口
        if (!portAvailable) {
          logger.info('ProxyManager', 'Port occupied, finding available port', { originalPort: targetPort });
          while (!portAvailable && targetPort < 65535) {
            targetPort++;
            portAvailable = await this.checkPort(targetPort);
          }
        }
      }
      
      this.port = targetPort;
      logger.info('ProxyManager', 'Using port', { port: this.port });

      this.app = express();
      
      // 添加 body parser 中间件以处理请求体
      this.app.use(express.json({ limit: '50mb' }));
      this.app.use(express.text({ type: 'text/*' }));
      this.app.use(express.raw({ type: 'application/octet-stream' }));
      
      // 添加健康检查端点
      this.app.get('/health', (req, res) => {
        res.json({ 
          status: 'healthy', 
          running: this.isRunning,
          port: this.port,
          timestamp: new Date().toISOString(),
          openai_api_configured: !!this.baseUrl,
          api_key_valid: !!this.apiKey,
          client_api_key_validation: false
        });
      });
      
      // 添加请求日志中间件
      this.app.use((req, res, next) => {
        logger.debug('ProxyManager', 'Incoming request', {
          method: req.method,
          url: req.url,
          headers: req.headers
        });
        next();
      });
      
      // 请求预处理中间件 - 处理模型映射和请求修改
      this.app.use((req, res, next) => {
        // 如果是 Claude Code 发来的请求，进行适配
        if (req.headers['user-agent'] && req.headers['user-agent'].includes('claude-code')) {
          // Claude Code 使用 OpenAI 格式，需要转换
          if (req.body && req.body.model) {
            // 根据请求特征判断使用大模型还是小模型
            const isComplexTask = this.isComplexTask(req.body);
            req.body.originalModel = req.body.model;
            req.body.model = isComplexTask ? this.bigModel : this.smallModel;
            logger.info('ProxyManager', 'Model mapping', {
              original: req.body.originalModel,
              mapped: req.body.model,
              type: isComplexTask ? 'big' : 'small'
            });
          }
          
          // 转换 OpenAI 格式到 Anthropic 格式（如果需要）
          if (this.baseUrl.includes('anthropic') && req.body) {
            req.body = this.convertOpenAIToAnthropic(req.body);
          }
        }
        next();
      });
      
      // 配置代理中间件
      this.app.use('/', createProxyMiddleware({
        target: this.baseUrl,
        changeOrigin: true,
        selfHandleResponse: true, // 自己处理响应，以便转换格式
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        onProxyReq: (proxyReq, req, res) => {
          // 设置正确的请求头
          proxyReq.setHeader('x-api-key', this.apiKey);
          proxyReq.removeHeader('authorization'); // 移除 OpenAI 格式的认证头
          
          // 如果有请求体，确保正确发送
          if (req.body) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Type', 'application/json');
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
          }
          
          logger.debug('ProxyManager', 'Proxying request', {
            target: this.baseUrl + req.url,
            model: req.body?.model
          });
        },
        onProxyRes: (proxyRes, req, res) => {
          logger.debug('ProxyManager', 'Proxy response', {
            status: proxyRes.statusCode,
            headers: proxyRes.headers
          });
          
          // 收集响应数据
          let responseBody = '';
          proxyRes.on('data', (chunk) => {
            responseBody += chunk;
          });
          
          proxyRes.on('end', () => {
            try {
              // 设置响应头
              Object.keys(proxyRes.headers).forEach(key => {
                res.setHeader(key, proxyRes.headers[key]);
              });
              
              // 如果需要转换响应格式（Anthropic -> OpenAI）
              if (req.headers['user-agent']?.includes('claude-code') && 
                  this.baseUrl.includes('anthropic')) {
                const anthropicResponse = JSON.parse(responseBody);
                const openaiResponse = this.convertAnthropicToOpenAI(anthropicResponse);
                res.status(proxyRes.statusCode).json(openaiResponse);
              } else {
                // 直接转发响应
                res.status(proxyRes.statusCode).send(responseBody);
              }
            } catch (error) {
              logger.error('ProxyManager', 'Response processing error', { error: error.message });
              res.status(500).json({ error: 'Response processing failed' });
            }
          });
        },
        onError: (err, req, res) => {
          logger.error('ProxyManager', 'Proxy error', {
            error: err.message,
            url: req.url
          });
          
          res.status(500).json({ 
            error: 'Proxy error',
            message: err.message,
            details: {
              url: req.url,
              method: req.method
            }
          });
        }
      }));

      // 启动服务器
      return new Promise((resolve, reject) => {
        this.server = this.app.listen(this.port, (err) => {
          if (err) {
            logger.error('ProxyManager', 'Failed to start server', { error: err.message });
            reject(new AppError('Failed to start proxy server', ErrorType.PROXY, { originalError: err }));
          } else {
            this.isRunning = true;
            logger.info('ProxyManager', 'Proxy server started', { port: this.port });
            resolve({ 
              success: true, 
              port: this.port, 
              message: `Proxy started on port ${this.port}` 
            });
          }
        });
        
        // 错误处理
        this.server.on('error', (err) => {
          logger.error('ProxyManager', 'Server error', { error: err.message });
          this.isRunning = false;
          reject(new AppError('Proxy server error', ErrorType.PROXY, { originalError: err }));
        });
      });
    } catch (error) {
      logger.error('ProxyManager', 'Failed to start proxy', { error: error.message });
      return { 
        success: false, 
        error: error.message,
        details: error.details 
      };
    }
  }

  // 强制停止特定端口上的服务
  async forceStopPort(port) {
    try {
      // 尝试发送停止请求
      await axios.post(`http://localhost:${port}/stop`, {}, {
        timeout: 1000
      });
    } catch (error) {
      // 忽略错误，可能服务已经停止
      logger.debug('ProxyManager', 'Force stop port error (expected)', { port, error: error.message });
    }
  }

  // 停止代理服务
  stop() {
    if (!this.server) {
      logger.warn('ProxyManager', 'Proxy not running');
      return { success: false, error: 'Proxy not running' };
    }
    
    try {
      return new Promise((resolve) => {
        this.server.close((err) => {
          if (err) {
            logger.error('ProxyManager', 'Error stopping server', { error: err.message });
          }
          
          this.server = null;
          this.app = null;
          this.isRunning = false;
          logger.info('ProxyManager', 'Proxy server stopped');
          
          resolve({ 
            success: true, 
            message: 'Proxy stopped successfully' 
          });
        });
        
        // 强制停止（5秒超时）
        setTimeout(() => {
          if (this.server) {
            logger.warn('ProxyManager', 'Force stopping proxy server');
            this.server = null;
            this.app = null;
            this.isRunning = false;
          }
        }, 5000);
      });
    } catch (error) {
      logger.error('ProxyManager', 'Failed to stop proxy', { error: error.message });
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  // 获取状态
  getStatus() {
    return {
      running: this.isRunning,
      port: this.isRunning ? this.port : null,
      apiKey: this.apiKey ? 'Configured' : 'Not configured',
      bigModel: this.bigModel,
      smallModel: this.smallModel,
      baseUrl: this.baseUrl || 'Not configured'
    };
  }
  
  // 判断是否是复杂任务（需要使用大模型）
  isComplexTask(requestBody) {
    if (!requestBody) return false;
    
    // 检查消息长度
    const messages = requestBody.messages || [];
    const totalLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
    if (totalLength > 2000) return true;
    
    // 检查是否有系统提示词
    if (messages.some(msg => msg.role === 'system')) return true;
    
    // 检查是否请求大量token
    if (requestBody.max_tokens > 4000) return true;
    
    // 检查是否有代码相关任务
    const content = messages.map(m => m.content).join(' ').toLowerCase();
    const codeKeywords = ['code', 'function', 'class', 'implement', 'debug', 'refactor'];
    if (codeKeywords.some(keyword => content.includes(keyword))) return true;
    
    return false;
  }
  
  // 转换 OpenAI 格式到 Anthropic 格式
  convertOpenAIToAnthropic(openaiRequest) {
    const anthropicRequest = {
      model: openaiRequest.model,
      messages: openaiRequest.messages,
      max_tokens: openaiRequest.max_tokens || 4096,
      temperature: openaiRequest.temperature || 0.7,
      stream: openaiRequest.stream || false
    };
    
    // 处理 system 消息
    const systemMessages = anthropicRequest.messages.filter(m => m.role === 'system');
    if (systemMessages.length > 0) {
      anthropicRequest.system = systemMessages.map(m => m.content).join('\n');
      anthropicRequest.messages = anthropicRequest.messages.filter(m => m.role !== 'system');
    }
    
    return anthropicRequest;
  }
  
  // 转换 Anthropic 格式到 OpenAI 格式
  convertAnthropicToOpenAI(anthropicResponse) {
    if (anthropicResponse.error) {
      return {
        error: {
          message: anthropicResponse.error.message,
          type: anthropicResponse.error.type,
          code: anthropicResponse.error.code
        }
      };
    }
    
    return {
      id: anthropicResponse.id || `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: anthropicResponse.model,
      usage: {
        prompt_tokens: anthropicResponse.usage?.input_tokens || 0,
        completion_tokens: anthropicResponse.usage?.output_tokens || 0,
        total_tokens: (anthropicResponse.usage?.input_tokens || 0) + (anthropicResponse.usage?.output_tokens || 0)
      },
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: anthropicResponse.content?.[0]?.text || ''
        },
        finish_reason: anthropicResponse.stop_reason || 'stop'
      }]
    };
  }
}

module.exports = ProxyManager;