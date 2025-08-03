class VSCodeTerminal {
    constructor() {
        this.terminals = {};
        this.activeTerminalId = null;
        this.terminalCounter = 0;

        this.initializeElements();
        this.setupEventListeners();
        this.createNewTerminal();
    }

    initializeElements() {
        this.container = document.getElementById('terminal-container');
        this.tabsContainer = this.container.querySelector('.terminal-tabs');
        this.contentContainer = this.container.querySelector('.terminal-content .terminal-grid');
        this.addTerminalButton = this.container.querySelector('.add-terminal-tab');
        this.splitTerminalButton = this.container.querySelector('.split-terminal');
    }

    setupEventListeners() {
        this.addTerminalButton.addEventListener('click', () => this.createNewTerminal());
        this.tabsContainer.addEventListener('click', (e) => this.handleTabClick(e));
        this.tabsContainer.addEventListener('click', (e) => this.handleTabClose(e));
        this.splitTerminalButton.addEventListener('click', () => this.splitTerminal());
    }

    createNewTerminal() {
        this.terminalCounter++;
        const terminalId = this.terminalCounter;
        
        // Create terminal tab
        const tab = document.createElement('div');
        tab.classList.add('terminal-tab');
        tab.dataset.terminalId = terminalId;
        tab.innerHTML = `<span>Terminal ${terminalId}</span><button class="close-tab">&times;</button>`;
        this.tabsContainer.insertBefore(tab, this.addTerminalButton);

        // Create terminal wrapper
        const terminalWrapper = document.createElement('div');
        terminalWrapper.classList.add('terminal-wrapper');
        terminalWrapper.dataset.terminalId = terminalId;
        terminalWrapper.id = `terminal-${terminalId}`;
        this.contentContainer.appendChild(terminalWrapper);

        // Initialize xterm terminal
        const term = new Terminal({
            convertEol: true,
            scrollback: 1000,
            disableStdin: false,
            cursorBlink: true
        });
        term.open(terminalWrapper);
        term.resize(120, 30);

        // Store terminal reference
        this.terminals[terminalId] = {
            element: terminalWrapper,
            tab: tab,
            term: term
        };

        // Activate the new terminal
        this.activateTerminal(terminalId);
    }

    activateTerminal(terminalId) {
        // Deactivate current active terminals
        document.querySelectorAll('.terminal-tab.active').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.terminal-wrapper.active').forEach(wrapper => wrapper.classList.remove('active'));

        // Activate new terminal
        const terminalData = this.terminals[terminalId];
        terminalData.tab.classList.add('active');
        terminalData.element.classList.add('active');
        this.activeTerminalId = terminalId;

        // Focus the terminal
        terminalData.term.focus();
    }

    handleTabClick(e) {
        const tab = e.target.closest('.terminal-tab');
        if (tab && !e.target.classList.contains('close-tab')) {
            const terminalId = tab.dataset.terminalId;
            this.activateTerminal(terminalId);
        }
    }

    handleTabClose(e) {
        if (e.target.classList.contains('close-tab')) {
            const tab = e.target.closest('.terminal-tab');
            const terminalId = tab.dataset.terminalId;
            this.closeTerminal(terminalId);
        }
    }

    closeTerminal(terminalId) {
        const terminalData = this.terminals[terminalId];
        
        // Remove tab and terminal wrapper
        terminalData.tab.remove();
        terminalData.element.remove();

        // Destroy terminal
        terminalData.term.dispose();

        // Delete terminal data
        delete this.terminals[terminalId];

        // Activate last terminal if available
        const remainingTerminalIds = Object.keys(this.terminals);
        if (remainingTerminalIds.length > 0) {
            this.activateTerminal(remainingTerminalIds[remainingTerminalIds.length - 1]);
        }
    }

    splitTerminal() {
        if (!this.activeTerminalId) return;

        const currentTerminal = this.terminals[this.activeTerminalId];
        const terminalId = ++this.terminalCounter;

        // Modify grid layout
        this.contentContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';

        // Create new terminal wrapper
        const terminalWrapper = document.createElement('div');
        terminalWrapper.classList.add('terminal-wrapper', 'active');
        terminalWrapper.dataset.terminalId = terminalId;
        terminalWrapper.id = `terminal-${terminalId}`;
        this.contentContainer.appendChild(terminalWrapper);

        // Initialize new xterm terminal
        const term = new Terminal({
            convertEol: true,
            scrollback: 1000,
            disableStdin: false,
            cursorBlink: true
        });
        term.open(terminalWrapper);
        term.resize(60, 30);

        // Store terminal reference
        this.terminals[terminalId] = {
            element: terminalWrapper,
            term: term
        };

        // Optionally, you could split the current terminal's session here
    }
}

// Terminal backend communication
class TerminalBackend {
    constructor() {
        this.terminals = {};
    }

    async createTerminal(terminalId) {
        try {
            const response = await window.electronAPI.createTerminal();
            this.terminals[terminalId] = response;
            return response;
        } catch (error) {
            console.error('Terminal creation failed:', error);
            throw error;
        }
    }

    async writeToTerminal(terminalId, data) {
        try {
            await window.electronAPI.writeToTerminal(this.terminals[terminalId], data);
        } catch (error) {
            console.error('Writing to terminal failed:', error);
        }
    }

    async closeTerminal(terminalId) {
        try {
            await window.electronAPI.closeTerminal(this.terminals[terminalId]);
            delete this.terminals[terminalId];
        } catch (error) {
            console.error('Closing terminal failed:', error);
        }
    }
}

// Extend VSCodeTerminal to integrate with backend
class ExtendedVSCodeTerminal extends VSCodeTerminal {
    constructor() {
        super();
        this.terminalBackend = new TerminalBackend();
    }

    async createNewTerminal() {
        const terminalId = this.terminalCounter;
        super.createNewTerminal();
        
        try {
            const backendTerminalId = await this.terminalBackend.createTerminal(terminalId);
            
            // Attach event listeners for terminal interaction
            const terminal = this.terminals[terminalId].term;
            terminal.onData(data => {
                this.terminalBackend.writeToTerminal(terminalId, data);
            });
        } catch (error) {
            console.error('Backend terminal creation failed:', error);
        }
    }

    closeTerminal(terminalId) {
        super.closeTerminal(terminalId);
        this.terminalBackend.closeTerminal(terminalId);
    }
}

// Initialize the VSCode-style terminal when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.vscodeTerminal = new ExtendedVSCodeTerminal();
});