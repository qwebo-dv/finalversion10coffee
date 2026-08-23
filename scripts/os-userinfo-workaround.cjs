/* eslint-disable @typescript-eslint/no-require-imports */

if (typeof process.geteuid !== "function") {
  process.geteuid = () => 0
}

// Next.js resolves `server-only` internally, while the standalone tsx runner
// used by local integration tests does not. Map it to an empty test sentinel.
const Module = require("node:module")
const path = require("node:path")
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(__dirname, "server-only-stub.cjs")
  return originalResolveFilename.call(this, request, ...args)
}
