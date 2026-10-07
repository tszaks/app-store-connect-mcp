// Vercel entry: every path is rewritten here (see vercel.json).
import { createApiFromEnv } from '../dist/http/app.js';

let handle;

export default {
  async fetch(request) {
    try {
      handle ??= createApiFromEnv();
    } catch (e) {
      // Missing env vars: answer clearly instead of crashing the function.
      return Response.json({ ok: false, error: `Server not configured: ${e.message}` }, { status: 500 });
    }
    return handle(request);
  },
};
