# Claude Code Proxy Pro

[简体中文](README.zh-CN.md) | [English](README.md) | [日本語](README.ja.md) | 繁體中文

Claude Code Proxy Pro 是一個高效的 Claude Code 代理工具，幫助開發者輕鬆配置和管理 Claude API 代理，支援多種模型和設定檔。

## 功能特色

- 🚀 **一鍵啟動**：簡潔介面，快速啟動代理服務
- 🔧 **多設定管理**：支援最多 10 個設定檔，輕鬆切換
- 🌐 **多語言支援**：支援簡體中文、英文、日文、繁體中文
- 🎨 **現代化介面**：精美的深色主題介面，流暢的互動體驗
- 🔒 **安全可靠**：加密儲存敏感資訊，完善的錯誤處理
- 🖥️ **跨平台支援**：支援 Windows、macOS 和 Linux
- 🔄 **自動更新**：內建自動更新機制
- 📊 **環境檢測**：自動檢測並安裝所需元件

## 系統需求

- Node.js 16.0 或更高版本
- Git
- 作業系統：Windows 10+、macOS 10.15+ 或 Linux

## 安裝

### 下載預先建置版本

造訪 [Releases](https://github.com/miounet11/claude-code-proxy-pro/releases) 頁面下載適合您平台的安裝套件：

- Windows：`.exe` 安裝程式
- macOS：`.dmg` 安裝程式
- Linux：`.AppImage` 或 `.deb` 安裝套件

### 從原始碼建置

```bash
# 複製儲存庫
git clone https://github.com/miounet11/claude-code-proxy-pro.git
cd claude-code-proxy-pro

# 安裝相依套件
npm install

# 啟動開發版本
npm start

# 建置安裝套件
npm run build
```

## 使用方法

1. **首次啟動**
   - 應用程式會自動檢查環境
   - 如需要會安裝缺少的元件

2. **設定代理**
   - 點擊「新增設定」建立新的設定
   - 輸入 API 位址、API 金鑰並選擇模型
   - 儲存設定

3. **啟動代理**
   - 選擇一個設定檔
   - 點擊「啟動代理」按鈕
   - 代理將在預設連接埠 8082 執行

4. **啟動 Claude Code**
   - 代理執行後，點擊「啟動 Claude Code」
   - 使用環境變數連接到代理

## 設定

### 環境變數

應用程式會自動設定以下環境變數：

```bash
export ANTHROPIC_BASE_URL=http://localhost:8082/v1
export ANTHROPIC_API_KEY=your-api-key
```

### 設定檔位置

設定檔儲存在：
- Windows：`%APPDATA%/claude-code-proxy-pro`
- macOS：`~/Library/Application Support/claude-code-proxy-pro`
- Linux：`~/.config/claude-code-proxy-pro`

## 開發

### 專案結構

```
claude-code-proxy-pro/
├── src/
│   ├── main/          # 主處理程序模組
│   ├── renderer/      # 渲染處理程序
│   └── preload/       # 預載腳本
├── public/            # 靜態資源
├── locales/           # 語言檔案
├── test/              # 測試檔案
└── scripts/           # 建置腳本
```

### 開發指令

```bash
# 啟動開發模式
npm run dev

# 執行測試
npm test

# 建置所有平台
npm run build:all

# 產生圖示
npm run icons
```

## 貢獻

歡迎貢獻！請隨時提交 Pull Request。

1. Fork 儲存庫
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 建立 Pull Request

## 授權

本專案採用 MIT 授權 - 檢視 [LICENSE](LICENSE) 檔案了解詳情。

## 致謝

- 基於 [Electron](https://www.electronjs.org/) 建置
- UI 設計靈感來自現代開發者工具
- 感謝所有貢獻者和使用者

## 支援

如果您遇到問題或有建議：
- 在 [GitHub Issues](https://github.com/miounet11/claude-code-proxy-pro/issues) 提交問題
- 聯絡信箱：support@claude-code-proxy.com