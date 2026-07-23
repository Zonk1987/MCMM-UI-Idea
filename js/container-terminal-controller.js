import { loadXterm } from './xterm-loader.js';
import { UnraidTerminalGateway } from './unraid-terminal-gateway.js?v=17';
import { TtydTerminalSession } from './ttyd-terminal-session.js?v=17';

export class ContainerTerminalController {
  constructor(gateway = new UnraidTerminalGateway()) {
    this.gateway = gateway;
    this.terminal = null;
    this.fitAddon = null;
    this.session = null;
    this.observer = null;
    this.element = null;
    this.container = null;
    this.mode = 'logs';
    this.generation = 0;
    this.resizeHandler = () => this.fit();
  }

  async open(element, container, mode) {
    const generation = ++this.generation;
    this.release();
    await loadXterm();
    if (generation !== this.generation) return;
    this.element = element;
    this.container = container;
    this.mode = mode;
    this.terminal = new window.Terminal({
      theme: {
        foreground: '#d2d2d2',
        background: '#2b2b2b',
        cursor: '#adadad',
        black: '#000000',
        red: '#d81e00',
        green: '#5ea702',
        yellow: '#cfae00',
        blue: '#427ab3',
        magenta: '#89658e',
        cyan: '#00a7aa',
        white: '#dbded8',
        brightBlack: '#686a66',
        brightRed: '#f54235',
        brightGreen: '#99e343',
        brightYellow: '#fdeb61',
        brightBlue: '#84b0d8',
        brightMagenta: '#bc94b7',
        brightCyan: '#37e6e8',
        brightWhite: '#f1f1f0',
      },
      fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
      fontSize: 13,
      cursorBlink: mode === 'console',
      disableStdin: mode === 'logs',
      scrollback: mode === 'logs' ? 10000 : 5000,
    });
    this.fitAddon = new window.FitAddon.FitAddon();
    this.terminal.loadAddon(this.fitAddon);
    this.terminal.open(element);
    this.observer = new ResizeObserver(this.resizeHandler);
    this.observer.observe(element);
    window.addEventListener('resize', this.resizeHandler);
    this.scheduleFit();
    const connection = await this.gateway.start(container, mode);
    if (generation !== this.generation) return;
    this.fit();
    this.session = new TtydTerminalSession(this.terminal, connection, () => this.disconnected());
    await this.session.connect();
    if (mode === 'console') this.terminal.focus();
  }

  async refresh() {
    if (!this.element || !this.container) return;
    const element = this.element;
    const container = this.container;
    const mode = this.mode;
    await this.open(element, container, mode);
  }

  clear() {
    this.terminal?.clear();
  }

  fit() {
    if (!this.fitAddon || !this.terminal) return;
    try {
      this.fitAddon.fit();
      this.session?.resize();
    } catch {
      // The terminal may be detached while the modal is closing.
    }
  }

  scheduleFit() {
    requestAnimationFrame(() => requestAnimationFrame(() => this.fit()));
  }

  disconnected() {
    this.terminal?.writeln('\r\n\x1b[90m[Disconnected]\x1b[0m');
  }

  dispose() {
    this.generation += 1;
    this.release();
  }

  release() {
    window.removeEventListener('resize', this.resizeHandler);
    this.observer?.disconnect();
    this.session?.dispose();
    this.terminal?.dispose();
    this.observer = null;
    this.session = null;
    this.terminal = null;
    this.fitAddon = null;
  }
}
