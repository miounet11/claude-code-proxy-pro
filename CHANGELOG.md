# Changelog

All notable changes to Claude Code Proxy Pro will be documented in this file.

## [3.3.6] - 2025-08-01

### Fixed
- 🎨 Optimized layout to prevent scrolling - reduced spacing and padding throughout
- 📐 Decreased toolbar height from 64px to 48px for better screen utilization
- 🔲 Reduced button and input heights from 40px to 32px
- 🐛 Fixed environment detection display error (claudeCode status ID mapping)
- 🚪 Fixed modal close functionality - added proper event handlers
- ⌨️ Added ESC key support to close modals

### Improved
- 📏 Adjusted spacing variables for more compact layout
- 🔤 Reduced font sizes from 14px to 13px for better density
- 📱 Better content fit without requiring scroll on standard screens
- 🎯 Removed duplicate showInstallGuide function definition

## [3.3.5] - 2025-08-01

### Added
- 🎹 Comprehensive keyboard shortcuts system (Ctrl+S save, Ctrl+T test, Ctrl+Enter start/stop)
- 🎯 Smart error handling with context-specific solutions
- 📊 Enhanced loading states with progress bars and operation-specific messages
- ♿ Full accessibility support with ARIA attributes and screen reader optimization
- 🔄 Form field real-time validation with visual feedback

### Improved
- ⚡ Visual feedback enhancements with animations and transitions
- 🎨 Modern UI design with gradient buttons and card layouts
- 📱 Better responsive design for mobile devices
- 🚀 Performance optimizations with GPU-accelerated animations
- 🛠️ Environment detection accuracy improvements

### Fixed
- 🐛 Environment detection command key mapping issue
- 🎯 Focus management and keyboard navigation
- 📝 Form validation and error display

## [3.3.4] - 2025-08-01

### Fixed
- 🎨 Generated proper macOS application icon (.icns)
- 🚀 Improved app startup performance
- 🛡️ Fixed auto-updater 404 errors with better error handling
- 🖼️ Added dark background to prevent white flash on startup

### Improved
- ⚡ Reduced dock icon bouncing time on macOS
- 📦 Complete application packaging with all required resources
- 🔧 Enhanced build configuration for better distribution

## [3.3.3] - 2025-07-31

### Added
- 🌍 Full multi-language support (English, Chinese Simplified, Chinese Traditional, Japanese)
- 🎨 Enhanced UI/UX with modern dark theme design
- 📱 Responsive layout optimized for different screen sizes
- 🔄 Dynamic language switching without restart
- 📊 Improved environment status visualization

### Improved
- ⚡ Optimized application startup performance
- 🛡️ Enhanced error handling with localized messages
- 📦 Updated dependencies to latest versions
- 🔧 Better cross-platform compatibility
- 🎯 Streamlined user interface for easier navigation

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