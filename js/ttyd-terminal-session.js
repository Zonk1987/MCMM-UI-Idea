export class TtydTerminalSession {
  constructor(terminal, connection, onDisconnect = () => {}) {
    this.terminal = terminal;
    this.connection = connection;
    this.onDisconnect = onDisconnect;
    this.encoder = new TextEncoder();
    this.socket = null;
    this.inputSubscription = null;
    this.resizeSubscription = null;
    this.closed = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(this.connection.url, ['tty']);
      let connected = false;
      this.socket = socket;
      socket.binaryType = 'arraybuffer';
      socket.addEventListener('open', () => {
        connected = true;
        socket.send(
          this.encoder.encode(
            JSON.stringify({
              AuthToken: this.connection.token,
              columns: this.terminal.cols,
              rows: this.terminal.rows,
            })
          )
        );
        this.bindTerminal();
        resolve();
      });
      socket.addEventListener('message', (event) => this.receive(event));
      socket.addEventListener('error', () => {
        if (!connected) reject(new Error('Unable to connect to the Unraid terminal'));
      });
      socket.addEventListener('close', () => {
        if (!connected && !this.closed) reject(new Error('Unraid closed the terminal connection'));
        if (connected && !this.closed) this.onDisconnect();
      });
    });
  }

  bindTerminal() {
    if (this.connection.writable) {
      this.inputSubscription = this.terminal.onData((data) => this.send('0', data));
    }
    this.resizeSubscription = this.terminal.onResize(({ cols, rows }) => {
      this.send('1', JSON.stringify({ columns: cols, rows }));
    });
  }

  async receive(event) {
    const buffer = event.data instanceof Blob ? await event.data.arrayBuffer() : event.data;
    const bytes = new Uint8Array(buffer);
    if (bytes.length === 0) return;
    const command = String.fromCharCode(bytes[0]);
    if (command === '0') this.terminal.write(bytes.subarray(1));
  }

  send(command, data = '') {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(this.encoder.encode(command + data));
  }

  resize() {
    this.send('1', JSON.stringify({ columns: this.terminal.cols, rows: this.terminal.rows }));
  }

  dispose() {
    this.closed = true;
    this.inputSubscription?.dispose();
    this.resizeSubscription?.dispose();
    this.inputSubscription = null;
    this.resizeSubscription = null;
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) this.socket.close();
    this.socket = null;
  }
}
