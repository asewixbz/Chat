import express from "express";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import crypto from "crypto";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

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


async function startServer() {
  const app = express();

  // Use JSON parsing middleware
  app.use(express.json());

  const KIE_MODEL_ENDPOINTS: Record<string, string> = {
    'gpt-5-6-sol': '/codex/v1/responses',
    'gpt-5-6-terra': '/codex/v1/responses',
    'gpt-5-6-luna': '/codex/v1/responses',
    'gpt-5-5': '/codex/v1/responses',
    'gpt-5-4': '/codex/v1/responses',
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

      // Format workspace context (file tree & structure)
      const targetWsId = workspaceId || "ws_default";
      const wsStore = workspacesMap[targetWsId] || defaultWorkspace;
      const wsFileTree = buildFileTree(wsStore.rootPath, wsStore.rootPath, 0, 4);

      function renderTree(nodes: any[], indent = ''): string {
        let text = '';
        for (const node of nodes) {
          if (node.type === 'directory') {
            text += `${indent}📁 ${node.name}/\n`;
            if (node.children && node.children.length > 0) {
              text += renderTree(node.children, indent + '  ');
            }
          } else {
            const sizeKb = node.size ? ` (${Math.round(node.size / 1024)} KB)` : '';
            text += `${indent}📄 ${node.name}${sizeKb}\n`;
          }
        }
        return text;
      }

      const fileTreeText = renderTree(wsFileTree);
      const workspaceContextString = `\n\n=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА (${wsStore.name}) ===\nКаталог: ${wsStore.rootPath}\n\nСтруктура файлов проекта:\n${fileTreeText || '(файлы не найдены)'}\n================================================`;

      // Build effective system prompt with workspace context and agent instructions
      let baseSystemPrompt = (config?.systemPrompt || '').trim();
      if (!baseSystemPrompt.includes('=== РАБОЧЕЕ ПРОСТРАНСТВО ПРОЕКТА')) {
        baseSystemPrompt = baseSystemPrompt ? `${baseSystemPrompt}\n${workspaceContextString}` : workspaceContextString;
      }

      if (mode === 'agent' && !baseSystemPrompt.includes('[TASK:')) {
        baseSystemPrompt += `\n\nИнструкция для Агента:\nПри ответе и выполнении задач используйте следующую разметку в начале ответа или соответствующего шага:\n[TASK: Краткое название задачи]\n[STEP: Название текущего шага]`;
      }

      const effectiveConfig = {
        ...config,
        systemPrompt: baseSystemPrompt,
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
