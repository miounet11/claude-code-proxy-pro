const { ipcMain } = require('electron');
const axios = require('axios');
const { logger } = require('./logger');

/**
 * Claude API 管理器
 * 处理与 Claude API 的所有交互
 */
class ClaudeAPIManager {
    constructor() {
        this.activeRequests = new Map();
        this.setupIpcHandlers();
    }

    setupIpcHandlers() {
        // 发送消息到 Claude
        ipcMain.handle('claude:send-message', async (event, { message, model, apiKey, baseUrl }) => {
            try {
                const requestId = Date.now().toString();
                
                // 使用代理地址或直接地址
                const url = baseUrl || 'http://localhost:8082/v1';
                const key = apiKey || 'proxy-key';
                
                logger.info('ClaudeAPI', 'Sending message', { model, url });

                const response = await axios.post(
                    `${url}/messages`,
                    {
                        model: model || 'claude-3-haiku-20240307',
                        messages: [{ role: 'user', content: message }],
                        max_tokens: 4000,
                        stream: false
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': key,
                            'anthropic-version': '2023-06-01'
                        },
                        timeout: 60000
                    }
                );

                logger.info('ClaudeAPI', 'Response received');
                
                return {
                    success: true,
                    content: response.data.content[0].text,
                    model: response.data.model,
                    usage: response.data.usage
                };
            } catch (error) {
                logger.error('ClaudeAPI', 'Failed to send message', { 
                    error: error.message,
                    response: error.response?.data 
                });
                
                return {
                    success: false,
                    error: error.response?.data?.error?.message || error.message
                };
            }
        });

        // 流式响应
        ipcMain.handle('claude:stream-message', async (event, { message, model, apiKey, baseUrl }) => {
            try {
                const url = baseUrl || 'http://localhost:8082/v1';
                const key = apiKey || 'proxy-key';
                
                logger.info('ClaudeAPI', 'Starting stream', { model, url });

                const response = await axios.post(
                    `${url}/messages`,
                    {
                        model: model || 'claude-3-haiku-20240307',
                        messages: [{ role: 'user', content: message }],
                        max_tokens: 4000,
                        stream: true
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': key,
                            'anthropic-version': '2023-06-01'
                        },
                        responseType: 'stream',
                        timeout: 60000
                    }
                );

                // 处理流式响应
                response.data.on('data', (chunk) => {
                    const lines = chunk.toString().split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') {
                                event.sender.send('claude:stream-end');
                            } else {
                                try {
                                    const parsed = JSON.parse(data);
                                    event.sender.send('claude:stream-data', parsed);
                                } catch (e) {
                                    // 忽略解析错误
                                }
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    event.sender.send('claude:stream-end');
                });

                response.data.on('error', (error) => {
                    event.sender.send('claude:stream-error', error.message);
                });

                return { success: true, message: 'Stream started' };
            } catch (error) {
                logger.error('ClaudeAPI', 'Failed to start stream', { 
                    error: error.message 
                });
                
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        // 验证 API Key
        ipcMain.handle('claude:validate-key', async (event, { apiKey, baseUrl }) => {
            try {
                const url = baseUrl || 'http://localhost:8082/v1';
                
                const response = await axios.post(
                    `${url}/messages`,
                    {
                        model: 'claude-3-haiku-20240307',
                        messages: [{ role: 'user', content: 'test' }],
                        max_tokens: 10
                    },
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': apiKey,
                            'anthropic-version': '2023-06-01'
                        },
                        timeout: 5000
                    }
                );

                return { valid: true };
            } catch (error) {
                if (error.response?.status === 401) {
                    return { valid: false, error: 'Invalid API key' };
                }
                return { valid: false, error: error.message };
            }
        });

        // 获取可用模型列表
        ipcMain.handle('claude:get-models', () => {
            return {
                models: [
                    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: '最强大的模型' },
                    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', description: '平衡性能' },
                    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: '快速响应' },
                    { id: 'claude-2.1', name: 'Claude 2.1', description: '上一代模型' },
                    { id: 'claude-2.0', name: 'Claude 2.0', description: '上一代模型' },
                    { id: 'claude-instant-1.2', name: 'Claude Instant', description: '即时响应' }
                ]
            };
        });
    }
}

module.exports = ClaudeAPIManager;