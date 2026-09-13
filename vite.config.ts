import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { spawn } from 'child_process';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';

// Load .env.local and .env
dotenv.config({ path: '.env.local' });
dotenv.config();

function registerApiMiddlewares(server: any) {
  server.middlewares.use('/api/model-info', (req: any, res: any, next: any) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const pyProcess = spawn('python3', ['ml/predictor.py', '--model-info'], {
        cwd: process.cwd(),
      });

      let stdout = '';
      let stderr = '';

      pyProcess.stdout.on('data', data => {
        stdout += data.toString();
      });

      pyProcess.stderr.on('data', data => {
        stderr += data.toString();
      });

      pyProcess.on('close', code => {
        res.setHeader('Content-Type', 'application/json');
        if (code === 0 && stdout.trim()) {
          res.statusCode = 200;
          res.end(stdout);
        } else {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: stderr || 'Failed to load model info' }));
        }
      });
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ success: false, error: err?.message || 'Server error' }));
    }
  });

  server.middlewares.use('/api/predict', (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      return next();
    }

    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const pyProcess = spawn('python3', ['ml/predictor.py', '--predict-json', body], {
          cwd: process.cwd(),
        });

        let stdout = '';
        let stderr = '';

        pyProcess.stdout.on('data', data => {
          stdout += data.toString();
        });

        pyProcess.stderr.on('data', data => {
          stderr += data.toString();
        });

        pyProcess.on('close', code => {
          res.setHeader('Content-Type', 'application/json');
          if (code === 0 && stdout.trim()) {
            res.statusCode = 200;
            res.end(stdout);
          } else {
            res.statusCode = 400;
            res.end(
              stdout.trim() ||
                JSON.stringify({
                  success: false,
                  error: stderr || 'Execution error running predictive maintenance pipeline',
                })
            );
          }
        });
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ success: false, error: err?.message || 'Server error' }));
      }
    });
  });

  server.middlewares.use('/api/explain', (req: any, res: any, next: any) => {
    if (req.method !== 'POST') {
      return next();
    }

    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
    });

    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json');
      try {
        const parsed = JSON.parse(body || '{}');
        const { inputs, decision, apiKey, model } = parsed;
        const groqKey = (apiKey && apiKey.trim()) || process.env.GROQ_API_KEY;
        const configuredModel = (model && model.trim()) || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

        if (!groqKey) {
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              is_ai: false,
              notice: 'Groq API key not configured. Displaying deterministic explanation.',
            })
          );
        }

        const summary = `Machine Type: ${inputs.Type}
Air Temperature: ${inputs['Air temperature [K]']} K
Process Temperature: ${inputs['Process temperature [K]']} K
Rotational Speed: ${inputs['Rotational speed [rpm]']} rpm
Torque: ${inputs['Torque [Nm]']} Nm
Tool Wear: ${inputs['Tool wear [min]']} min

Predicted Failure Probability: ${decision.formatted_probability}
Risk Level: ${decision.risk_level}
Maintenance Decision: ${decision.decision}
Priority: ${decision.priority_label || decision.priority}
Recommended Action: ${decision.recommendation}`;

        const callGroq = async (targetModel: string) => {
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqKey}`,
              'Content-Type': 'application/json',
              'User-Agent': 'ProductionDowntimeIntelligence/1.0',
            },
            body: JSON.stringify({
              model: targetModel,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are an industrial AI maintenance explanation engine. You explain ML failure probabilities clearly and professionally. You MUST NOT change numerical probabilities or override decisions. Provide: 1. Risk level context, 2. Key model factors, 3. Maintenance directive, 4. Downtime reduction value.',
                },
                {
                  role: 'user',
                  content: `Explain this machine risk result:\n\n${summary}`,
                },
              ],
              temperature: 0.1,
              max_tokens: 500,
            }),
          });
          const json = await resp.json();
          return { ok: resp.ok, status: resp.status, json, targetModel };
        };

        let result = await callGroq(configuredModel);

        // If configured model returned 404 (model_not_found), try available fallback model (e.g. qwen/qwen3.8-27b)
        if (!result.ok && result.json?.error?.code === 'model_not_found' && configuredModel !== 'qwen/qwen3.8-27b') {
          result = await callGroq('qwen/qwen3.8-27b');
        }

        if (result.ok && result.json?.choices?.[0]?.message?.content) {
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              is_ai: true,
              model: result.targetModel,
              explanation: result.json.choices[0].message.content,
            })
          );
        } else {
          res.statusCode = 200;
          return res.end(
            JSON.stringify({
              success: true,
              is_ai: false,
              notice: `Groq API notice (${result.json?.error?.message || 'unavailable'}). Displaying deterministic explanation.`,
            })
          );
        }
      } catch (err: any) {
        res.statusCode = 200;
        return res.end(
          JSON.stringify({
            success: true,
            is_ai: false,
            notice: `Groq explanation service notice: ${err?.message || 'unavailable'}. Displaying deterministic explanation.`,
          })
        );
      }
    });
  });
}

function pythonPredictorPlugin(): Plugin {
  return {
    name: 'python-predictor-plugin',
    configureServer(server) {
      registerApiMiddlewares(server);
    },
    configurePreviewServer(server) {
      registerApiMiddlewares(server);
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), pythonPredictorPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
