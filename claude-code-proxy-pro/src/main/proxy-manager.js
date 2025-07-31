const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { spawn } = require('child_process');
const net = require('net');
const axios = require('axios');
const https = require('https');
const { logger } = require('./logger');
const { AppError, ErrorType } = require('./error-handler');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

// Circuit breaker states
const CIRCUIT_STATES = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN', 
  HALF_OPEN: 'HALF_OPEN'
};

// Error types for better categorization
const ERROR_TYPES = {
  TIMEOUT: 'timeout_error',
  CONNECTION: 'connection_error',
  AUTHENTICATION: 'authentication_error',
  PERMISSION: 'permission_error',
  RATE_LIMIT: 'rate_limit_error',
  SERVER: 'server_error',
  VALIDATION: 'validation_error',
  CONVERSION: 'conversion_error',
  CIRCUIT_BREAKER: 'circuit_breaker_error',
  UNKNOWN: 'unknown_error'
};

// Circuit breaker implementation
class CircuitBreaker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 30000;
    this.resetTimeout = options.resetTimeout || 60000;
    this.state = CIRCUIT_STATES.CLOSED;
    this.failureCount = 0;
    this.nextAttempt = Date.now();
    this.successCount = 0;
  }

  async call(fn) {
    if (this.state === CIRCUIT_STATES.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = CIRCUIT_STATES.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === CIRCUIT_STATES.HALF_OPEN) {
      this.state = CIRCUIT_STATES.CLOSED;
      this.emit('closed');
    }
    this.successCount++;
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = CIRCUIT_STATES.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.emit('opened');
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.nextAttempt
    };
  }
}

class ProxyManager extends EventEmitter {
  constructor() {
    super();
    this.app = null;
    this.server = null;
    this.port = 8082;
    this.isRunning = false;
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    this.bigModel = process.env.BIG_MODEL || 'claude-3-opus-20240229';
    this.smallModel = process.env.SMALL_MODEL || 'claude-3-haiku-20241022';
    
    // Enhanced configuration
    this.config = {
      timeouts: {
        request: 120000,     // 2 minutes
        connection: 10000,   // 10 seconds
        dns: 5000,          // 5 seconds
        keepAlive: 30000    // 30 seconds
      },
      retry: {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        jitter: true
      },
      circuitBreaker: {
        failureThreshold: 5,
        timeout: 30000,
        resetTimeout: 60000
      },
      healthCheck: {
        interval: 30000,
        timeout: 5000
      }
    };
    
    // Active connections and requests tracking
    this.activeConnections = new Set();
    this.activeRequests = new Map();
    this.requestMetrics = {
      total: 0,
      success: 0,
      errors: 0,
      timeouts: 0,
      lastError: null,
      startTime: Date.now()
    };
    
    // Circuit breaker for API calls
    this.circuitBreaker = new CircuitBreaker(this.config.circuitBreaker);
    this.circuitBreaker.on('opened', () => {
      logger.warn('ProxyManager', 'Circuit breaker opened - API calls will be blocked');
      this.emit('circuit-breaker-opened');
    });
    this.circuitBreaker.on('closed', () => {
      logger.info('ProxyManager', 'Circuit breaker closed - API calls resumed');
      this.emit('circuit-breaker-closed');
    });
    
    // HTTP agent with connection pooling
    this.httpAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: this.config.timeouts.keepAlive,
      maxSockets: 50,
      maxFreeSockets: 10,
      timeout: this.config.timeouts.connection,
      freeSocketTimeout: 30000
    });
    
    // Graceful shutdown flag
    this.shuttingDown = false;
    
    // Health monitoring
    this.healthInterval = null;
    this.startHealthMonitoring();
  }

  // Health monitoring
  startHealthMonitoring() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }
    
    this.healthInterval = setInterval(async () => {
      if (!this.isRunning) return;
      
      try {
        const health = await this.performHealthCheck();
        this.emit('health-check', health);
        
        if (!health.healthy) {
          logger.warn('ProxyManager', 'Health check failed', health);
        }
      } catch (error) {
        logger.error('ProxyManager', 'Health monitoring error', { error: error.message });
      }
    }, this.config.healthCheck.interval);
  }
  
  async performHealthCheck() {
    const health = {
      healthy: true,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.requestMetrics.startTime,
      metrics: { ...this.requestMetrics },
      circuitBreaker: this.circuitBreaker.getState(),
      activeConnections: this.activeConnections.size,
      activeRequests: this.activeRequests.size,
      memoryUsage: process.memoryUsage()
    };
    
    // Check if circuit breaker is open
    if (this.circuitBreaker.getState().state === CIRCUIT_STATES.OPEN) {
      health.healthy = false;
      health.issues = health.issues || [];
      health.issues.push('Circuit breaker is open');
    }
    
    // Check error rate
    const errorRate = this.requestMetrics.total > 0 ? 
      (this.requestMetrics.errors / this.requestMetrics.total) : 0;
    if (errorRate > 0.1) { // More than 10% error rate
      health.healthy = false;
      health.issues = health.issues || [];
      health.issues.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`);
    }
    
    return health;
  }

  // Generate unique request ID with correlation support
  generateRequestId(correlationId = null) {
    const requestId = `req_${Date.now()}_${uuidv4().substring(0, 8)}`;
    return correlationId ? `${requestId}_${correlationId}` : requestId;
  }

  // Enhanced request tracking
  trackRequest(requestId, requestData = {}) {
    const request = {
      id: requestId,
      startTime: Date.now(),
      ...requestData,
      status: 'active'
    };
    
    this.activeRequests.set(requestId, request);
    this.requestMetrics.total++;
    
    logger.debug('ProxyManager', 'Request started', { requestId, ...requestData });
    return request;
  }

  // Complete request tracking
  completeRequest(requestId, success = true, error = null) {
    const request = this.activeRequests.get(requestId);
    if (!request) return;
    
    const duration = Date.now() - request.startTime;
    request.duration = duration;
    request.status = success ? 'completed' : 'failed';
    request.error = error;
    
    this.activeRequests.delete(requestId);
    
    if (success) {
      this.requestMetrics.success++;
    } else {
      this.requestMetrics.errors++;
      this.requestMetrics.lastError = { error: error?.message, timestamp: new Date().toISOString() };
      
      if (error?.code === 'ECONNABORTED' || error?.name === 'AbortError') {
        this.requestMetrics.timeouts++;
      }
    }
    
    logger.debug('ProxyManager', 'Request completed', { 
      requestId, 
      duration: `${duration}ms`, 
      success,
      error: error?.message 
    });
    
    this.emit('request-completed', { requestId, duration, success, error });
  }

  // Enhanced retry mechanism with exponential backoff
  async retryWithBackoff(fn, requestId, maxAttempts = null) {
    maxAttempts = maxAttempts || this.config.retry.maxAttempts;
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const result = await fn();
        if (attempt > 1) {
          logger.info('ProxyManager', 'Retry successful', { requestId, attempt });
        }
        return result;
      } catch (error) {
        lastError = error;
        
        // Don't retry certain error types
        if (this.shouldNotRetry(error)) {
          logger.debug('ProxyManager', 'Non-retryable error', { requestId, error: error.message });
          throw error;
        }
        
        if (attempt === maxAttempts) {
          logger.error('ProxyManager', 'All retry attempts failed', { 
            requestId, 
            attempts: maxAttempts, 
            error: error.message 
          });
          throw error;
        }
        
        // Calculate delay with exponential backoff and jitter
        const baseDelay = this.config.retry.baseDelay * Math.pow(2, attempt - 1);
        const delay = Math.min(baseDelay, this.config.retry.maxDelay);
        const jitter = this.config.retry.jitter ? Math.random() * 0.1 * delay : 0;
        const finalDelay = delay + jitter;
        
        logger.warn('ProxyManager', 'Request failed, retrying', { 
          requestId, 
          attempt, 
          maxAttempts, 
          delay: `${finalDelay}ms`,
          error: error.message 
        });
        
        await new Promise(resolve => setTimeout(resolve, finalDelay));
      }
    }
    
    throw lastError;
  }

  // Determine if error should not be retried
  shouldNotRetry(error) {
    const nonRetryableStatus = [400, 401, 403, 422]; // Bad request, auth, forbidden, validation
    const nonRetryableCodes = ['ENOTFOUND', 'ECONNRESET'];
    
    return (
      (error.response && nonRetryableStatus.includes(error.response.status)) ||
      (error.code && nonRetryableCodes.includes(error.code)) ||
      error.name === 'ValidationError'
    );
  }

  // 检查端口是否可用
  async checkPort(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      const timeout = setTimeout(() => {
        server.close();
        resolve(false);
      }, 5000);
      
      server.once('error', (err) => {
        clearTimeout(timeout);
        if (err.code === 'EADDRINUSE') {
          // 端口被占用
          resolve(false);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        clearTimeout(timeout);
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  }
  
  // Enhanced timeout management with AbortController
  createTimeoutController(timeout = null) {
    const controller = new AbortController();
    const timeoutMs = timeout || this.config.timeouts.request;
    
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
    
    // Return controller with cleanup function
    return {
      controller,
      signal: controller.signal,
      cleanup: () => {
        clearTimeout(timeoutId);
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }
    };
  }

  // Enhanced error categorization
  categorizeError(error, requestId = null) {
    let errorType = ERROR_TYPES.UNKNOWN;
    let statusCode = 500;
    let errorMessage = error.message || 'Unknown error occurred';
    let isRetryable = true;
    
    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.name === 'AbortError' || 
        error.message.includes('timeout')) {
      errorType = ERROR_TYPES.TIMEOUT;
      statusCode = 408;
      errorMessage = '请求超时，请稍后重试';
      isRetryable = true;
    }
    // Connection errors
    else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' ||
             error.code === 'ECONNRESET' || error.code === 'ENETUNREACH') {
      errorType = ERROR_TYPES.CONNECTION;
      statusCode = 503;
      errorMessage = '无法连接到API服务器';
      isRetryable = error.code !== 'ENOTFOUND'; // DNS errors shouldn't be retried immediately
    }
    // HTTP response errors
    else if (error.response?.status) {
      statusCode = error.response.status;
      errorMessage = error.response?.data?.error?.message || error.message;
      
      switch (statusCode) {
        case 400:
          errorType = ERROR_TYPES.VALIDATION;
          errorMessage = '请求参数无效';
          isRetryable = false;
          break;
        case 401:
          errorType = ERROR_TYPES.AUTHENTICATION;
          errorMessage = 'API密钥无效或已过期';
          isRetryable = false;
          break;
        case 403:
          errorType = ERROR_TYPES.PERMISSION;
          errorMessage = '权限不足或配额已用完';
          isRetryable = false;
          break;
        case 429:
          errorType = ERROR_TYPES.RATE_LIMIT;
          errorMessage = '请求频率过高，请稍后重试';
          isRetryable = true;
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          errorType = ERROR_TYPES.SERVER;
          errorMessage = 'API服务器暂时不可用';
          isRetryable = true;
          break;
        default:
          errorType = ERROR_TYPES.UNKNOWN;
          isRetryable = statusCode >= 500;
      }
    }
    // Circuit breaker errors
    else if (error.message.includes('Circuit breaker')) {
      errorType = ERROR_TYPES.CIRCUIT_BREAKER;
      statusCode = 503;
      errorMessage = '服务暂时不可用，请稍后重试';
      isRetryable = false;
    }
    
    return {
      type: errorType,
      statusCode,
      message: errorMessage,
      isRetryable,
      originalError: error,
      requestId
    };
  }

  // 检查端口是否被自己的进程占用
  async isOwnProcess(port) {
    try {
      const { controller, cleanup } = this.createTimeoutController(2000);
      
      try {
        const response = await axios.get(`http://localhost:${port}/health`, {
          timeout: 2000,
          signal: controller.signal,
          httpsAgent: this.httpAgent
        });
        
        cleanup();
        return response.data && response.data.status === 'healthy';
      } catch (error) {
        cleanup();
        return false;
      }
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
      
      // Enhanced health check endpoint
      this.app.get('/health', async (req, res) => {
        const requestId = this.generateRequestId();
        
        try {
          const health = await this.performHealthCheck();
          
          // Add additional runtime info
          const healthResponse = {
            ...health,
            status: health.healthy ? 'healthy' : 'unhealthy',
            running: this.isRunning,
            port: this.port,
            timestamp: new Date().toISOString(),
            openai_api_configured: !!this.baseUrl,
            api_key_configured: !!this.apiKey,
            models: {
              big: this.bigModel,
              small: this.smallModel
            },
            version: process.env.npm_package_version || '1.0.0',
            node_version: process.version,
            environment: process.env.NODE_ENV || 'development'
          };
          
          res.setHeader('x-request-id', requestId);
          res.status(health.healthy ? 200 : 503).json(healthResponse);
          
        } catch (error) {
          logger.error('ProxyManager', 'Health check error', {
            requestId,
            error: error.message
          });
          
          res.status(500).json({
            status: 'error',
            healthy: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            request_id: requestId
          });
        }
      });
      
      // Add metrics endpoint
      this.app.get('/metrics', (req, res) => {
        const requestId = this.generateRequestId();
        
        try {
          const metrics = {
            ...this.requestMetrics,
            uptime: Date.now() - this.requestMetrics.startTime,
            activeConnections: this.activeConnections.size,
            activeRequests: this.activeRequests.size,
            circuitBreaker: this.circuitBreaker.getState(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage(),
            timestamp: new Date().toISOString()
          };
          
          res.setHeader('x-request-id', requestId);
          res.json(metrics);
          
        } catch (error) {
          logger.error('ProxyManager', 'Metrics error', {
            requestId,
            error: error.message
          });
          
          res.status(500).json({
            error: {
              message: 'Failed to retrieve metrics',
              type: 'internal_error',
              request_id: requestId
            }
          });
        }
      });
      
      // Add graceful shutdown endpoint
      this.app.post('/shutdown', async (req, res) => {
        const requestId = this.generateRequestId();
        
        logger.info('ProxyManager', 'Shutdown requested', { requestId });
        
        res.json({
          message: 'Shutdown initiated',
          request_id: requestId,
          timestamp: new Date().toISOString()
        });
        
        // Initiate graceful shutdown after response
        setImmediate(async () => {
          try {
            await this.stop();
          } catch (error) {
            logger.error('ProxyManager', 'Shutdown error', {
              requestId,
              error: error.message
            });
          }
        });
      });

      // Enhanced OpenAI compatible endpoint with comprehensive error handling
      this.app.post('/v1/chat/completions', async (req, res) => {
        const correlationId = req.headers['x-correlation-id'] || null;
        const requestId = this.generateRequestId(correlationId);
        let timeoutController = null;
        
        // Track connection for graceful shutdown
        this.activeConnections.add(res.socket);
        res.socket.on('close', () => {
          this.activeConnections.delete(res.socket);
        });
        
        // Track this request
        const requestData = {
          method: 'POST',
          endpoint: '/v1/chat/completions',
          model: req.body?.model,
          messageCount: req.body?.messages?.length || 0,
          maxTokens: req.body?.max_tokens,
          stream: req.body?.stream,
          userAgent: req.headers['user-agent'],
          ip: req.ip || req.connection.remoteAddress
        };
        
        const request = this.trackRequest(requestId, requestData);
        
        try {
          logger.info('ProxyManager', 'Chat completions request started', {
            requestId,
            ...requestData
          });

          // Input validation with detailed error messages
          if (!req.body || typeof req.body !== 'object') {
            const error = new Error('Request body must be a valid JSON object');
            error.name = 'ValidationError';
            throw error;
          }
          
          if (!req.body.messages || !Array.isArray(req.body.messages)) {
            const error = new Error('Request must include a "messages" array');
            error.name = 'ValidationError';
            throw error;
          }
          
          if (req.body.messages.length === 0) {
            const error = new Error('Messages array cannot be empty');
            error.name = 'ValidationError';
            throw error;
          }

          // Check if we should proceed (circuit breaker, shutdown, etc.)
          if (this.shuttingDown) {
            const error = new Error('Service is shutting down, please try again later');
            error.statusCode = 503;
            throw error;
          }

          // Convert OpenAI request to Anthropic format with validation
          const anthropicRequest = this.convertOpenAIToAnthropic(req.body);
          
          // Create enhanced timeout controller
          timeoutController = this.createTimeoutController(
            req.body.stream ? this.config.timeouts.request * 2 : this.config.timeouts.request
          );
          
          // Execute request with circuit breaker and retry logic
          const executeRequest = async () => {
            const headers = {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey,
              'anthropic-version': '2023-06-01',
              'x-request-id': requestId,
              'User-Agent': `claude-code-proxy/${process.env.npm_package_version || '1.0.0'}`
            };
            
            // Add correlation ID if present
            if (correlationId) {
              headers['x-correlation-id'] = correlationId;
            }
            
            return await axios.post(`${this.baseUrl}/v1/messages`, anthropicRequest, {
              headers,
              timeout: timeoutController.controller.signal.aborted ? 1 : this.config.timeouts.request,
              signal: timeoutController.signal,
              httpsAgent: this.httpAgent,
              validateStatus: (status) => status < 600 // Don't throw for any status < 600
            });
          };
          
          // Execute with circuit breaker and retry
          const response = await this.circuitBreaker.call(async () => {
            return await this.retryWithBackoff(executeRequest, requestId);
          });
          
          // Clean up timeout controller
          timeoutController.cleanup();
          timeoutController = null;

          // Handle API error responses
          if (response.status >= 400) {
            const errorData = response.data;
            const apiError = new Error(
              errorData?.error?.message || 
              errorData?.message || 
              `API returned ${response.status} status`
            );
            apiError.response = response;
            throw apiError;
          }

          // Handle streaming responses
          if (req.body.stream && response.headers['content-type']?.includes('text/stream')) {
            return this.handleStreamingResponse(req, res, response, requestId);
          }

          // Convert Anthropic response to OpenAI format
          const openaiResponse = this.convertAnthropicToOpenAI(response.data, requestId);
          
          // Complete request tracking
          this.completeRequest(requestId, true);
          
          const duration = Date.now() - request.startTime;
          logger.info('ProxyManager', 'Chat completions completed successfully', {
            requestId,
            duration: `${duration}ms`,
            tokensUsed: openaiResponse.usage?.total_tokens || 0,
            model: response.data.model || anthropicRequest.model,
            finishReason: openaiResponse.choices?.[0]?.finish_reason
          });

          // Set response headers
          res.setHeader('x-request-id', requestId);
          if (correlationId) {
            res.setHeader('x-correlation-id', correlationId);
          }
          
          res.json(openaiResponse);
          
        } catch (error) {
          // Clean up timeout controller if still active
          if (timeoutController) {
            timeoutController.cleanup();
          }
          
          // Categorize and handle the error
          const errorInfo = this.categorizeError(error, requestId);
          
          // Complete request tracking with error
          this.completeRequest(requestId, false, error);
          
          const duration = Date.now() - request.startTime;
          
          logger.error('ProxyManager', 'Chat completions failed', {
            requestId,
            duration: `${duration}ms`,
            errorType: errorInfo.type,
            statusCode: errorInfo.statusCode,
            message: errorInfo.message,
            stack: error.stack,
            isRetryable: errorInfo.isRetryable,
            responseData: error.response?.data
          });
          
          // Set error response headers
          res.setHeader('x-request-id', requestId);
          if (correlationId) {
            res.setHeader('x-correlation-id', correlationId);
          }
          
          // Send error response in OpenAI format
          res.status(errorInfo.statusCode).json({
            error: {
              message: errorInfo.message,
              type: errorInfo.type,
              code: error.response?.data?.error?.type || errorInfo.type,
              request_id: requestId
            }
          });
        }
      });

      // Handle streaming responses
      this.handleStreamingResponse = async (req, res, anthropicResponse, requestId) => {
        try {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          res.setHeader('x-request-id', requestId);
          
          let buffer = '';
          let chunkCount = 0;
          
          anthropicResponse.data.on('data', (chunk) => {
            try {
              buffer += chunk.toString();
              chunkCount++;
              
              // Process complete lines
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer
              
              for (const line of lines) {
                if (line.trim() === '') continue;
                if (line.startsWith('data: ')) {
                  const data = line.slice(6);
                  if (data === '[DONE]') {
                    res.write('data: [DONE]\n\n');
                    continue;
                  }
                  
                  try {
                    const anthropicChunk = JSON.parse(data);
                    const openaiChunk = this.convertAnthropicStreamToOpenAI(anthropicChunk, requestId);
                    res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
                  } catch (parseError) {
                    logger.warn('ProxyManager', 'Failed to parse streaming chunk', {
                      requestId,
                      error: parseError.message,
                      data
                    });
                  }
                }
              }
            } catch (error) {
              logger.error('ProxyManager', 'Streaming data processing error', {
                requestId,
                error: error.message,
                chunkCount
              });
            }
          });
          
          anthropicResponse.data.on('end', () => {
            // Process any remaining buffer
            if (buffer.trim()) {
              try {
                if (buffer.startsWith('data: ')) {
                  const data = buffer.slice(6);
                  if (data !== '[DONE]') {
                    const anthropicChunk = JSON.parse(data);
                    const openaiChunk = this.convertAnthropicStreamToOpenAI(anthropicChunk, requestId);
                    res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`);
                  }
                }
              } catch (error) {
                logger.warn('ProxyManager', 'Failed to process final buffer', {
                  requestId,
                  error: error.message
                });
              }
            }
            
            res.write('data: [DONE]\n\n');
            res.end();
            
            this.completeRequest(requestId, true);
            logger.info('ProxyManager', 'Streaming response completed', {
              requestId,
              chunkCount
            });
          });
          
          anthropicResponse.data.on('error', (error) => {
            logger.error('ProxyManager', 'Streaming response error', {
              requestId,
              error: error.message
            });
            
            if (!res.headersSent) {
              res.status(500).json({
                error: {
                  message: 'Streaming response failed',
                  type: 'stream_error',
                  request_id: requestId
                }
              });
            } else {
              res.write(`data: ${JSON.stringify({
                error: {
                  message: 'Stream interrupted',
                  type: 'stream_error'
                }
              })}\n\n`);
              res.end();
            }
            
            this.completeRequest(requestId, false, error);
          });
          
        } catch (error) {
          logger.error('ProxyManager', 'Streaming setup error', {
            requestId,
            error: error.message
          });
          
          if (!res.headersSent) {
            res.status(500).json({
              error: {
                message: 'Failed to setup streaming response',
                type: 'stream_setup_error',
                request_id: requestId
              }
            });
          }
          
          this.completeRequest(requestId, false, error);
        }
      };

      // 添加模型列表端点
      this.app.get('/v1/models', (req, res) => {
        const requestId = this.generateRequestId();
        
        try {
          logger.debug('ProxyManager', 'Models list requested', { requestId });
          
          const models = [
            {
              id: this.bigModel,
              object: "model",
              created: Math.floor(Date.now() / 1000),
              owned_by: "anthropic",
              permission: [],
              root: this.bigModel,
              parent: null,
              context_length: 200000
            },
            {
              id: this.smallModel,
              object: "model",
              created: Math.floor(Date.now() / 1000),
              owned_by: "anthropic",
              permission: [],
              root: this.smallModel,
              parent: null,
              context_length: 200000
            }
          ];
          
          res.setHeader('x-request-id', requestId);
          res.json({
            object: "list",
            data: models
          });
          
        } catch (error) {
          logger.error('ProxyManager', 'Models list error', {
            requestId,
            error: error.message
          });
          
          res.status(500).json({
            error: {
              message: 'Failed to retrieve models list',
              type: 'internal_error',
              request_id: requestId
            }
          });
        }
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

  // Enhanced graceful shutdown with connection draining
  async stop() {
    if (!this.server || !this.isRunning) {
      logger.warn('ProxyManager', 'Proxy not running');
      return { success: false, error: 'Proxy not running' };
    }
    
    logger.info('ProxyManager', 'Initiating graceful server shutdown');
    this.shuttingDown = true;
    this.emit('shutdown-started');
    
    try {
      // Stop health monitoring
      if (this.healthInterval) {
        clearInterval(this.healthInterval);
        this.healthInterval = null;
      }
      
      // Stop accepting new connections
      this.server.close();
      
      // Wait for active requests to complete
      const maxWaitTime = 30000; // 30 seconds
      const checkInterval = 500; // 500ms
      let waitTime = 0;
      
      while (this.activeRequests.size > 0 && waitTime < maxWaitTime) {
        logger.info('ProxyManager', `Waiting for ${this.activeRequests.size} active requests to complete`, {
          activeRequests: Array.from(this.activeRequests.keys()),
          waitTime: `${waitTime}ms`
        });
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waitTime += checkInterval;
      }
      
      // Force close remaining requests if timeout reached
      if (this.activeRequests.size > 0) {
        logger.warn('ProxyManager', `Force closing ${this.activeRequests.size} remaining requests after timeout`);
        this.activeRequests.clear();
      }
      
      // Close all active connections gracefully
      const connectionPromises = Array.from(this.activeConnections).map(socket => {
        return new Promise((resolve) => {
          if (socket.destroyed) {
            resolve();
            return;
          }
          
          socket.on('close', resolve);
          socket.end();
          
          // Force close after 5 seconds
          setTimeout(() => {
            if (!socket.destroyed) {
              socket.destroy();
            }
            resolve();
          }, 5000);
        });
      });
      
      // Wait for all connections to close
      if (connectionPromises.length > 0) {
        logger.info('ProxyManager', `Waiting for ${connectionPromises.length} connections to close`);
        await Promise.all(connectionPromises);
      }
      
      // Clean up HTTP agent
      if (this.httpAgent) {
        this.httpAgent.destroy();
      }
      
      // Final cleanup
      await new Promise((resolve) => {
        if (this.server.listening) {
          this.server.on('close', resolve);
        } else {
          resolve();
        }
      });
      
      this.server = null;
      this.app = null;
      this.isRunning = false;
      this.shuttingDown = false;
      this.activeConnections.clear();
      this.activeRequests.clear();
      
      logger.info('ProxyManager', 'Proxy server stopped gracefully');
      this.emit('shutdown-completed');
      
      return { 
        success: true, 
        message: 'Proxy stopped successfully'
      };
      
    } catch (error) {
      logger.error('ProxyManager', 'Error during graceful shutdown', { error: error.message });
      
      // Force cleanup on error
      if (this.server) {
        this.server.close();
        this.server = null;
      }
      
      this.app = null;
      this.isRunning = false;
      this.shuttingDown = false;
      
      return { 
        success: false, 
        error: `Shutdown error: ${error.message}`,
        warning: 'Force shutdown was performed due to error'
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
  
  // Enhanced OpenAI to Anthropic format conversion with comprehensive validation
  convertOpenAIToAnthropic(openaiRequest) {
    try {
      // Input validation
      if (!openaiRequest || typeof openaiRequest !== 'object') {
        throw new Error('Invalid OpenAI request: must be an object');
      }

      if (!openaiRequest.messages || !Array.isArray(openaiRequest.messages)) {
        throw new Error('Invalid OpenAI request: messages must be an array');
      }

      if (openaiRequest.messages.length === 0) {
        throw new Error('Invalid OpenAI request: messages array cannot be empty');
      }

      // Validate message structure
      for (let i = 0; i < openaiRequest.messages.length; i++) {
        const msg = openaiRequest.messages[i];
        if (!msg || typeof msg !== 'object') {
          throw new Error(`Invalid message at index ${i}: must be an object`);
        }
        if (!msg.role || typeof msg.role !== 'string') {
          throw new Error(`Invalid message at index ${i}: role is required and must be a string`);
        }
        if (msg.content === undefined || msg.content === null) {
          throw new Error(`Invalid message at index ${i}: content is required`);
        }
      }

      // Model selection with enhanced logic
      const isComplexTask = this.isComplexTask(openaiRequest);
      const selectedModel = isComplexTask ? this.bigModel : this.smallModel;
      
      logger.debug('ProxyManager', 'Model selection for request', {
        originalModel: openaiRequest.model,
        selectedModel,
        isComplexTask,
        messageCount: openaiRequest.messages.length,
        totalLength: openaiRequest.messages.reduce((sum, msg) => 
          sum + (typeof msg.content === 'string' ? msg.content.length : 0), 0
        )
      });

      // Build Anthropic request with parameter validation
      const anthropicRequest = {
        model: selectedModel
      };
      
      // Handle max_tokens with proper bounds
      if (openaiRequest.max_tokens !== undefined) {
        anthropicRequest.max_tokens = Math.min(
          Math.max(parseInt(openaiRequest.max_tokens) || 1, 1), 
          200000
        );
      } else {
        anthropicRequest.max_tokens = 4096;
      }
      
      // Handle temperature with proper bounds  
      if (openaiRequest.temperature !== undefined) {
        anthropicRequest.temperature = Math.min(
          Math.max(parseFloat(openaiRequest.temperature) || 0, 0), 
          1.0
        );
      } else {
        anthropicRequest.temperature = 0.7;
      }
      
      // Handle top_p if provided
      if (openaiRequest.top_p !== undefined) {
        anthropicRequest.top_p = Math.min(
          Math.max(parseFloat(openaiRequest.top_p) || 0, 0), 
          1.0
        );
      }
      
      // Handle streaming
      anthropicRequest.stream = Boolean(openaiRequest.stream);
      
      // Handle stop sequences
      if (openaiRequest.stop) {
        if (Array.isArray(openaiRequest.stop)) {
          anthropicRequest.stop_sequences = openaiRequest.stop.slice(0, 4); // Anthropic max 4
        } else if (typeof openaiRequest.stop === 'string') {
          anthropicRequest.stop_sequences = [openaiRequest.stop];
        }
      }
      
      // Process messages with enhanced content handling
      const messages = [...openaiRequest.messages];
      const systemMessages = messages.filter(m => m.role === 'system');
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      // Handle system messages
      if (systemMessages.length > 0) {
        const systemContent = systemMessages
          .map(m => this.extractTextContent(m.content))
          .filter(content => content && content.trim())
          .join('\n\n');
        
        if (systemContent.trim()) {
          anthropicRequest.system = systemContent.trim();
        }
      }
      
      // Process conversation messages with enhanced content extraction
      anthropicRequest.messages = conversationMessages
        .filter(msg => msg.role && msg.content !== undefined)
        .map((msg, index) => {
          try {
            const content = this.extractTextContent(msg.content);
            
            if (!content || content.trim() === '') {
              logger.warn('ProxyManager', `Empty content in message at index ${index}`);
              return {
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: '...' // Fallback for empty content
              };
            }
            
            return {
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: content.trim()
            };
          } catch (error) {
            logger.warn('ProxyManager', `Error processing message at index ${index}`, {
              error: error.message,
              messageRole: msg.role
            });
            
            return {
              role: msg.role === 'assistant' ? 'assistant' : 'user',
              content: 'Error processing message content'
            };
          }
        })
        .filter(msg => msg.content !== 'Error processing message content');
      
      // Ensure we have valid messages
      if (anthropicRequest.messages.length === 0) {
        anthropicRequest.messages = [{ role: 'user', content: 'Hello' }];
        logger.warn('ProxyManager', 'No valid messages found, using fallback');
      }
      
      // Ensure proper message alternation for Anthropic
      anthropicRequest.messages = this.ensureAlternatingMessages(anthropicRequest.messages);
      
      // Final validation
      if (!anthropicRequest.messages.length || 
          anthropicRequest.messages[0].role !== 'user') {
        throw new Error('Converted request must start with a user message');
      }
      
      logger.debug('ProxyManager', 'Successfully converted OpenAI to Anthropic request', {
        originalMessageCount: openaiRequest.messages.length,
        convertedMessageCount: anthropicRequest.messages.length,
        hasSystem: !!anthropicRequest.system,
        model: anthropicRequest.model,
        maxTokens: anthropicRequest.max_tokens,
        temperature: anthropicRequest.temperature
      });
      
      return anthropicRequest;
      
    } catch (error) {
      logger.error('ProxyManager', 'OpenAI to Anthropic conversion failed', { 
        error: error.message,
        stack: error.stack,
        requestKeys: openaiRequest ? Object.keys(openaiRequest) : 'null'
      });
      
      // Return safe fallback request
      const fallback = {
        model: this.smallModel || 'claude-3-haiku-20241022',
        max_tokens: 1000,
        temperature: 0.7,
        messages: [{ role: 'user', content: 'Hello' }]
      };
      
      logger.warn('ProxyManager', 'Using fallback Anthropic request', fallback);
      return fallback;
    }
  }
  
  // Enhanced text content extraction with multimodal support
  extractTextContent(content) {
    if (typeof content === 'string') {
      return content;
    }
    
    if (Array.isArray(content)) {
      // Handle multimodal content (OpenAI format)
      return content
        .filter(item => item && typeof item === 'object')
        .map(item => {
          if (item.type === 'text' && item.text) {
            return item.text;
          } else if (item.type === 'image_url') {
            // For now, replace images with placeholder
            // In future, could implement image processing
            return '[Image content - not supported in current conversion]';
          } else if (typeof item === 'string') {
            return item;
          }
          return '';
        })
        .filter(text => text.trim())
        .join('\n');
    }
    
    if (typeof content === 'object' && content !== null) {
      // Handle other object types
      if (content.text) {
        return content.text;
      }
      // Last resort: stringify the object
      try {
        return JSON.stringify(content);
      } catch (error) {
        logger.warn('ProxyManager', 'Failed to stringify content object', {
          error: error.message
        });
        return '[Complex content - conversion failed]';
      }
    }
    
    // Handle other primitive types
    if (content !== undefined && content !== null) {
      return String(content);
    }
    
    return '';
  }
  
  // 确保消息交替（用户-助手-用户...）
  ensureAlternatingMessages(messages) {
    const result = [];
    let lastRole = null;
    
    for (const msg of messages) {
      if (msg.role === lastRole) {
        // 如果角色重复，合并消息内容
        if (result.length > 0) {
          result[result.length - 1].content += '\n\n' + msg.content;
        } else {
          result.push(msg);
        }
      } else {
        result.push(msg);
        lastRole = msg.role;
      }
    }
    
    // 确保以用户消息开始
    if (result.length > 0 && result[0].role !== 'user') {
      result.unshift({ role: 'user', content: '请继续。' });
    }
    
    return result;
  }
  
  // Enhanced Anthropic to OpenAI format conversion with error handling
  convertAnthropicToOpenAI(anthropicResponse, requestId = null) {
    try {
      // Input validation
      if (!anthropicResponse || typeof anthropicResponse !== 'object') {
        throw new Error('Invalid Anthropic response: must be an object');
      }

      // Handle error responses from Anthropic
      if (anthropicResponse.error) {
        const errorResponse = {
          error: {
            message: anthropicResponse.error.message || 'Unknown API error',
            type: this.mapAnthropicErrorType(anthropicResponse.error.type),
            code: anthropicResponse.error.code || anthropicResponse.error.type || 'api_error'
          }
        };
        
        if (requestId) {
          errorResponse.error.request_id = requestId;
        }
        
        logger.debug('ProxyManager', 'Converted Anthropic error response', {
          originalError: anthropicResponse.error,
          convertedError: errorResponse.error,
          requestId
        });
        
        return errorResponse;
      }
      
      // Extract and validate content
      let content = this.extractAnthropicContent(anthropicResponse.content);
      
      // Handle empty or invalid content
      if (!content || content.trim() === '') {
        content = 'I apologize, but I was unable to generate a response.';
        logger.warn('ProxyManager', 'Empty or invalid content in Anthropic response', { 
          response: anthropicResponse,
          requestId
        });
      }
      
      // Map finish reason with comprehensive handling
      const finishReason = this.mapAnthropicStopReason(anthropicResponse.stop_reason);
      
      // Process usage information with validation
      const usage = this.processAnthropicUsage(anthropicResponse.usage);
      
      // Generate response ID if not provided
      const responseId = anthropicResponse.id || 
                        `chatcmpl-${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Build OpenAI compatible response
      const openaiResponse = {
        id: responseId,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: anthropicResponse.model || this.smallModel || 'claude-3-haiku-20241022',
        usage: usage,
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: content.trim()
          },
          finish_reason: finishReason
        }]
      };
      
      // Add system fingerprint if available
      if (anthropicResponse.system_fingerprint) {
        openaiResponse.system_fingerprint = anthropicResponse.system_fingerprint;
      }
      
      logger.debug('ProxyManager', 'Successfully converted Anthropic to OpenAI response', {
        requestId,
        responseId: openaiResponse.id,
        model: openaiResponse.model,
        contentLength: content.length,
        tokensUsed: usage.total_tokens,
        finishReason
      });
      
      return openaiResponse;
      
    } catch (error) {
      logger.error('ProxyManager', 'Anthropic to OpenAI conversion failed', { 
        error: error.message,
        stack: error.stack,
        responseKeys: anthropicResponse ? Object.keys(anthropicResponse) : 'null',
        requestId
      });
      
      // Return error response in OpenAI format
      const errorResponse = {
        error: {
          message: `Response conversion failed: ${error.message}`,
          type: 'conversion_error',
          code: 'response_format_error'
        }
      };
      
      if (requestId) {
        errorResponse.error.request_id = requestId;
      }
      
      return errorResponse;
    }
  }
  
  // Extract content from Anthropic response with robust handling
  extractAnthropicContent(content) {
    if (!content) {
      return '';
    }
    
    // Handle string content
    if (typeof content === 'string') {
      return content;
    }
    
    // Handle array content (typical Anthropic format)
    if (Array.isArray(content)) {
      return content
        .filter(item => item && typeof item === 'object')
        .map(item => {
          if (item.type === 'text' && item.text) {
            return item.text;
          }
          // Handle other content types if needed
          return '';
        })
        .filter(text => text.trim())
        .join('');
    }
    
    // Handle object content
    if (typeof content === 'object') {
      if (content.text) {
        return content.text;
      }
      if (content.content && typeof content.content === 'string') {
        return content.content;
      }
    }
    
    // Fallback: stringify if possible
    try {
      return JSON.stringify(content);
    } catch (error) {
      logger.warn('ProxyManager', 'Failed to extract content from Anthropic response', {
        contentType: typeof content,
        error: error.message
      });
      return '';
    }
  }
  
  // Map Anthropic stop reasons to OpenAI finish reasons
  mapAnthropicStopReason(stopReason) {
    const reasonMap = {
      'end_turn': 'stop',
      'max_tokens': 'length', 
      'stop_sequence': 'stop',
      'tool_use': 'tool_calls',
      'content_filter': 'content_filter'
    };
    
    return reasonMap[stopReason] || 'stop';
  }
  
  // Map Anthropic error types to OpenAI error types
  mapAnthropicErrorType(anthropicType) {
    const typeMap = {
      'invalid_request_error': 'invalid_request_error', 
      'authentication_error': 'invalid_api_key',
      'permission_error': 'insufficient_quota',
      'not_found_error': 'model_not_found',
      'rate_limit_error': 'rate_limit_exceeded',
      'api_error': 'api_error',
      'overloaded_error': 'server_error'
    };
    
    return typeMap[anthropicType] || 'api_error';
  }
  
  // Process Anthropic usage information
  processAnthropicUsage(usageInfo) {
    const usage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0
    };
    
    if (usageInfo && typeof usageInfo === 'object') {
      usage.prompt_tokens = Math.max(0, parseInt(usageInfo.input_tokens) || 0);
      usage.completion_tokens = Math.max(0, parseInt(usageInfo.output_tokens) || 0);
    }
    
    usage.total_tokens = usage.prompt_tokens + usage.completion_tokens;
    
    return usage;
  }
  
  // Convert Anthropic streaming chunks to OpenAI format
  convertAnthropicStreamToOpenAI(anthropicChunk, requestId = null) {
    try {
      if (!anthropicChunk || typeof anthropicChunk !== 'object') {
        throw new Error('Invalid streaming chunk');
      }
      
      const chunk = {
        id: anthropicChunk.id || `chatcmpl-${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: anthropicChunk.model || this.smallModel || 'claude-3-haiku-20241022',
        choices: [{
          index: 0,
          delta: {},
          finish_reason: null
        }]
      };
      
      // Handle different chunk types
      if (anthropicChunk.type === 'content_block_delta') {
        if (anthropicChunk.content_block && anthropicChunk.content_block.type === 'text') {
          chunk.choices[0].delta.content = anthropicChunk.content_block.text || '';
        }
      } else if (anthropicChunk.type === 'message_delta') {
        if (anthropicChunk.stop_reason) {
          chunk.choices[0].finish_reason = this.mapAnthropicStopReason(anthropicChunk.stop_reason);
        }
      } else if (anthropicChunk.delta && anthropicChunk.delta.text) {
        chunk.choices[0].delta.content = anthropicChunk.delta.text;
      }
      
      return chunk;
      
    } catch (error) {
      logger.warn('ProxyManager', 'Failed to convert streaming chunk', {
        error: error.message,
        chunk: anthropicChunk,
        requestId
      });
      
      // Return minimal valid chunk
      return {
        id: `chatcmpl-${Date.now()}_error`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: this.smallModel || 'claude-3-haiku-20241022',
        choices: [{
          index: 0,
          delta: { content: '' },
          finish_reason: null
        }]
      };
    }
  }
}

// Cleanup on process termination
process.on('SIGTERM', async () => {
  logger.info('ProxyManager', 'Received SIGTERM, initiating graceful shutdown');
  if (global.proxyManagerInstance) {
    await global.proxyManagerInstance.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('ProxyManager', 'Received SIGINT, initiating graceful shutdown');
  if (global.proxyManagerInstance) {
    await global.proxyManagerInstance.stop();
  }
  process.exit(0);
});

module.exports = ProxyManager;
module.exports.ERROR_TYPES = ERROR_TYPES;
module.exports.CIRCUIT_STATES = CIRCUIT_STATES;
module.exports.CircuitBreaker = CircuitBreaker;