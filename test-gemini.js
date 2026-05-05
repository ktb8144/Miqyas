const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.GEMINI_API_KEY;
const CANDIDATES = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash-001",
  "gemini-2.0-flash-lite-001",
  "gemini-flash-latest",
  "gemini-pro-latest",
];

async function tryModel(name) {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: name });
    const result = await model.generateContent("قل مرحباً");
    return `✅ ${name}: ${result.response.text().trim().substring(0, 60)}`;
  } catch (e) {
    const code = e.message.match(/\[(\d{3})/)?.[1] ?? "???";
    return `❌ ${name}: [${code}] ${e.message.split("]").pop().trim().substring(0, 80)}`;
  }
}

(async () => {
  for (const m of CANDIDATES) {
    console.log(await tryModel(m));
  }
})();
