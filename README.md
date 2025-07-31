# Claude Code Proxy Pro

[简体中文](README.zh-CN.md) | English | [日本語](README.ja.md) | [繁體中文](README.zh-TW.md)

Claude Code Proxy Pro is an efficient Claude Code proxy tool that helps developers easily configure and manage Claude API proxies, supporting multiple models and configuration profiles.

## Features

- 🚀 **One-Click Start**: Simple interface for quick proxy service startup
- 🔧 **Multi-Profile Management**: Support up to 10 configuration profiles with easy switching
- 🌐 **Multi-Language Support**: Supports Simplified Chinese, English, Japanese, and Traditional Chinese
- 🎨 **Modern UI**: Beautiful dark theme interface with smooth interactions
- 🔒 **Secure and Reliable**: Encrypted storage of sensitive information with comprehensive error handling
- 🖥️ **Cross-Platform**: Supports Windows, macOS, and Linux
- 🔄 **Auto-Update**: Built-in automatic update mechanism
- 📊 **Environment Detection**: Automatically checks and installs required components

## System Requirements

- Node.js 16.0 or higher
- Git
- Operating System: Windows 10+, macOS 10.15+, or Linux

## Installation

### Download Pre-built Version

Visit the [Releases](https://github.com/miounet11/claude-code-proxy-pro/releases) page to download the installer for your platform:

- Windows: `.exe` installer
- macOS: `.dmg` installer
- Linux: `.AppImage` or `.deb` package

### Build from Source

```bash
# Clone repository
git clone https://github.com/miounet11/claude-code-proxy-pro.git
cd claude-code-proxy-pro

# Install dependencies
npm install

# Start development version
npm start

# Build for your platform
npm run build
```

## Usage

1. **First Launch**
   - The application will automatically check the environment
   - Install missing components if needed

2. **Configure Proxy**
   - Click "Add Profile" to create a new configuration
   - Enter API address, API key, and select models
   - Save configuration

3. **Start Proxy**
   - Select a configuration profile
   - Click "Start Proxy" button
   - The proxy will run on the default port 8082

4. **Start Claude Code**
   - After proxy is running, click "Start Claude Code"
   - Use environment variables to connect to the proxy

## Configuration

### Environment Variables

The application automatically sets the following environment variables:

```bash
export ANTHROPIC_BASE_URL=http://localhost:8082/v1
export ANTHROPIC_API_KEY=your-api-key
```

### Configuration File Structure

Configuration files are stored in:
- Windows: `%APPDATA%/claude-code-proxy-pro`
- macOS: `~/Library/Application Support/claude-code-proxy-pro`
- Linux: `~/.config/claude-code-proxy-pro`

## Development

### Project Structure

```
claude-code-proxy-pro/
├── src/
│   ├── main/          # Main process modules
│   ├── renderer/      # Renderer process
│   └── preload/       # Preload scripts
├── public/            # Static resources
├── locales/           # Language files
├── test/              # Test files
└── scripts/           # Build scripts
```

### Development Commands

```bash
# Start development mode
npm run dev

# Run tests
npm test

# Build for all platforms
npm run build:all

# Generate icons
npm run icons
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Electron](https://www.electronjs.org/)
- UI design inspired by modern developer tools
- Thanks to all contributors and users

## Support

If you encounter any issues or have suggestions:
- Submit an issue on [GitHub Issues](https://github.com/miounet11/claude-code-proxy-pro/issues)
- Contact: support@claude-code-proxy.com