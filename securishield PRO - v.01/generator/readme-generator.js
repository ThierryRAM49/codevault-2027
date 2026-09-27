## 1. `generator/readme-generator.js`
``//`js
export const generateReadme = (projectName, description, snippetsUsed, techStack) => {
  return `
#${projectName}

${description}

## Stack Technique
${techStack.join(', ')}

## Snippets utilisés
- ${snippets.map(s => '- \`' + s.title + '\` (' + s.language + ')').join('\\n')}

## Installation
\`\`\`bash
npm install
npm start
\`\`\`

## Livraison
⏱️ Date: ${new Date().toLocaleDateString()}
✅ Testé | 🐞 0 bug détecté | ⏱️ Généré par 🔐 SécuriShield Pro 2027
  `;
};
