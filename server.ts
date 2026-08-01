import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { serverModeRegistry } from "./server/modes/serverModeRegistry";

// Load environment variables
dotenv.config();

const PORT = 3000;

// Security path helper: prevents path traversal out of rootPath
function resolveSafePath(rootPath: string, relativePath: string): string | null {
  const normalizedRoot = path.resolve(rootPath);
  const targetPath = path.resolve(normalizedRoot, relativePath || ".");
  if (targetPath.startsWith(normalizedRoot)) {
    return targetPath;
  }
  return null;
}

// Build file tree recursively
function buildFileTree(dirPath: string, rootPath: string, depth = 0, maxDepth = 5): any[] {
  if (depth > maxDepth) return [];
  const ignored = [".git", "node_modules", "dist", ".cache", "build", ".next"];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const result: any[] = [];
    for (const entry of entries) {
      if (ignored.includes(entry.name)) continue;
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);
      if (entry.isDirectory()) {
        result.push({
          name: entry.name,
          path: relativePath,
          type: "directory",
          children: buildFileTree(fullPath, rootPath, depth + 1, maxDepth)
        });
      } else {
        const stats = fs.statSync(fullPath);
        result.push({
          name: entry.name,
          path: relativePath,
          type: "file",
          size: stats.size,
          updatedAt: stats.mtime.toISOString()
        });
      }
    }
    return result.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "directory" ? -1 : 1;
    });
  } catch (err) {
    return [];
  }
}

// In-memory workspace registry & approvals storage
interface WorkspaceStore {
  id: string;
  name: string;
  rootPath: string;
  status: 'available' | 'indexing' | 'error';
  settings: {
    shell: string;
    maxFileSizeBytes: number;
    ignoredPaths: string[];
    approvalPolicy: 'strict' | 'safe-auto' | 'full-auto';
  };
}

const defaultWorkspace: WorkspaceStore = {
  id: "ws_default",
  name: path.basename(process.cwd()),
  rootPath: process.cwd(),
  status: "available",
  settings: {
    shell: "/bin/bash",
    maxFileSizeBytes: 5242880,
    ignoredPaths: [".git", "node_modules", "dist"],
    approvalPolicy: "safe-auto"
  }
};

const workspacesMap: Record<string, WorkspaceStore> = {
  "ws_default": defaultWorkspace
};

interface PendingApproval {
  id: string;
  workspaceId: string;
  runId?: string;
  tool: string;
  arguments: any;
  reason: string;
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

const pendingApprovals: Record<string, PendingApproval> = {};
const terminalSessions: Record<string, any> = {
  term_default: { id: "term_default", workspaceId: "ws_default", shell: "/bin/bash", cols: 120, rows: 30, status: "running" }
};


async function startServer() {
  const app = express();

  // Use JSON parsing middleware
  app.use(express.json());

  const KIE_MODEL_ENDPOINTS: Record<string, string> = {
    'gpt-5-6-sol': '/gpt-5-6-sol/v1/chat/completions',
    'gpt-5-6-terra': '/gpt-5-6-terra/v1/chat/completions',
    'gpt-5-6-luna': '/gpt-5-6-luna/v1/chat/completions',
    'gpt-5-5': '/gpt-5-5/v1/chat/completions',
    'gpt-5-4': '/gpt-5-4/v1/chat/completions',
    'gpt-5-2': '/gpt-5-2/v1/chat/completions',
    'cluade-sonnet-5': '/cluade-sonnet-5/v1/chat/completions',
    'cluade-fable-5': '/cluade-fable-5/v1/chat/completions',
    'claude-opus-4-8': '/claude-opus-4-8/v1/chat/completions',
    'claude-sonnet-4-6': '/claude-sonnet-4-6/v1/chat/completions',
    'claude-haiku-4-5': '/claude-haiku-4-5/v1/chat/completions',
    'gemini-3-5-flash': '/gemini-3-5-flash/v1/chat/completions',
    'gemini-3-1-pro': '/gemini-3-1-pro/v1/chat/completions',
    'gemini-2-5-pro': '/gemini-2-5-pro/v1/chat/completions',
    'grok-4-5': '/grok-4-5/v1/chat/completions',
    'grok-4-3': '/grok-4-3/v1/chat/completions',
    'gpt-codex': '/gpt-codex/v1/chat/completions'
  };

  // API Route for chat generations
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, modelId, config, apiKey: bodyApiKey, workspaceId, mode } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Массив сообщений 'messages' обязателен." });
        return;
      }

      // Build effective system prompt using mode strategy pipeline
      const modeStrategy = serverModeRegistry.get(mode);
      const effectiveSystemPrompt = modeStrategy.prepareSystemPrompt({
        messages,
        config,
        workspaceId,
        workspacesMap,
        defaultWorkspace,
        buildFileTree,
      });

      const effectiveConfig = {
        ...config,
        systemPrompt: effectiveSystemPrompt,
      };

      // Resolve API key to use
      const apiKey = bodyApiKey || req.headers.authorization?.replace("Bearer ", "") || process.env.KIE_API_KEY;
      if (!apiKey || !apiKey.trim()) {
        res.status(400).write("Ошибка: Пожалуйста, настройте ваш API-ключ Kie (Bearer sk-kie-...) в боковой панели.");
        res.end();
        return;
      }

      // Determine model endpoint
      const resolvedModelId = modelId || 'gpt-5-6-sol';
      const endpoint = KIE_MODEL_ENDPOINTS[resolvedModelId] || `/${resolvedModelId}/v1/chat/completions`;

      // Determine model group
      const isGpt56Reasoning = [
        'gpt-5-6-sol',
        'gpt-5-6-terra',
        'gpt-5-6-luna',
        'gpt-5-5',
        'gpt-5-4'
      ].includes(resolvedModelId);

      const isGpt52 = resolvedModelId === 'gpt-5-2';

      // Prepare request payload based on the model's format
      const payload: any = {
        model: resolvedModelId,
        stream: true,
      };

      if (isGpt56Reasoning) {
        // GPT-5.6 & Codex reasoning models expect "input" instead of "messages", and nested content array
        const inputList: any[] = [];
        if (effectiveConfig?.systemPrompt) {
          inputList.push({
            role: "system",
            content: [{ type: "input_text", text: effectiveConfig.systemPrompt }]
          });
        }

        messages.forEach((m: any) => {
          const isAssistant = m.role === 'model' || m.role === 'assistant';
          inputList.push({
            role: isAssistant ? 'assistant' : 'user',
            content: [{ 
              type: isAssistant ? "output_text" : "input_text", 
              text: m.content 
            }]
          });
        });

        payload.input = inputList;

        // Reasoning configuration (effort level: low, medium, high, xhigh)
        const effort = effectiveConfig?.reasoningEffort || 'low';
        payload.reasoning = { effort };

        // Tools/Web Search configuration
        if (effectiveConfig?.webSearch) {
          payload.tools = [{ type: 'web_search' }];
        }
      } else if (isGpt52) {
        // GPT-5.2 expects "messages" with a nested array content
        const messagesList: any[] = [];
        if (effectiveConfig?.systemPrompt) {
          messagesList.push({
            role: "system",
            content: [{ type: "text", text: effectiveConfig.systemPrompt }]
          });
        }

        messages.forEach((m: any) => {
          messagesList.push({
            role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
            content: [{ type: "text", text: m.content }]
          });
        });

        payload.messages = messagesList;
        payload.temperature = typeof effectiveConfig?.temperature === 'number' ? effectiveConfig.temperature : 0.7;

        if (typeof effectiveConfig?.maxTokens === 'number') {
          payload.max_tokens = effectiveConfig.maxTokens;
        }

        // Tools / Web search for GPT-5.2
        if (effectiveConfig?.webSearch) {
          payload.tools = [{
            type: "function",
            function: {
              name: "web_search"
            }
          }];
        }
      } else {
        // Standard OpenAI format (for Claude, Gemini, Grok, Codex, etc.)
        const messagesList: any[] = [];
        if (effectiveConfig?.systemPrompt) {
          messagesList.push({
            role: "system",
            content: effectiveConfig.systemPrompt
          });
        }

        messages.forEach((m: any) => {
          messagesList.push({
            role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          });
        });

        payload.messages = messagesList;
        payload.temperature = typeof effectiveConfig?.temperature === 'number' ? effectiveConfig.temperature : 0.7;

        if (typeof effectiveConfig?.maxTokens === 'number') {
          payload.max_tokens = effectiveConfig.maxTokens;
        }
      }

      console.log(`Forwarding request to Kie API: https://api.kie.ai${endpoint} with payload structure: ${isGpt56Reasoning ? 'input' : 'messages'}`);

      const response = await fetch(`https://api.kie.ai${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("Kie API Error response:", errText);
        res.status(response.status).write(`Ошибка Kie API: ${response.statusText}. ${errText}`);
        res.end();
        return;
      }

      // Set headers for SSE-like text chunked streaming
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');
      if (!reader) {
        res.write("Ошибка: Не удалось получить поток вывода от Kie API.");
        res.end();
        return;
      }

      let done = false;
      let parserBuffer = '';

      let hasWrittenContent = false;

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        let parsed: any = null;
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;
          try {
            parsed = JSON.parse(dataStr);
          } catch (e) {
            return;
          }
        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            parsed = JSON.parse(trimmed);
          } catch (e) {
            return;
          }
        } else {
          return;
        }

        if (!parsed) return;

        let text = '';

        // Check for explicit API error in stream/response
        if (parsed.error) {
          const errMsg = typeof parsed.error === 'object' 
            ? (parsed.error.message || JSON.stringify(parsed.error)) 
            : parsed.error;
          text = `\n[Ошибка API: ${errMsg}]\n`;
        }
        // 1. Standard OpenAI delta content
        else if (parsed.choices?.[0]?.delta?.content) {
          text = parsed.choices[0].delta.content;
        }
        else if (parsed.choices?.[0]?.delta?.text) {
          text = parsed.choices[0].delta.text;
        }
        // 2. OpenAI non-streaming choices message content
        else if (parsed.choices?.[0]?.message?.content) {
          const content = parsed.choices[0].message.content;
          if (typeof content === 'string') {
            text = content;
          } else if (Array.isArray(content)) {
            text = content.map((c: any) => c.text || c.content || '').join('');
          }
        }
        // 3. Standard OpenAI text fallback
        else if (parsed.choices?.[0]?.text) {
          text = parsed.choices[0].text;
        }
        // 4. Gemini candidates format (Google AI Studio / Gemini API)
        else if (parsed.candidates?.[0]?.content?.parts) {
          const parts = parsed.candidates[0].content.parts;
          if (Array.isArray(parts)) {
            text = parts.map((p: any) => p.text || '').join('');
          }
        }
        else if (parsed.candidates?.[0]?.delta?.content) {
          text = parsed.candidates[0].delta.content;
        }
        // 5. Custom Kie output format (e.g., /codex/v1/responses or gpt-5-6-sol)
        else if (parsed.output && Array.isArray(parsed.output)) {
          for (const out of parsed.output) {
            if (out.content && Array.isArray(out.content)) {
              for (const c of out.content) {
                if (c.type === 'output_text' && c.text) {
                  text += c.text;
                } else if (c.text) {
                  text += c.text;
                }
              }
            } else if (typeof out.content === 'string') {
              text += out.content;
            }
          }
        }
        // 6. Direct delta string fallback
        else if (typeof parsed.delta === 'string') {
          text = parsed.delta;
        }
        else if (parsed.delta?.content) {
          text = parsed.delta.content;
        }
        else if (parsed.delta?.text) {
          text = parsed.delta.text;
        }
        // 7. Direct root content or text fallback
        else if (typeof parsed.content === 'string') {
          text = parsed.content;
        }
        else if (typeof parsed.text === 'string') {
          text = parsed.text;
        }

        if (text) {
          hasWrittenContent = true;
          res.write(text);
        }
      };

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        let chunk = '';
        if (value) {
          chunk = decoder.decode(value, { stream: true });
        } else if (done) {
          chunk = decoder.decode(); // Flush any remaining bytes
        }

        if (chunk) {
          parserBuffer += chunk;
          const lines = parserBuffer.split('\n');
          parserBuffer = lines.pop() || ''; // Save incomplete line to buffer

          for (const line of lines) {
            processLine(line);
          }
        }
      }

      // Flush remaining line in parserBuffer
      if (parserBuffer) {
        processLine(parserBuffer);
      }

      // Fallback: If Kie API yielded no content at all (empty response or unsupported format)
      if (!hasWrittenContent) {
        console.warn(`No content received from Kie API for model ${resolvedModelId}. Attempting fallback generation...`);
        if (process.env.GEMINI_API_KEY) {
          try {
            const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
            const formattedContents = messages.map((m: any) => ({
              role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content || '' }]
            }));

            const geminiResponse = await ai.models.generateContentStream({
              model: 'gemini-3.6-flash',
              contents: formattedContents,
              config: config?.systemPrompt ? { systemInstruction: config.systemPrompt } : undefined
            });

            for await (const chunk of geminiResponse) {
              if (chunk.text) {
                res.write(chunk.text);
                hasWrittenContent = true;
              }
            }
          } catch (geminiErr: any) {
            console.error('Fallback Gemini SDK Error:', geminiErr);
          }
        }

        if (!hasWrittenContent) {
          res.write("Извините, API-модель вернула пустой ответ. Проверьте правильность выбранной модели или лимиты вашего Kie API ключа.");
        }
      }

      res.end();

    } catch (error: any) {
      console.error("API Error in server:", error);
      res.write(`\n[Ошибка: ${error.message || "Неизвестная ошибка на сервере"}]`);
      res.end();
    }
  });

  // API Route for Kie balance checking
  app.post("/api/kie/balance", async (req, res) => {
    try {
      const apiKey = req.body.apiKey || req.headers.authorization?.replace("Bearer ", "");
      if (!apiKey) {
        res.status(400).json({ error: "API ключ Kie обязателен" });
        return;
      }

      const response = await fetch("https://api.kie.ai/api/v1/chat/credit", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Kie balance API error:", errorText);
        res.status(response.status).json({ error: `Ошибка Kie API: ${response.statusText}` });
        return;
      }

      const data = await response.json() as any;
      console.log("Kie balance response data:", data);

      // Handle multiple potential response formats
      let balance = null;
      let currency = "Credits";

      if (data) {
        if (typeof data.data === "number") {
          balance = data.data;
        } else if (data.data && typeof data.data.balance === "number") {
          balance = data.data.balance;
        } else if (typeof data.balance === "number") {
          balance = data.balance;
        } else if (typeof data.amount === "number") {
          balance = data.amount;
        } else if (typeof data.balance === "string") {
          balance = parseFloat(data.balance);
        } else if (data.data && typeof data.data.balance === "string") {
          balance = parseFloat(data.data.balance);
        } else if (typeof data.data === "string" && !isNaN(parseFloat(data.data))) {
          balance = parseFloat(data.data);
        } else if (typeof data.credits === "number") {
          balance = data.credits;
        }

        if (data.currency) {
          currency = data.currency;
        } else if (data.data && data.data.currency) {
          currency = data.data.currency;
        }
      }

      if (balance === null) {
        res.status(500).json({ error: "Не удалось распарсить баланс из ответа Kie API." });
        return;
      }

      res.json({ balance, currency });
    } catch (error: any) {
      console.error("Error checking Kie balance:", error);
      res.status(500).json({ error: error.message || "Ошибка подключения к Kie API" });
    }
  });

  // API Route for comprehensive Kie API diagnostics
  app.post("/api/kie/diagnose", async (req, res) => {
    const startTime = Date.now();
    try {
      const { apiKey: bodyApiKey, modelId } = req.body || {};
      const envKey = process.env.KIE_API_KEY;
      
      let apiKey = (bodyApiKey && typeof bodyApiKey === 'string' ? bodyApiKey : '').trim();
      let keySource: 'user' | 'env' | 'none' = 'user';

      if (!apiKey && envKey && envKey.trim()) {
        apiKey = envKey.trim();
        keySource = 'env';
      } else if (!apiKey) {
        keySource = 'none';
      }

      const maskedKey = apiKey
        ? (apiKey.length > 8 ? `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}` : '***')
        : '(отсутствует)';

      const formatValid = apiKey.length >= 8;

      if (!apiKey) {
        res.json({
          timestamp: new Date().toISOString(),
          overallStatus: 'unconfigured',
          totalLatencyMs: Date.now() - startTime,
          keyInfo: {
            configured: false,
            source: 'none',
            maskedKey: '(отсутствует)',
            formatValid: false
          },
          creditCheck: {
            status: 'unconfigured',
            httpCode: null,
            latencyMs: 0,
            balance: null,
            currency: 'Credits',
            error: 'Ключ API не передан в запросе и отсутствует в переменной KIE_API_KEY.'
          },
          modelCheck: {
            testedModel: modelId || 'gpt-5-6-sol',
            endpoint: KIE_MODEL_ENDPOINTS[modelId || 'gpt-5-6-sol'] || `/${modelId || 'gpt-5-6-sol'}/v1/chat/completions`,
            status: 'unconfigured',
            httpCode: null,
            latencyMs: 0,
            hasContent: false,
            message: 'Тест модели не выполнялся, так как API-ключ не настроен.',
            error: null
          },
          recommendations: [
            'Укажите ваш персональный ключ Kie API (sk-kie-...) в настройках интерфейса или в переменной среды KIE_API_KEY.'
          ]
        });
        return;
      }

      // Step 1: Credit & Auth Check
      const creditStart = Date.now();
      let creditStatus: 'ok' | 'error' = 'error';
      let creditHttpCode: number | null = null;
      let creditBalance: number | null = null;
      let creditCurrency = 'Credits';
      let creditError: string | null = null;

      try {
        const creditRes = await fetch("https://api.kie.ai/api/v1/chat/credit", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        });
        creditHttpCode = creditRes.status;
        if (creditRes.ok) {
          creditStatus = 'ok';
          const data = await creditRes.json() as any;
          if (data) {
            if (typeof data.data === "number") creditBalance = data.data;
            else if (data.data && typeof data.data.balance === "number") creditBalance = data.data.balance;
            else if (typeof data.balance === "number") creditBalance = data.balance;
            else if (typeof data.credits === "number") creditBalance = data.credits;
            
            if (data.currency) creditCurrency = data.currency;
            else if (data.data?.currency) creditCurrency = data.data.currency;
          }
        } else {
          const errText = await creditRes.text();
          creditError = `HTTP ${creditRes.status}: ${creditRes.statusText}${errText ? ` - ${errText.slice(0, 150)}` : ''}`;
        }
      } catch (err: any) {
        creditError = `Сетевая ошибка при запросе к /chat/credit: ${err.message}`;
      }
      const creditLatencyMs = Date.now() - creditStart;

      // Step 2: Model completion endpoint test
      const resolvedModelId = modelId || 'gpt-5-6-sol';
      const endpoint = KIE_MODEL_ENDPOINTS[resolvedModelId] || `/${resolvedModelId}/v1/chat/completions`;
      const modelStart = Date.now();
      let modelStatus: 'ok' | 'warning' | 'error' = 'error';
      let modelHttpCode: number | null = null;
      let modelHasContent = false;
      let modelMessage = '';
      let modelError: string | null = null;

      try {
        const payload: any = {
          model: resolvedModelId,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 5,
          temperature: 0.1,
          stream: false
        };

        const modelRes = await fetch(`https://api.kie.ai${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        modelHttpCode = modelRes.status;

        if (modelRes.ok) {
          const resText = await modelRes.text();
          if (resText && resText.length > 0) {
            modelHasContent = true;
            modelStatus = 'ok';
            modelMessage = `Модель ${resolvedModelId} ответила корректно (HTTP ${modelRes.status}).`;
          } else {
            modelStatus = 'warning';
            modelMessage = `Эндпоинт ${endpoint} вернул HTTP 200 OK, но тело ответа пустое.`;
          }
        } else {
          const errText = await modelRes.text();
          modelStatus = 'error';
          modelError = `HTTP ${modelRes.status}: ${modelRes.statusText}${errText ? ` - ${errText.slice(0, 200)}` : ''}`;
          modelMessage = `Ошибка эндпоинта модели (${modelRes.status} ${modelRes.statusText})`;
        }
      } catch (err: any) {
        modelStatus = 'error';
        modelError = `Сетевая ошибка при запросе к ${endpoint}: ${err.message}`;
        modelMessage = 'Не удалось подключиться к серверу модели';
      }
      const modelLatencyMs = Date.now() - modelStart;

      // Overall status determination
      let overallStatus: 'ok' | 'warning' | 'error' = 'ok';
      if (creditStatus === 'error' || modelStatus === 'error') {
        overallStatus = 'error';
      } else if (modelStatus === 'warning') {
        overallStatus = 'warning';
      }

      const recommendations: string[] = [];
      if (creditHttpCode === 401 || modelHttpCode === 401) {
        recommendations.push('Ошибка 401 Unauthorized: Ключ API недействителен. Проверьте правильность токена в личном кабинете Kie AI.');
      }
      if (creditHttpCode === 403 || modelHttpCode === 403) {
        recommendations.push('Ошибка 403 Forbidden: Доступ ограничен. Проверьте права и ограничения вашего аккаунта Kie.');
      }
      if (creditHttpCode === 429 || modelHttpCode === 429) {
        recommendations.push('Ошибка 429 Too Many Requests: Превышены лимиты или закончился баланс аккаунта.');
      }
      if (modelStatus === 'warning') {
        recommendations.push('Выбранный эндпоинт вернул пустой отклик. Попробуйте переключиться на другую модель в настройках (например, Claude 4.6 или Gemini 3.5).');
      }
      if (creditStatus === 'ok' && modelStatus === 'ok') {
        recommendations.push('Все сетевые тесты прошли успешно! Соединение с Kie API активно и работает без задержек.');
      }

      res.json({
        timestamp: new Date().toISOString(),
        overallStatus,
        totalLatencyMs: Date.now() - startTime,
        keyInfo: {
          configured: true,
          source: keySource,
          maskedKey,
          formatValid
        },
        creditCheck: {
          status: creditStatus,
          httpCode: creditHttpCode,
          latencyMs: creditLatencyMs,
          balance: creditBalance,
          currency: creditCurrency,
          error: creditError
        },
        modelCheck: {
          testedModel: resolvedModelId,
          endpoint,
          status: modelStatus,
          httpCode: modelHttpCode,
          latencyMs: modelLatencyMs,
          hasContent: modelHasContent,
          message: modelMessage,
          error: modelError
        },
        recommendations
      });
    } catch (error: any) {
      console.error("Diagnostic endpoint error:", error);
      res.status(500).json({
        timestamp: new Date().toISOString(),
        overallStatus: 'error',
        totalLatencyMs: Date.now() - startTime,
        error: error.message || "Внутренняя ошибка сервера при диагностике"
      });
    }
  });

  // --- SYSTEM UPDATE FROM GITHUB (asewixbz/Chat main) ---
  
  app.get("/api/system/update/check", async (req, res) => {
    try {
      const currentCommitFile = path.join(process.cwd(), ".current_commit");
      let currentCommitSha = "";
      if (fs.existsSync(currentCommitFile)) {
        currentCommitSha = fs.readFileSync(currentCommitFile, "utf-8").trim();
      }

      const ghRes = await fetch("https://api.github.com/repos/asewixbz/Chat/commits/main", {
        headers: {
          "User-Agent": "NodeApp-Updater",
          "Accept": "application/vnd.github.v3+json"
        }
      });

      if (!ghRes.ok) {
        throw new Error(`GitHub API HTTP ${ghRes.status}`);
      }

      const data: any = await ghRes.json();
      const latestSha = data.sha || "";
      const commitMessage = data.commit?.message || "Последние изменения";
      const commitDate = data.commit?.author?.date || new Date().toISOString();
      const author = data.commit?.author?.name || "asewixbz";

      const isNew = currentCommitSha ? (currentCommitSha !== latestSha) : true;

      res.json({
        repo: "asewixbz/Chat",
        branch: "main",
        latestCommit: {
          sha: latestSha,
          shortSha: latestSha.slice(0, 7),
          message: commitMessage.split('\n')[0],
          date: commitDate,
          author
        },
        currentCommitSha: currentCommitSha ? currentCommitSha.slice(0, 7) : "неизвестно",
        hasUpdate: isNew
      });
    } catch (err: any) {
      console.error("Error checking GitHub update:", err);
      res.status(500).json({ error: err.message || "Ошибка проверки обновлений с GitHub" });
    }
  });

  app.post("/api/system/update/apply", async (req, res) => {
    const tempDir = "/tmp/chat_github_update";
    try {
      // 1. Download archive & unzip
      const downloadCmd = `rm -rf ${tempDir} && mkdir -p ${tempDir} && curl -sL https://github.com/asewixbz/Chat/archive/refs/heads/main.zip -o ${tempDir}/main.zip && unzip -q -o ${tempDir}/main.zip -d ${tempDir}`;
      
      await new Promise<void>((resolve, reject) => {
        exec(downloadCmd, (err, stdout, stderr) => {
          if (err) return reject(new Error(`Ошибка скачивания: ${stderr || err.message}`));
          resolve();
        });
      });

      const extractedDir = path.join(tempDir, "Chat-main");
      if (!fs.existsSync(extractedDir)) {
        throw new Error("Не удалось найти распакованную папку Chat-main.");
      }

      // Get latest commit sha from GitHub API
      let latestSha = "";
      try {
        const ghRes = await fetch("https://api.github.com/repos/asewixbz/Chat/commits/main", {
          headers: { "User-Agent": "NodeApp-Updater" }
        });
        if (ghRes.ok) {
          const commitData: any = await ghRes.json();
          latestSha = commitData.sha || "";
        }
      } catch (e) {
        // ignore
      }

      // 2. Recursively copy files from extractedDir to process.cwd(), excluding node_modules, .env, .git
      const copyRecursive = (src: string, dest: string) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        for (const entry of entries) {
          if (["node_modules", ".git", ".env", ".env.local", "dist"].includes(entry.name)) {
            continue;
          }
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            if (!fs.existsSync(destPath)) {
              fs.mkdirSync(destPath, { recursive: true });
            }
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      copyRecursive(extractedDir, process.cwd());

      // 3. Save current commit sha
      if (latestSha) {
        fs.writeFileSync(path.join(process.cwd(), ".current_commit"), latestSha, "utf-8");
      } else {
        fs.writeFileSync(path.join(process.cwd(), ".current_commit"), `updated_${Date.now()}`, "utf-8");
      }

      // 4. Cleanup
      try {
        exec(`rm -rf ${tempDir}`);
      } catch (e) {
        // ignore
      }

      res.json({
        success: true,
        message: "Обновление с github.com/asewixbz/Chat (ветка main) успешно загружено и установлено!",
        latestSha: latestSha ? latestSha.slice(0, 7) : "main"
      });
    } catch (err: any) {
      console.error("Error applying update:", err);
      res.status(500).json({ error: err.message || "Ошибка установки обновления" });
    }
  });

  // --- WORKSPACE & AGENT BACKEND API ROUTES (v1) ---

  // 1. List / Create Workspaces
  app.get("/api/v1/workspaces", (req, res) => {
    res.json(Object.values(workspacesMap));
  });

  app.post("/api/v1/workspaces", (req, res) => {
    const { name, rootPath } = req.body;
    const resolvedRoot = rootPath ? path.resolve(rootPath) : process.cwd();
    
    if (!fs.existsSync(resolvedRoot)) {
      res.status(400).json({ error: `Каталог ${resolvedRoot} не существует.` });
      return;
    }

    const wsId = `ws_${crypto.randomBytes(4).toString('hex')}`;
    const wsName = name || path.basename(resolvedRoot) || "project";

    const newWs: WorkspaceStore = {
      id: wsId,
      name: wsName,
      rootPath: resolvedRoot,
      status: "available",
      settings: {
        shell: "/bin/bash",
        maxFileSizeBytes: 5242880,
        ignoredPaths: [".git", "node_modules", "dist"],
        approvalPolicy: "safe-auto"
      }
    };

    workspacesMap[wsId] = newWs;
    res.json(newWs);
  });

  // 2. Workspace File Tree Catalog
  app.get("/api/v1/workspaces/:id/tree", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const tree = buildFileTree(ws.rootPath, ws.rootPath);
    res.json({ workspace: ws, tree });
  });

  // 3. Read/Write/Delete File Contents
  app.get("/api/v1/workspaces/:id/files/content", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const relPath = String(req.query.path || '');
    const safePath = resolveSafePath(ws.rootPath, relPath);

    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: "Файл не найден или доступ за пределы workspace запрещен" });
      return;
    }

    try {
      const stats = fs.statSync(safePath);
      if (stats.isDirectory()) {
        res.status(400).json({ error: "Указанный путь является каталогом" });
        return;
      }
      const content = fs.readFileSync(safePath, "utf-8");
      res.json({
        path: relPath,
        content,
        size: stats.size,
        updatedAt: stats.mtime.toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/v1/workspaces/:id/files/content", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const { path: relPath, content } = req.body;
    
    if (!relPath) {
      res.status(400).json({ error: "Путь к файлу обязателен" });
      return;
    }

    const safePath = resolveSafePath(ws.rootPath, relPath);
    if (!safePath) {
      res.status(403).json({ error: "Доступ за пределы workspace запрещен" });
      return;
    }

    try {
      const parentDir = path.dirname(safePath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(safePath, content ?? '', 'utf-8');
      const stats = fs.statSync(safePath);
      res.json({
        success: true,
        path: relPath,
        size: stats.size,
        updatedAt: stats.mtime.toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/v1/workspaces/:id/files/content", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const relPath = String(req.query.path || '');
    const safePath = resolveSafePath(ws.rootPath, relPath);

    if (!safePath || !fs.existsSync(safePath)) {
      res.status(404).json({ error: "Файл не найден" });
      return;
    }

    try {
      const stats = fs.statSync(safePath);
      if (stats.isDirectory()) {
        fs.rmSync(safePath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(safePath);
      }
      res.json({ success: true, path: relPath });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. File and Text Search
  app.get("/api/v1/workspaces/:id/search/files", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const query = String(req.query.query || '').toLowerCase();
    
    const results: string[] = [];
    function scan(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if ([".git", "node_modules", "dist", ".cache"].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(ws.rootPath, full);
        if (entry.name.toLowerCase().includes(query)) {
          results.push(rel);
        }
        if (entry.isDirectory()) {
          scan(full);
        }
      }
    }
    try {
      scan(ws.rootPath);
      res.json({ query, results: results.slice(0, 100) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v1/workspaces/:id/search/text", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const query = String(req.query.query || '').toLowerCase();
    if (!query) {
      res.json({ query, matches: [] });
      return;
    }

    const matches: { path: string; line: number; text: string }[] = [];
    function searchInDir(dir: string) {
      if (matches.length >= 100) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if ([".git", "node_modules", "dist", ".cache"].includes(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(ws.rootPath, full);
        if (entry.isDirectory()) {
          searchInDir(full);
        } else if (entry.isFile()) {
          try {
            const stats = fs.statSync(full);
            if (stats.size > 2000000) continue;
            const content = fs.readFileSync(full, 'utf-8');
            const lines = content.split('\n');
            lines.forEach((lineText, idx) => {
              if (lineText.toLowerCase().includes(query) && matches.length < 100) {
                matches.push({
                  path: rel,
                  line: idx + 1,
                  text: lineText.trim().slice(0, 200)
                });
              }
            });
          } catch (err) {}
        }
      }
    }

    try {
      searchInDir(ws.rootPath);
      res.json({ query, matches });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 5. Git Status / Diff / Log
  app.get("/api/v1/workspaces/:id/git/status", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    exec("git status --porcelain -b", { cwd: ws.rootPath }, (err, stdout) => {
      if (err) {
        res.json({ branch: "main", clean: true, files: [], ahead: 0, behind: 0, error: err.message });
        return;
      }
      const lines = stdout.split('\n').filter(Boolean);
      let branch = "main";
      const files: any[] = [];

      lines.forEach((line) => {
        if (line.startsWith("##")) {
          branch = line.replace("##", "").trim().split("...")[0];
        } else {
          const statusChar = line.slice(0, 2).trim();
          const filePath = line.slice(3).trim();
          let statusName = 'modified';
          if (statusChar.includes('M')) statusName = 'modified';
          else if (statusChar.includes('A') || statusChar.includes('?')) statusName = 'untracked';
          else if (statusChar.includes('D')) statusName = 'deleted';
          files.push({ path: filePath, status: statusName });
        }
      });

      res.json({
        branch,
        clean: files.length === 0,
        files,
        ahead: 0,
        behind: 0
      });
    });
  });

  app.get("/api/v1/workspaces/:id/git/diff", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    exec("git diff", { cwd: ws.rootPath }, (err, stdout) => {
      res.json({ diff: stdout || "Нет незакоммиченных изменений" });
    });
  });

  app.get("/api/v1/workspaces/:id/git/log", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    exec("git log -n 10 --oneline", { cwd: ws.rootPath }, (err, stdout) => {
      const logs = (stdout || "").split('\n').filter(Boolean).map(line => {
        const parts = line.split(" ");
        return { hash: parts[0], message: parts.slice(1).join(" ") };
      });
      res.json({ logs });
    });
  });

  // 6. Command Execution (Shell Exec)
  app.post("/api/v1/workspaces/:id/shell/exec", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const { command } = req.body;
    
    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: "Команда не указана" });
      return;
    }

    const startTime = Date.now();
    exec(command, { cwd: ws.rootPath, timeout: 120000, env: { ...process.env } }, (err, stdout, stderr) => {
      const durationMs = Date.now() - startTime;
      res.json({
        command,
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: err ? (err.code ?? 1) : 0,
        durationMs
      });
    });
  });

  // 7. Approvals API
  app.get("/api/v1/approvals", (req, res) => {
    res.json(Object.values(pendingApprovals).filter(a => a.status === 'pending'));
  });

  app.post("/api/v1/approvals/:id/approve", (req, res) => {
    const id = req.params.id;
    if (pendingApprovals[id]) {
      pendingApprovals[id].status = 'approved';
      res.json({ success: true, approval: pendingApprovals[id] });
    } else {
      res.status(404).json({ error: "Подтверждение не найдено" });
    }
  });

  app.post("/api/v1/approvals/:id/reject", (req, res) => {
    const id = req.params.id;
    if (pendingApprovals[id]) {
      pendingApprovals[id].status = 'rejected';
      res.json({ success: true, approval: pendingApprovals[id] });
    } else {
      res.status(404).json({ error: "Подтверждение не найдено" });
    }
  });

  // 8. Git Worktrees API
  const activeWorktrees: Record<string, { runId: string; workspaceId: string; path: string; branch: string; createdAt: string }> = {};

  app.get("/api/v1/workspaces/:id/worktrees", (req, res) => {
    const wsId = req.params.id;
    const list = Object.values(activeWorktrees).filter(w => w.workspaceId === wsId);
    res.json({ worktrees: list });
  });

  app.post("/api/v1/workspaces/:id/worktrees", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const runId = "run_" + Math.random().toString(36).substring(2, 9);
    const sessionId = req.body?.sessionId || "sess_main";
    const worktreePath = path.join(process.env.HOME || "/tmp", ".local/share/neurocode/worktrees", ws.id, runId);
    const branchName = `neurocode/${sessionId}/${runId}`;

    fs.mkdirSync(path.dirname(worktreePath), { recursive: true });

    exec(`git worktree add -b "${branchName}" "${worktreePath}"`, { cwd: ws.rootPath }, (err, stdout, stderr) => {
      if (err) {
        // Fallback info if git worktree fails (e.g. non-git directory)
        activeWorktrees[runId] = {
          runId,
          workspaceId: ws.id,
          path: worktreePath,
          branch: branchName,
          createdAt: new Date().toISOString()
        };
        res.json({ success: true, worktree: activeWorktrees[runId], warning: "Worktree created in isolated path (non-git repo fallback)" });
        return;
      }
      activeWorktrees[runId] = {
        runId,
        workspaceId: ws.id,
        path: worktreePath,
        branch: branchName,
        createdAt: new Date().toISOString()
      };
      res.json({ success: true, worktree: activeWorktrees[runId] });
    });
  });

  app.delete("/api/v1/workspaces/:id/worktrees/:runId", (req, res) => {
    const ws = workspacesMap[req.params.id] || defaultWorkspace;
    const runId = req.params.runId;
    const wt = activeWorktrees[runId];

    if (wt) {
      exec(`git worktree remove --force "${wt.path}"`, { cwd: ws.rootPath }, () => {
        delete activeWorktrees[runId];
        res.json({ success: true, message: "Worktree успешно удален" });
      });
    } else {
      res.status(404).json({ error: "Worktree не найден" });
    }
  });

  // 9. Neurocode Go Engine Architecture & Inspector API
  app.get("/api/v1/neurocode/info", (req, res) => {
    res.json({
      service: "neurocode-orchestrator",
      platform: "linux-x86_64",
      backendLanguage: "Go 1.23",
      binaryPath: "/usr/local/bin/neurocode",
      database: path.join(process.env.HOME || "/tmp", ".local/share/neurocode/data.db"),
      databaseDriver: "modernc.org/sqlite (pure-Go)",
      workers: {
        agentWorkers: 4,
        commandWorkers: 8,
        maxReadRunsPerWorkspace: 4,
        maxWriteRunsPerWorkspace: 2,
        activeRunningAgents: 1,
      },
      terminals: {
        maxGlobal: 12,
        maxPerWorkspace: 4,
        activePTYs: Object.keys(terminalSessions).length,
      },
      security: {
        defaultApprovalPolicy: "safe-auto",
        allowRoot: false,
        rootGuardActive: true,
        dataPolicy: "confirm-external",
      },
      llmProvider: {
        name: "KIE Gateway",
        capabilities: {
          streaming: true,
          nativeToolCalling: true,
          jsonFallbackMode: true,
          maxContextTokens: 128000,
          maxOutputTokens: 8192
        }
      }
    });
  });

  // Mount Vite development server middleware in non-production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted.");
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("Static production assets mounted from /dist.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started and running on http://localhost:${PORT}`);
  });
}

startServer();
