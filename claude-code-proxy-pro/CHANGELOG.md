# Changelog

All notable changes to Claude Code Proxy Pro will be documented in this file.

## [3.3.1] - 2025-07-31

### Security Fixes 🔒
- **Critical**: Removed hardcoded API keys from source code
- **Critical**: Fixed path traversal vulnerabilities with new PathValidator
- Enhanced security for file operations across the application
- Improved input validation and sanitization

### Bug Fixes 🐛
- Fixed environment detection commands for Node.js and Claude Code
- Fixed "dialog module can only be used after app is ready" startup error
- Fixed manager initialization timing issues
- Improved Windows terminal command escaping
- Added missing uuid dependency

### Improvements 🚀
- Added comprehensive security validation for all file paths
- Enhanced error handling with proper app lifecycle management
- Improved cross-platform compatibility
- Better logging security (no more sensitive data in logs)

### Phase 1 Completion 🎯
This release marks the completion of Phase 1 development with:
- Core proxy functionality stable and secure
- Multi-language support (Chinese, English, Japanese, Traditional Chinese)
- Environment auto-detection and installation
- Cross-platform packaging (Windows, macOS, Linux)

## [3.0.1] - 2025-07-31

### Critical Fixes
- 🐛 Fixed 404 error in auto-updater by correcting repository URL
- 🔧 Enhanced cross-platform compatibility for Windows, macOS, and Linux
- 🛡️ Added comprehensive error handling in proxy manager
- 📦 Improved environment detection with platform-specific PATH extensions
- ⚡ Added request tracking and timeout controls
- 🔄 Implemented graceful shutdown mechanism
- 🌐 Enhanced OpenAI to Anthropic format conversion stability

### Added
- 🔐 Circuit breaker pattern for preventing cascade failures
- 📊 Health monitoring and metrics endpoints (/health, /metrics)
- 🎯 Request ID tracking for better debugging
- ⏱️ Configurable timeouts with AbortController
- 🔄 Smart retry mechanism with exponential backoff
- 🧪 Platform-specific environment installation commands

### Improved
- 💪 Robust error categorization (timeout, connection, auth, server errors)
- 🚀 Connection pool management with Keep-Alive
- 📝 Enhanced structured logging
- 🛡️ Better handling of edge cases in streaming responses
- 🔍 Detailed error messages with recovery suggestions

## [2.0.1] - 2025-07-31

### Added
- 🌐 Multi-language support (Simplified Chinese, English, Japanese, Traditional Chinese)
- 🎨 Language selector in the sidebar
- 📚 Multilingual README files
- 🚀 GitHub Actions for automated multi-platform releases
- 🔧 CI/CD pipelines for testing and building

### Changed
- 📦 Updated repository information in package.json
- 🗑️ Removed obsolete documentation and test files
- 🎯 Streamlined project structure

### Fixed
- 🔧 Build process for all platforms
- 📱 Icon generation issues

## [2.0.0] - 2024-07-30

### Added
- ✨ Initial release of Claude Code Proxy Pro
- 🔧 Environment auto-detection and installation
- 🌐 Smart proxy management with automatic port allocation
- 🎨 Modern dark theme UI
- ⚡ Minimal implementation (~400 lines of core code)
- 🔒 Secure and reliable error handling
- 📊 Multi-profile management (up to 10 profiles)
- 🔄 Automatic update mechanism

### Features
- One-click environment setup for Node.js, Git, UV, and Claude Code
- API proxy with support for multiple AI models
- Cross-platform support (Windows, macOS, Linux)
- Real-time configuration preview
- Export scripts for manual setup