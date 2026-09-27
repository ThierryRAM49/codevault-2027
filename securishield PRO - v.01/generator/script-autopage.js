i// generator/script-autopage.js
const { callGPT5 } = require('../ai/gpt5-client'); // ou n'importe quelle IA disponible

exports.generatePageFromPrompt = async (prompt, framework = 'react') => {
  const systemPrompt = `
Tu es un expert React/HTML/CSS. Génère une page moderne, responsive, accessible.
Pas d'explication, seulement le code. Utilise Tailwind si demandé.
Framework: ${framework}
Prompt: ${prompt}
`;

  try {
    const code = await callGPT5(systemPrompt); // ou Qwen3, Kimi, etc.
    return code || `<div>Error: No response from AI</div>`;
  } catch (err) {
    return `<div class="text-red-500">Erreur IA: ${err.message}</div>`;
  }
};
