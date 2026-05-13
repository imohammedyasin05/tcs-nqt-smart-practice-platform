import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const APTITUDE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questionText: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    answer: { type: Type.INTEGER },
    explanation: { type: Type.STRING },
  },
  required: ["questionText", "options", "answer", "explanation"],
};

const CODING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questionText: { type: Type.STRING, description: "Title of the coding problem" },
    problemStatement: { type: Type.STRING },
    sampleInput: { type: Type.STRING },
    sampleOutput: { type: Type.STRING },
    constraints: { type: Type.STRING },
    explanation: { type: Type.STRING },
  },
  required: ["questionText", "problemStatement", "sampleInput", "sampleOutput", "constraints", "explanation"],
};

const APTITUDE_BATCH_SCHEMA = {
  type: Type.ARRAY,
  items: APTITUDE_SCHEMA
};

const CODING_BATCH_SCHEMA = {
  type: Type.ARRAY,
  items: CODING_SCHEMA
};

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(cors({ origin: "*" }));

  // Middleware to parse JSON
  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "TCS NQT Smart Practice Server is running" });
  });

  app.post("/api/generate", async (req, res) => {
    try {
      const { subject, topics, difficulty, count, provider = 'auto' } = req.body;
      const isCoding = subject === 'Coding';
      
      let schema;
      let prompt;

      if (count === 1) {
        schema = isCoding ? CODING_SCHEMA : APTITUDE_SCHEMA;
        const topic = topics[0];
        prompt = isCoding
          ? `Generate a TCS NQT level Coding problem on ${topic}, ${difficulty} difficulty. Include a descriptive title, problem statement, sample input/output, constraints, and an explanation. Make it unique.`
          : `Generate a TCS NQT level ${subject} question on ${topic}, ${difficulty} difficulty. Provide exactly 4 options in an array. Provide the correct answer as a zero-based integer index (0, 1, 2, or 3). Provide a short explanation. Make it unique.`;
      } else {
        schema = isCoding ? CODING_BATCH_SCHEMA : APTITUDE_BATCH_SCHEMA;
        prompt = `Act as a TCS NQT exam paper generator. 
        Generate EXACTLY ${count} UNIQUE questions for ${subject}. 
        Topics to cover: ${topics.join(', ')}.
        Difficulty: ${difficulty}.
        
        STRICT RULES:
        1. Distribute questions across the provided topics.
        2. Ensure all questions match TCS NQT difficulty and pattern.
        3. Return ONLY valid JSON matching the requested schema.
        4. Change values and logic patterns to avoid repetition.`;
      }

      const generateWithGemini = async () => {
        const start = Date.now();
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });
        console.log(`[Gemini] Generated in ${Date.now() - start}ms`);
        return JSON.parse(response.text);
      };

      const generateWithGroq = async () => {
        const start = Date.now();
        const groqPrompt = `${prompt}\n\nIMPORTANT: Return ONLY valid JSON. The JSON MUST be an object with a single key "questions" containing an array of ${count === 1 ? 'exactly 1 question object' : 'question objects'} matching the requested format. Do not wrap in markdown tags like \`\`\`json.`;
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: groqPrompt }],
                response_format: { type: 'json_object' },
                temperature: 0.7
            })
        });

        if (!response.ok) {
            throw new Error(`Groq API Error: ${await response.text()}`);
        }

        const data = await response.json();
        console.log(`[Groq] Generated in ${Date.now() - start}ms`);
        const content = data.choices[0].message.content;
        const parsed = JSON.parse(content);
        return count === 1 ? parsed.questions[0] : parsed.questions;
      };

      let rawData;
      let usedProvider = provider;

      if (provider === "gemini" || provider === "auto") {
        try {
          rawData = await generateWithGemini();
          usedProvider = 'gemini';
        } catch (error: any) {
          console.error("[Gemini] Error:", error?.message || error);
          if (provider === "auto") {
            console.log("[Auto] Falling back to Groq...");
            rawData = await generateWithGroq();
            usedProvider = 'groq';
          } else {
            throw error;
          }
        }
      } else if (provider === "groq") {
        rawData = await generateWithGroq();
        usedProvider = 'groq';
      }

      let questions = [];

      if (count === 1) {
        questions = [{
          ...rawData,
          id: crypto.randomUUID(),
          subject,
          topic: topics[0],
          difficulty,
          _provider: usedProvider
        }];
      } else {
        questions = rawData.map((q: any) => ({
          ...q,
          id: crypto.randomUUID(),
          subject,
          topic: topics[Math.floor(Math.random() * topics.length)],
          difficulty,
          _provider: usedProvider
        }));
      }

      res.json({ questions });
    } catch (error) {
      console.error("Generation failed:", error);
      res.status(500).json({ error: "Generation failed" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files from dist
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
