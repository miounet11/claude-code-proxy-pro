class TerminalTabs {
  constructor(container) {
    this.container = container;
    this.tabs = new Map();
    this.activeTabId = null;
    this.tabOrder = [];
    
    this.initialize();
  }

  initialize() {
    this.container.innerHTML = `
      <div class="terminal-tabs-container">
        <div class="terminal-tabs-header">
          <div class="terminal-tabs-list" id="terminal-tabs-list"></div>
          <div class="terminal-tabs-actions">
            <button class="terminal-action-btn" id="new-terminal-btn" title="New Terminal">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M8 2v12M2 8h12" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
            <button class="terminal-action-btn" id="split-terminal-btn" title="Split Terminal">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <rect fill="none" stroke="currentColor" x="2" y="2" width="12" height="12"/>
                <line stroke="currentColor" x1="8" y1="2" x2="8" y2="14"/>
              </svg>
            </button>
            <button class="terminal-action-btn" id="terminal-dropdown-btn" title="Terminal Menu">
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path fill="currentColor" d="M4 6l4 4 4-4z"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="terminal-tabs-content" id="terminal-tabs-content"></div>
      </div>
    `;

    this.setupStyles();
    this.setupEventHandlers();
  }

  setupStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .terminal-tabs-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: #1e1e1e;
      }

      .terminal-tabs-header {
        display: flex;
        background: #252526;
        border-bottom: 1px solid #3c3c3c;
        min-height: 35px;
      }

      .terminal-tabs-list {
        display: flex;
        flex: 1;
        overflow-x: auto;
        scrollbar-width: thin;
      }

      .terminal-tab {
        display: flex;
        align-items: center;
        padding: 0 12px;
        min-width: 120px;
        max-width: 240px;
        height: 35px;
        background: transparent;
        border-right: 1px solid #3c3c3c;
        cursor: pointer;
        user-select: none;
        position: relative;
      }

      .terminal-tab:hover {
        background: #2a2a2a;
      }

      .terminal-tab.active {
        background: #1e1e1e;
      }

      .terminal-tab-title {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #cccccc;
        font-size: 13px;
      }

      .terminal-tab-close {
        margin-left: 8px;
        padding: 2px;
        border-radius: 3px;
        opacity: 0;
        transition: opacity 0.2s;
      }

      .terminal-tab:hover .terminal-tab-close {
        opacity: 0.5;
      }

      .terminal-tab-close:hover {
        opacity: 1 !important;
        background: #5a5a5a;
      }

      .terminal-tabs-actions {
        display: flex;
        align-items: center;
        padding: 0 8px;
        gap: 4px;
      }

      .terminal-action-btn {
        padding: 4px;
        background: transparent;
        border: none;
        color: #cccccc;
        cursor: pointer;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .terminal-action-btn:hover {
        background: #3c3c3c;
      }

      .terminal-tabs-content {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .terminal-view-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: none;
      }

      .terminal-view-container.active {
        display: block;
      }

      .terminal-dropdown-menu {
        position: absolute;
        top: 35px;
        right: 8px;
        background: #252526;
        border: 1px solid #3c3c3c;
        border-radius: 3px;
        padding: 4px 0;
        min-width: 200px;
        z-index: 1000;
        display: none;
      }

      .terminal-dropdown-menu.show {
        display: block;
      }

      .terminal-menu-item {
        padding: 6px 12px;
        color: #cccccc;
        cursor: pointer;
        font-size: 13px;
      }

      .terminal-menu-item:hover {
        background: #2a2a2a;
      }

      .terminal-menu-separator {
        height: 1px;
        background: #3c3c3c;
        margin: 4px 0;
      }
    `;
    document.head.appendChild(style);
  }

  setupEventHandlers() {
    // New terminal button
    document.getElementById('new-terminal-btn').addEventListener('click', () => {
      this.createNewTerminal();
    });

    // Split terminal button
    document.getElementById('split-terminal-btn').addEventListener('click', () => {
      this.splitTerminal();
    });

    // Dropdown menu button
    const dropdownBtn = document.getElementById('terminal-dropdown-btn');
    dropdownBtn.addEventListener('click', () => {
      this.toggleDropdownMenu();
    });

    // Tab list delegation
    document.getElementById('terminal-tabs-list').addEventListener('click', (e) => {
      const tab = e.target.closest('.terminal-tab');
      if (tab) {
        const tabId = parseInt(tab.dataset.terminalId);
        
        if (e.target.closest('.terminal-tab-close')) {
          this.closeTerminal(tabId);
        } else {
          this.activateTab(tabId);
        }
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '`':
            if (e.shiftKey) {
              e.preventDefault();
              this.createNewTerminal();
            }
            break;
          case '\\':
            e.preventDefault();
            this.splitTerminal();
            break;
          case 'w':
            if (this.activeTabId !== null) {
              e.preventDefault();
              this.closeTerminal(this.activeTabId);
            }
            break;
        }
      }
    });
  }

  async createNewTerminal(options = {}) {
    try {
      // Request new terminal from backend
      const terminalInfo = await window.electronAPI.createTerminal(options);
      
      // Create tab
      this.addTab(terminalInfo);
      
      // Create terminal view
      const viewContainer = this.createViewContainer(terminalInfo.id);
      const terminalView = new TerminalView(viewContainer, terminalInfo.id);
      
      // Store tab info
      this.tabs.set(terminalInfo.id, {
        id: terminalInfo.id,
        title: terminalInfo.name,
        view: terminalView,
        container: viewContainer
      });
      
      // Activate new tab
      this.activateTab(terminalInfo.id);
      
      return terminalInfo.id;
    } catch (error) {
      console.error('Failed to create terminal:', error);
    }
  }

  addTab(terminalInfo) {
    const tabsList = document.getElementById('terminal-tabs-list');
    
    const tab = document.createElement('div');
    tab.className = 'terminal-tab';
    tab.dataset.terminalId = terminalInfo.id;
    tab.innerHTML = `
      <span class="terminal-tab-title">${terminalInfo.name}</span>
      <span class="terminal-tab-close">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path fill="currentColor" d="M7 5.586L11.293 1.293a1 1 0 111.414 1.414L8.414 7l4.293 4.293a1 1 0 01-1.414 1.414L7 8.414l-4.293 4.293a1 1 0 01-1.414-1.414L5.586 7 1.293 2.707a1 1 0 011.414-1.414L7 5.586z"/>
        </svg>
      </span>
    `;
    
    tabsList.appendChild(tab);
    this.tabOrder.push(terminalInfo.id);
  }

  createViewContainer(terminalId) {
    const content = document.getElementById('terminal-tabs-content');
    
    const container = document.createElement('div');
    container.className = 'terminal-view-container';
    container.dataset.terminalId = terminalId;
    
    content.appendChild(container);
    
    return container;
  }

  activateTab(terminalId) {
    // Deactivate current tab
    if (this.activeTabId !== null) {
      const currentTab = document.querySelector(`.terminal-tab[data-terminal-id="${this.activeTabId}"]`);
      const currentContainer = document.querySelector(`.terminal-view-container[data-terminal-id="${this.activeTabId}"]`);
      
      if (currentTab) currentTab.classList.remove('active');
      if (currentContainer) currentContainer.classList.remove('active');
    }
    
    // Activate new tab
    const newTab = document.querySelector(`.terminal-tab[data-terminal-id="${terminalId}"]`);
    const newContainer = document.querySelector(`.terminal-view-container[data-terminal-id="${terminalId}"]`);
    
    if (newTab) newTab.classList.add('active');
    if (newContainer) newContainer.classList.add('active');
    
    this.activeTabId = terminalId;
    
    // Focus terminal
    const tabInfo = this.tabs.get(terminalId);
    if (tabInfo) {
      tabInfo.view.focus();
    }
  }

  async closeTerminal(terminalId) {
    const tabInfo = this.tabs.get(terminalId);
    if (!tabInfo) return;
    
    // Kill terminal process
    await window.electronAPI.killTerminal(terminalId);
    
    // Dispose terminal view
    tabInfo.view.dispose();
    
    // Remove tab and container
    const tab = document.querySelector(`.terminal-tab[data-terminal-id="${terminalId}"]`);
    const container = document.querySelector(`.terminal-view-container[data-terminal-id="${terminalId}"]`);
    
    if (tab) tab.remove();
    if (container) container.remove();
    
    // Remove from tracking
    this.tabs.delete(terminalId);
    this.tabOrder = this.tabOrder.filter(id => id !== terminalId);
    
    // Activate another tab if this was active
    if (this.activeTabId === terminalId) {
      this.activeTabId = null;
      if (this.tabOrder.length > 0) {
        this.activateTab(this.tabOrder[this.tabOrder.length - 1]);
      }
    }
  }

  splitTerminal() {
    // TODO: Implement split terminal view
    console.log('Split terminal not yet implemented');
  }

  toggleDropdownMenu() {
    let menu = document.querySelector('.terminal-dropdown-menu');
    
    if (!menu) {
      menu = this.createDropdownMenu();
      this.container.appendChild(menu);
    }
    
    menu.classList.toggle('show');
    
    // Close menu when clicking outside
    if (menu.classList.contains('show')) {
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && !document.getElementById('terminal-dropdown-btn').contains(e.target)) {
          menu.classList.remove('show');
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }
  }

  createDropdownMenu() {
    const menu = document.createElement('div');
    menu.className = 'terminal-dropdown-menu';
    
    menu.innerHTML = `
      <div class="terminal-menu-item" data-action="select-default-profile">Select Default Profile...</div>
      <div class="terminal-menu-separator"></div>
      <div class="terminal-menu-item" data-action="configure-profiles">Configure Terminal Profiles...</div>
      <div class="terminal-menu-separator"></div>
      <div class="terminal-menu-item" data-action="clear-all">Clear All Terminals</div>
      <div class="terminal-menu-item" data-action="kill-all">Kill All Terminals</div>
    `;
    
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.terminal-menu-item');
      if (item) {
        const action = item.dataset.action;
        this.handleMenuAction(action);
        menu.classList.remove('show');
      }
    });
    
    return menu;
  }

  handleMenuAction(action) {
    switch (action) {
      case 'select-default-profile':
        this.selectDefaultProfile();
        break;
      case 'configure-profiles':
        this.configureProfiles();
        break;
      case 'clear-all':
        this.clearAllTerminals();
        break;
      case 'kill-all':
        this.killAllTerminals();
        break;
    }
  }

  async selectDefaultProfile() {
    const profiles = await window.electronAPI.getTerminalProfiles();
    // TODO: Show profile selection dialog
    console.log('Available profiles:', profiles);
  }

  configureProfiles() {
    // TODO: Open profile configuration
    console.log('Configure profiles');
  }

  clearAllTerminals() {
    for (const [id, tabInfo] of this.tabs) {
      tabInfo.view.clear();
    }
  }

  async killAllTerminals() {
    const ids = Array.from(this.tabs.keys());
    for (const id of ids) {
      await this.closeTerminal(id);
    }
  }
}

module.exports = TerminalTabs;