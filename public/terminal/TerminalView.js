class TerminalView {
  constructor(container, terminalId) {
    this.container = container;
    this.terminalId = terminalId;
    this.terminal = null;
    this.fitAddon = null;
    this.searchAddon = null;
    this.webLinksAddon = null;
    this.isConnected = false;
    
    this.initialize();
  }

  async initialize() {
    // Import required modules
    const { Terminal } = require('@xterm/xterm');
    const { FitAddon } = require('@xterm/addon-fit');
    const { SearchAddon } = require('@xterm/addon-search');
    const { WebLinksAddon } = require('@xterm/addon-web-links');

    // Create terminal instance with VS Code-like theme
    this.terminal = new Terminal({
      theme: {
        foreground: '#cccccc',
        background: '#1e1e1e',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      tabStopWidth: 8,
      windowsMode: process.platform === 'win32'
    });

    // Load addons
    this.fitAddon = new FitAddon();
    this.searchAddon = new SearchAddon();
    this.webLinksAddon = new WebLinksAddon();
    
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.loadAddon(this.searchAddon);
    this.terminal.loadAddon(this.webLinksAddon);

    // Custom link handler for file paths
    this.terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const links = this.detectFileLinks(bufferLineNumber);
        callback(links);
      }
    });

    // Open terminal in container
    this.terminal.open(this.container);
    this.fitAddon.fit();

    // Setup event handlers
    this.setupEventHandlers();
    
    // Connect to backend
    await this.connect();
  }

  setupEventHandlers() {
    // Handle terminal input
    this.terminal.onData((data) => {
      if (this.isConnected) {
        window.electronAPI.sendTerminalInput(this.terminalId, data);
      }
    });

    // Handle selection for copy
    this.terminal.onSelectionChange(() => {
      const selection = this.terminal.getSelection();
      if (selection && window.electronAPI.copyToClipboard) {
        // Auto-copy on selection if enabled
        // TODO: Check user preference
        window.electronAPI.copyToClipboard(selection);
      }
    });

    // Handle resize
    this.terminal.onResize(({ cols, rows }) => {
      if (this.isConnected) {
        window.electronAPI.resizeTerminal(this.terminalId, cols, rows);
      }
    });

    // Handle title change
    this.terminal.onTitleChange((title) => {
      this.onTitleChange?.(title);
    });
  }

  async connect() {
    try {
      // Subscribe to terminal data
      window.electronAPI.onTerminalData(this.terminalId, (event, data) => {
        this.terminal.write(data);
      });

      // Subscribe to terminal events
      window.electronAPI.onTerminalEvent(this.terminalId, (event, eventData) => {
        this.handleTerminalEvent(eventData);
      });

      this.isConnected = true;
      
      // Send initial size
      const { cols, rows } = this.terminal;
      window.electronAPI.resizeTerminal(this.terminalId, cols, rows);
    } catch (error) {
      console.error('Failed to connect terminal:', error);
    }
  }

  handleTerminalEvent(event) {
    switch (event.type) {
      case 'command-start':
        this.addCommandDecoration('start');
        break;
      case 'command-end':
        this.addCommandDecoration('end', event.exitCode);
        break;
      case 'cwd-change':
        this.currentDirectory = event.cwd;
        break;
    }
  }

  addCommandDecoration(type, exitCode = 0) {
    // Add visual indicators for command execution
    const marker = this.terminal.registerMarker(0);
    if (marker) {
      const decoration = this.terminal.registerDecoration({
        marker,
        width: 2,
        layer: 'top'
      });

      if (decoration) {
        decoration.onRender((element) => {
          element.style.backgroundColor = type === 'start' ? '#007ACC' : 
                                         exitCode === 0 ? '#0dbc79' : '#cd3131';
          element.style.borderRadius = '50%';
          element.style.width = '8px';
          element.style.height = '8px';
          element.style.left = '2px';
          element.style.top = '50%';
          element.style.transform = 'translateY(-50%)';
        });
      }
    }
  }

  detectFileLinks(bufferLineNumber) {
    const links = [];
    const line = this.terminal.buffer.active.getLine(bufferLineNumber);
    if (!line) return links;

    const text = line.translateToString();
    
    // Detect file paths (simplified regex)
    const filePathRegex = /(?:[a-zA-Z]:)?(?:\/|\\)?(?:[^\/\\\s]+(?:\/|\\))*[^\/\\\s]+\.[a-zA-Z]+/g;
    let match;
    
    while ((match = filePathRegex.exec(text)) !== null) {
      links.push({
        range: {
          start: { x: match.index + 1, y: bufferLineNumber + 1 },
          end: { x: match.index + match[0].length + 1, y: bufferLineNumber + 1 }
        },
        text: match[0],
        activate: (event, text) => {
          // Send file open request to main process
          window.electronAPI.openFile(text);
        }
      });
    }

    return links;
  }

  // Public methods
  focus() {
    this.terminal.focus();
  }

  clear() {
    this.terminal.clear();
  }

  paste(text) {
    this.terminal.paste(text);
  }

  findNext(searchTerm) {
    this.searchAddon.findNext(searchTerm);
  }

  findPrevious(searchTerm) {
    this.searchAddon.findPrevious(searchTerm);
  }

  resize() {
    this.fitAddon.fit();
  }

  dispose() {
    this.isConnected = false;
    this.terminal.dispose();
  }

  // Getters
  get cols() {
    return this.terminal.cols;
  }

  get rows() {
    return this.terminal.rows;
  }

  getSelection() {
    return this.terminal.getSelection();
  }
}

module.exports = TerminalView;