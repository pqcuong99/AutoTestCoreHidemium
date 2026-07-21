/**
 * WebSocket client toi thieu (chi text frame) — dung cho CDP.
 * Electron 33 / Node 20 khong co global WebSocket -> tu implement.
 */
const net = require('net');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class WsClient extends EventEmitter {
  constructor(socket) {
    super();
    this.socket = socket;
    this._buf = Buffer.alloc(0);
    this._closed = false;
    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('error', (err) => this.emit('error', err));
    socket.on('close', () => {
      this._closed = true;
      this.emit('close');
    });
  }

  send(text) {
    if (this._closed) throw new Error('WebSocket da dong');
    const payload = Buffer.from(String(text), 'utf8');
    const mask = crypto.randomBytes(4);
    const len = payload.length;
    let header;

    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x81; // FIN + text
      header[1] = 0x80 | len; // MASK + len
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x81;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x81;
      header[1] = 0x80 | 127;
      header.writeUInt32BE(0, 2);
      header.writeUInt32BE(len, 6);
    }

    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([header, mask, masked]));
  }

  close() {
    if (this._closed) return;
    try {
      this.socket.end();
    } catch {
      /* ignore */
    }
    this._closed = true;
  }

  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    while (this._buf.length >= 2) {
      const b0 = this._buf[0];
      const b1 = this._buf[1];
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;

      if (len === 126) {
        if (this._buf.length < 4) return;
        len = this._buf.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this._buf.length < 10) return;
        len = Number(this._buf.readBigUInt64BE(2));
        offset = 10;
      }

      const maskLen = masked ? 4 : 0;
      if (this._buf.length < offset + maskLen + len) return;

      let payload = this._buf.subarray(offset + maskLen, offset + maskLen + len);
      if (masked) {
        const mask = this._buf.subarray(offset, offset + 4);
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ mask[i % 4];
        payload = out;
      }

      this._buf = this._buf.subarray(offset + maskLen + len);

      if (opcode === 0x8) {
        this.close();
        return;
      }
      if (opcode === 0x9) {
        // ping -> pong
        const pong = Buffer.alloc(2 + payload.length);
        pong[0] = 0x8a;
        pong[1] = payload.length;
        payload.copy(pong, 2);
        this.socket.write(pong);
        continue;
      }
      if (opcode === 0x1) {
        this.emit('message', payload.toString('utf8'));
      }
    }
  }
}

/**
 * @param {string} wsUrl  vd ws://127.0.0.1:9222/devtools/browser/...
 * @returns {Promise<WsClient>}
 */
function connectWs(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString('base64');
    const path = (u.pathname || '/') + (u.search || '');
    const port = Number(u.port) || (u.protocol === 'wss:' ? 443 : 80);
    const host = u.hostname;

    const socket = net.connect({ host, port }, () => {
      socket.write(
        `GET ${path} HTTP/1.1\r\n` +
          `Host: ${host}:${port}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          `Sec-WebSocket-Version: 13\r\n` +
          `\r\n`
      );
    });

    let settled = false;
    let headerBuf = Buffer.alloc(0);

    const fail = (err) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      reject(err);
    };

    socket.on('error', fail);
    socket.on('data', onHead);

    function onHead(chunk) {
      headerBuf = Buffer.concat([headerBuf, chunk]);
      const idx = headerBuf.indexOf('\r\n\r\n');
      if (idx < 0) return;

      const head = headerBuf.subarray(0, idx).toString('utf8');
      const rest = headerBuf.subarray(idx + 4);
      socket.removeListener('data', onHead);

      if (!/^HTTP\/1\.1 101/i.test(head)) {
        return fail(new Error('WS upgrade that bai: ' + head.split('\r\n')[0]));
      }

      settled = true;
      const ws = new WsClient(socket);
      if (rest.length) ws._onData(rest);
      resolve(ws);
    }
  });
}

module.exports = { connectWs, WsClient };
