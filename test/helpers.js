import http from "node:http";
import { EventEmitter } from "node:events";

/** A tiny fake OpenAI upstream. handler(req, res, bodyText). */
export async function fakeUpstream(handler) {
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => handler(req, res, Buffer.concat(chunks).toString("utf8")));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
      }),
  };
}

export function provider(id, url, models, extra = {}) {
  return {
    id,
    label: id,
    baseUrl: url,
    key: "",
    keyless: true,
    enabled: true,
    hasKey: false,
    models: models.map((m) => ({ providerId: id, keyless: true, ...m })),
    ...extra,
  };
}

export const testCfg = (over = {}) => ({
  enhance: true,
  cleanOutput: true,
  race: 1,
  bestOf: 1,
  maxAttempts: 3,
  requestTimeoutMs: 5000,
  firstByteTimeoutMs: 2000,
  maxBodyBytes: 1_000_000,
  token: "",
  routing: { preferKeyless: true, sticky: true, longContextTokens: 24000 },
  ...over,
});

export class MockRes extends EventEmitter {
  constructor() {
    super();
    this.status = 0;
    this.headers = {};
    this.chunks = [];
    this.ended = false;
  }
  writeHead(status, headers = {}) {
    this.status = status;
    Object.assign(this.headers, headers);
    return this;
  }
  write(chunk) {
    if (chunk !== undefined) this.chunks.push(Buffer.from(chunk));
    return true;
  }
  end(chunk) {
    if (chunk !== undefined) this.chunks.push(Buffer.from(chunk));
    this.ended = true;
    return this;
  }
  body() {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}
