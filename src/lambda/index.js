const MAX_PROMPT_CHARS = 2000;
const LEGACY_ACTION_HEALTH = 1001;
const LEGACY_ACTION_OPS = 1002;
const LEGACY_ACTION_COMPLETE = 1003;

function jsonResponse(statusCode, payload, requestId, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  };
}

function legacyJsonResponse(payload) {
  return {
    statusCode: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(payload),
  };
}

function legacyHtmlError() {
  return {
    statusCode: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
    body: "<html><body>Error</body></html>",
  };
}

function safeJsonParse(input) {
  if (!input) {
    return {};
  }

  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function compactTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes()),
    pad(date.getUTCSeconds()),
  ].join("");
}

function headerValue(headers, name) {
  if (!headers) {
    return "";
  }

  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match ? String(match[1] || "").trim() : "";
}

function buildMockCompletion(prompt) {
  const completionText = `Mock completion for: ${prompt.slice(0, 250)}`;
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(completionText.length / 4);

  return {
    id: `mock-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    completionText,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}

function buildToolCatalog(baseUrl) {
  return {
    version: "1.0",
    description: "Mock tool catalog for AI agents",
    tools: [
      {
        name: "health_check",
        method: "GET",
        path: "/v1/health",
        description: "Returns service health and timestamp.",
      },
      {
        name: "mock_completion",
        method: "POST",
        path: "/v1/agent/mock",
        description:
          "Returns a deterministic mock completion for agent integration tests.",
        input_schema: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: {
              type: "string",
              maxLength: MAX_PROMPT_CHARS,
            },
            metadata: {
              type: "object",
            },
          },
        },
      },
    ],
    links: {
      self: `${baseUrl}/v1/agent/tools`,
      health: `${baseUrl}/v1/health`,
      mock: `${baseUrl}/v1/agent/mock`,
    },
  };
}

function legacyParam(payload, key) {
  const params = payload?.d?.ParamList;
  if (!Array.isArray(params)) {
    return "";
  }

  const match = params.find((item) => item?.Key === key);
  return String(match?.Val ?? "").trim();
}

function handleAgentHealth(requestId) {
  return jsonResponse(
    200,
    {
      status: "ok",
      service: "aws-agent-api-demo",
      time: new Date().toISOString(),
    },
    requestId,
    {
      "cache-control": "max-age=5, stale-while-revalidate=10",
    },
  );
}

function handleAgentMock(event, requestId) {
  const payload = safeJsonParse(event?.body);
  if (payload === null) {
    return jsonResponse(
      400,
      {
        error: {
          code: "invalid_json",
          message: "Request body must be valid JSON.",
        },
      },
      requestId,
    );
  }

  const prompt = String(payload?.prompt || "").trim();
  if (!prompt) {
    return jsonResponse(
      400,
      {
        error: {
          code: "missing_prompt",
          message: "Field 'prompt' is required.",
        },
      },
      requestId,
    );
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return jsonResponse(
      413,
      {
        error: {
          code: "prompt_too_large",
          message: `Prompt exceeds ${MAX_PROMPT_CHARS} characters.`,
        },
      },
      requestId,
    );
  }

  const completion = buildMockCompletion(prompt);

  return jsonResponse(
    200,
    {
      object: "chat.completion",
      id: completion.id,
      created: completion.created,
      model: "mock-agent-model-v1",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: completion.completionText,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: completion.promptTokens,
        completion_tokens: completion.completionTokens,
        total_tokens: completion.totalTokens,
      },
      metadata: payload?.metadata || {},
    },
    requestId,
  );
}

function handleLegacyHealth() {
  return legacyJsonResponse({
    d: {
      sts: 1,
      ts: compactTimestamp(),
    },
  });
}

function handleLegacyOps() {
  return legacyJsonResponse({
    d: [LEGACY_ACTION_HEALTH, LEGACY_ACTION_OPS, LEGACY_ACTION_COMPLETE],
  });
}

function handleLegacyExec(event) {
  const sessionId = headerValue(event?.headers, "x-session-id");
  if (!sessionId) {
    return legacyJsonResponse({
      d: {
        ReturnCode: "08",
        ReturnMsg: "NOSESS",
      },
    });
  }

  const payload = safeJsonParse(event?.body);
  if (payload === null) {
    return legacyJsonResponse({
      d: {
        ReturnCode: "01",
        ReturnMsg: "BADJSON",
      },
    });
  }

  const actionCode = Number(payload?.d?.ActionCode);
  if (actionCode !== LEGACY_ACTION_COMPLETE) {
    return legacyJsonResponse({
      d: {
        ReturnCode: "12",
        ReturnMsg: "BADOP",
      },
    });
  }

  const prompt = legacyParam(payload, "P1");
  if (!prompt) {
    return legacyJsonResponse({
      d: {
        ReturnCode: "04",
        ReturnMsg: "NOP1",
      },
    });
  }

  if (prompt.length > MAX_PROMPT_CHARS) {
    return legacyJsonResponse({
      d: {
        ReturnCode: "13",
        ReturnMsg: "P1LEN",
      },
    });
  }

  const completion = buildMockCompletion(prompt);

  return legacyJsonResponse({
    d: {
      ReturnCode: "00",
      ReturnMsg: "SUCCESS",
      ExecDt: compactTimestamp(),
      ResultSet: {
        Tables: [
          {
            TableName: "Table1",
            Cols: ["COL1", "COL2", "COL3", "COL4", "COL5"],
            Rows: [
              [
                completion.id,
                completion.completionText,
                String(completion.promptTokens),
                String(completion.completionTokens),
                String(completion.totalTokens),
              ],
            ],
          },
        ],
      },
    },
  });
}

exports.handler = async (event) => {
  const method = event?.requestContext?.http?.method || "UNKNOWN";
  const path = event?.rawPath || "/";
  const route = `${method} ${path}`;
  const requestId = event?.requestContext?.requestId || `req-${Date.now()}`;
  const baseUrl = event?.requestContext?.domainName
    ? `https://${event.requestContext.domainName}`
    : "https://example.invalid";

  if (route === "GET /v1/health") {
    return handleAgentHealth(requestId);
  }

  if (route === "GET /v1/agent/tools") {
    return jsonResponse(200, buildToolCatalog(baseUrl), requestId, {
      "cache-control": "max-age=60",
    });
  }

  if (route === "POST /v1/agent/mock") {
    return handleAgentMock(event, requestId);
  }

  if (route === "GET /legacy/health") {
    return handleLegacyHealth();
  }

  if (route === "GET /legacy/ops") {
    return handleLegacyOps();
  }

  if (route === "POST /legacy/exec") {
    return handleLegacyExec(event);
  }

  if (path.startsWith("/legacy")) {
    return legacyHtmlError();
  }

  return jsonResponse(
    404,
    {
      error: {
        code: "not_found",
        message: `No route matches '${route}'.`,
      },
    },
    requestId,
  );
};
