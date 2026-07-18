import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const PORT = 3000;

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
      const { messages, modelId, config, apiKey: bodyApiKey } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Массив сообщений 'messages' обязателен." });
        return;
      }

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
        if (config?.systemPrompt && config.systemPrompt.trim()) {
          inputList.push({
            role: "system",
            content: [{ type: "input_text", text: config.systemPrompt.trim() }]
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
        const effort = config?.reasoningEffort || 'low';
        payload.reasoning = { effort };

        // Tools/Web Search configuration
        if (config?.webSearch) {
          payload.tools = [{ type: 'web_search' }];
        }
      } else if (isGpt52) {
        // GPT-5.2 expects "messages" with a nested array content
        const messagesList: any[] = [];
        if (config?.systemPrompt && config.systemPrompt.trim()) {
          messagesList.push({
            role: "system",
            content: [{ type: "text", text: config.systemPrompt.trim() }]
          });
        }

        messages.forEach((m: any) => {
          messagesList.push({
            role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
            content: [{ type: "text", text: m.content }]
          });
        });

        payload.messages = messagesList;
        payload.temperature = typeof config?.temperature === 'number' ? config.temperature : 0.7;

        if (typeof config?.maxTokens === 'number') {
          payload.max_tokens = config.maxTokens;
        }

        // Tools / Web search for GPT-5.2
        if (config?.webSearch) {
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
        if (config?.systemPrompt && config.systemPrompt.trim()) {
          messagesList.push({
            role: "system",
            content: config.systemPrompt.trim()
          });
        }

        messages.forEach((m: any) => {
          messagesList.push({
            role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          });
        });

        payload.messages = messagesList;
        payload.temperature = typeof config?.temperature === 'number' ? config.temperature : 0.7;

        if (typeof config?.maxTokens === 'number') {
          payload.max_tokens = config.maxTokens;
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

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        if (trimmed.startsWith('data:')) {
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;
          try {
            const parsed = JSON.parse(dataStr);
            
            // Helper to extract text from multiple known output formats
            let text = '';
            
            // Check for explicit API error in SSE stream
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
            // 2. Standard OpenAI text fallback
            else if (parsed.choices?.[0]?.text) {
              text = parsed.choices[0].text;
            }
            // 3. Custom Kie output format (e.g., /codex/v1/responses or gpt-5-6-sol)
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
            // 4. Direct delta string fallback (highly likely for response.output_text.delta events)
            else if (typeof parsed.delta === 'string') {
              text = parsed.delta;
            }
            // 5. Custom root delta content fallback
            else if (parsed.delta?.content) {
              text = parsed.delta.content;
            }
            else if (parsed.content && typeof parsed.content === 'string') {
              text = parsed.content;
            }

            if (text) {
              res.write(text);
            }
          } catch (e) {
            // Ignore incomplete JSONs or metadata lines
          }
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
          parserBuffer = lines.pop() || ''; // Save the incomplete line to buffer

          for (const line of lines) {
            processLine(line);
          }
        }
      }

      // Flush remaining line in parserBuffer
      if (parserBuffer) {
        processLine(parserBuffer);
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
