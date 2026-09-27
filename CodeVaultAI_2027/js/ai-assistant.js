/**
 * CodeVaultAI - Assistant IA Laetitia
 * Avec analyse de code et détection auto d'une IA locale (Ollama, LM Studio, etc.)
 */

class CodeVaultAI {
  constructor() {
    this.name = "Laetitia";
    this.version = "2027";
    this.chatHistory = JSON.parse(localStorage.getItem('cvai-chat')) || [];

    // Serveurs d'IA locaux connus, sondés dans cet ordre sur la machine du
    // visiteur (jamais sur le serveur) au premier chargement. Le premier qui
    // répond est utilisé automatiquement, sans configuration.
    this.providers = [
      { id: 'ollama', label: 'Ollama', baseUrl: 'http://localhost:11434', probePath: '/api/tags', api: 'ollama' },
      { id: 'lmstudio', label: 'LM Studio', baseUrl: 'http://localhost:1234', probePath: '/v1/models', api: 'openai' },
      { id: 'litellm', label: 'LiteLLM (routeur)', baseUrl: 'http://localhost:4000', probePath: '/v1/models', api: 'openai' },
      { id: 'textgen-webui', label: 'text-generation-webui', baseUrl: 'http://localhost:5000', probePath: '/v1/models', api: 'openai' },
      { id: 'llamacpp', label: 'llama.cpp server', baseUrl: 'http://localhost:8080', probePath: '/v1/models', api: 'openai' },
      { id: 'jan', label: 'Jan', baseUrl: 'http://localhost:1337', probePath: '/v1/models', api: 'openai' },
      { id: 'opencode', label: 'OpenCode', baseUrl: 'http://localhost:4096', probePath: '/doc', api: 'opencode' },
    ];

    this.activeProvider = null;
    this.ollamaModel = null;
    this.ollamaAvailable = false;

    // Secours cloud (Claude Haiku, via le serveur riad-design.cloud) —
    // n'existe que si le serveur a une clé Anthropic configurée (injecté
    // dans window.CODEVAULT_AI_FALLBACK par CodevaultController::app()).
    // N'est utilisé qu'en dernier recours, si aucune IA locale n'est trouvée.
    this.anthropicFallbackConfigured = typeof window !== 'undefined' && window.CODEVAULT_AI_FALLBACK === true;

    // Clé API personnelle de l'utilisateur (stockée localement, jamais envoyée
    // au serveur). Provider cloud par défaut : Nebius AI Studio (API
    // OpenAI-compatible) — voir aussi OpenAI, Groq, OpenRouter.
    this.userKey = (localStorage.getItem('cvai-ai-key') || '').trim();
    this.userBase = (localStorage.getItem('cvai-ai-base') || 'https://api.studio.nebius.ai').replace(/\/+$/, '');
    this.userModel = (localStorage.getItem('cvai-ai-model') || 'Qwen/Qwen2.5-Coder-32B-Instruct').trim();

    // Détecter une IA locale disponible
    this.detectLocalAI();
  }

  /**
   * Sonde tous les serveurs IA locaux connus en parallèle et retient le
   * premier qui répond. Si aucun ne répond, retombe sur le secours cloud
   * Anthropic s'il est configuré côté serveur.
   */
  async detectLocalAI() {
    if (this.userKey) {
      const label = this.userBase.includes('nebius') ? 'Nebius AI Studio' : 'Clé API perso';
      this.activeProvider = { id: 'user', label, baseUrl: this.userBase, model: this.userModel, api: 'openai', key: this.userKey };
      this.ollamaModel = this.userModel;
      this.ollamaAvailable = true;
      console.log(`🔑 ${label} — Laetitia utilise votre clé (${this.userModel}).`);
      return;
    }
    const results = await Promise.allSettled(this.providers.map(p => this.probeProvider(p)));
    const found = results.find(r => r.status === 'fulfilled' && r.value);

    if (found) {
      this.activeProvider = found.value;
      this.ollamaModel = this.activeProvider.model;
      this.ollamaAvailable = true;
      console.log(`🤖 ${this.activeProvider.label} détecté et disponible (modèle: ${this.ollamaModel || 'par défaut'})`);
    } else if (this.anthropicFallbackConfigured) {
      this.activeProvider = { id: 'anthropic', label: 'Claude (secours cloud)', model: 'Claude Haiku 4.5', api: 'anthropic' };
      this.ollamaModel = this.activeProvider.model;
      this.ollamaAvailable = true;
      console.log('☁️ Aucune IA locale détectée - utilisation du secours cloud Claude Haiku 4.5');
    } else {
      this.ollamaAvailable = false;
      console.log('ℹ️ Aucune IA locale détectée (Ollama, LM Studio...) - mode local uniquement');
    }
  }

  // Configure la clé API personnelle de l'utilisateur (stockée localement).
  setUserKey(key, base, model) {
    this.userKey = (key || '').trim();
    if (base) this.userBase = String(base).replace(/\/+$/, '');
    if (model) this.userModel = String(model).trim();
    try {
      localStorage.setItem('cvai-ai-key', this.userKey);
      localStorage.setItem('cvai-ai-base', this.userBase);
      localStorage.setItem('cvai-ai-model', this.userModel);
    } catch (e) { /* quota / mode privé */ }
    this.detectLocalAI();
    return this.activeProvider;
  }

  // Nebius AI Studio (API OpenAI-compatible) — provider cloud recommandé.
  useNebius(key, model) {
    return this.setUserKey(key, 'https://api.studio.nebius.ai', model || 'Qwen/Qwen2.5-Coder-32B-Instruct');
  }

  async probeProvider(provider) {
    try {
      const response = await fetch(`${provider.baseUrl}${provider.probePath}`, {
        method: 'GET',
        signal: AbortSignal.timeout(1500)
      });
      if (!response.ok) return null;

      // OpenCode's /doc is its OpenAPI spec, not a model list - presence is
      // enough to know the server is up, nothing to pick a model from.
      if (provider.api === 'opencode') {
        return { ...provider, model: null };
      }

      const data = await response.json();
      const model = provider.api === 'ollama' ? this.pickOllamaModel(data) : this.pickOpenAiModel(data);
      return { ...provider, model };
    } catch (e) {
      return null;
    }
  }

  pickOllamaModel(data) {
    if (data.models && data.models.length > 0) {
      const codeModel = data.models.find(m => m.name.includes('codellama') || m.name.includes('code'));
      return (codeModel || data.models[0]).name;
    }
    return 'codellama';
  }

  pickOpenAiModel(data) {
    const list = data.data || data.models || [];
    if (list.length === 0) return null;
    const codeModel = list.find(m => (m.id || m.name || '').toLowerCase().includes('code'));
    const picked = codeModel || list[0];
    return picked.id || picked.name || null;
  }

  /**
   * Analyser le code avec l'IA
   */
  async analyzeCode(code, language) {
    // D'abord, analyse locale
    const localAnalysis = window.CodeAnalyzer.analyze(code, language);

    // Si une IA locale est disponible, enrichir l'analyse
    if (this.ollamaAvailable) {
      try {
        const aiAnalysis = await this.askOllama(
          `Analyse ce code ${language} et liste les erreurs, bugs potentiels et améliorations possibles. Réponds en français, de façon concise:\n\n${code}`
        );
        localAnalysis.aiSuggestions = aiAnalysis;
      } catch (e) {
        console.warn('AI analysis failed:', e);
      }
    }

    return localAnalysis;
  }

  /**
   * Génère les métadonnées pour le mode autonome (Titre, Tags, Langage)
   */
  async generateMetadata(code, knownExt = null) {
    let lang = knownExt ? window.CodeBeautifier.detectLanguage(`_.${knownExt}`) : null;
    if (!lang || lang === 'Plain Text') {
      lang = window.CodeBeautifier.detectLanguageFromContent(code);
    }

    const result = {
      title: 'Untitled Snippet',
      tags: [],
      lang: lang || 'Plain Text'
    };

    // Si une IA locale est disponible, on lui demande
    if (this.ollamaAvailable) {
      try {
        const prompt = `Analyse ce code ${lang} et génère un titre court et descriptif ainsi que 3 tags pertinents.
Format de réponse attendu JSON uniquement: {"title": "...", "tags": ["...", "..."]}
Code:
${code.substring(0, 1000)}`; // On envoie les 1000 premiers caractères pour être rapide

        const aiResponse = await this.askOllama(prompt);
        // Tentative d'extraction du JSON
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const metadata = JSON.parse(jsonMatch[0]);
          if (metadata.title) result.title = metadata.title;
          if (metadata.tags && Array.isArray(metadata.tags)) result.tags = metadata.tags;
        }
      } catch (e) {
        console.warn('AI metadata generation failed', e);
        // Fallback heuristique simple pour le titre
        const lines = code.split('\n');
        const firstLine = lines.find(l => l.trim().length > 0 && !l.trim().startsWith('//') && !l.trim().startsWith('/*'));
        if (firstLine) result.title = firstLine.substring(0, 50);
      }
    } else {
      // Fallback hors ligne
      if (lang === 'Javascript' || lang === 'JS') result.tags.push('Frontend');
      if (lang === 'Python') result.tags.push('Script');
      if (code.includes('class ')) result.tags.push('OOP');
    }

    return result;
  }

  /**
   * Corriger le code automatiquement
   */
  async fixCode(code, language) {
    // Correction locale d'abord
    const localFix = window.CodeAnalyzer.autoFix(code, language);
    let result = { ...localFix };

    // Si une IA locale est disponible et qu'il y a des erreurs, demander une correction IA
    if (this.ollamaAvailable) {
      const analysis = window.CodeAnalyzer.analyze(code, language);

      if (analysis.errors.length > 0) {
        try {
          const prompt = `Corrige ce code ${language} en gardant exactement le même style et la même structure.
Ne change que ce qui est nécessaire pour corriger les erreurs.
Retourne UNIQUEMENT le code corrigé, sans explications:

${code}`;

          const aiFixed = await this.askOllama(prompt);

          // Extraire le code de la réponse (entre \`\`\` si présent)
          let cleanCode = aiFixed;
          const codeBlockMatch = aiFixed.match(/```[\w]*\n?([\s\S]*?)```/);
          if (codeBlockMatch) {
            cleanCode = codeBlockMatch[1].trim();
          }

          // Vérifier que le code corrigé est valide
          const newAnalysis = window.CodeAnalyzer.analyze(cleanCode, language);
          if (newAnalysis.errors.length < analysis.errors.length) {
            result.code = cleanCode;
            result.fixes.push('Correction IA appliquée');
            result.aiUsed = true;
          }
        } catch (e) {
          console.warn('AI fix failed:', e);
        }
      }
    }

    return result;
  }

  /**
   * Formater le code avec l'IA
   */
  async formatCode(code, language) {
    // Formatage local d'abord
    let formatted = window.CodeBeautifier.beautify(code, language);

    // Si une IA locale est disponible, demander un formatage plus intelligent
    if (this.ollamaAvailable && code.length < 3000) {
      try {
        const prompt = `Formate ce code ${language} proprement en gardant la même logique.
Améliore l'indentation et la lisibilité.
Retourne UNIQUEMENT le code formaté:

${code}`;

        const aiFormatted = await this.askOllama(prompt);

        // Extraire le code de la réponse
        let cleanCode = aiFormatted;
        const codeBlockMatch = aiFormatted.match(/```[\w]*\n?([\s\S]*?)```/);
        if (codeBlockMatch) {
          cleanCode = codeBlockMatch[1].trim();
        }

        // Utiliser le résultat IA seulement s'il est raisonnable
        if (cleanCode.length > code.length * 0.5 && cleanCode.length < code.length * 2) {
          formatted = cleanCode;
        }
      } catch (e) {
        console.warn('AI format failed, using local format');
      }
    }

    return formatted;
  }

  /**
   * Demander au serveur IA local détecté (Ollama, OpenCode, ou tout serveur
   * compatible OpenAI comme LM Studio, LiteLLM, text-generation-webui, llama.cpp...)
   */
  async askOllama(prompt) {
    if (!this.ollamaAvailable || !this.activeProvider) {
      throw new Error('Aucune IA locale disponible');
    }

    if (this.activeProvider.api === 'ollama') return this.askOllamaNative(prompt);
    if (this.activeProvider.api === 'opencode') return this.askOpenCode(prompt);
    if (this.activeProvider.api === 'anthropic') return this.askAnthropicFallback(prompt);
    return this.askOpenAiCompatible(prompt);
  }

  // Secours cloud : passe par notre propre serveur (jamais d'appel direct
  // au navigateur vers l'API Anthropic, la clé reste côté serveur). Protégé
  // par la même session que /app et un jeton CSRF injecté au chargement.
  async askAnthropicFallback(prompt) {
    const response = await fetch('/ai/anthropic', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': (typeof window !== 'undefined' && window.CODEVAULT_CSRF) || ''
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Anthropic fallback error: ${err.error || response.status}`);
    }

    const data = await response.json();
    return data.reply || '';
  }

  async askOllamaNative(prompt) {
    const response = await fetch(`${this.activeProvider.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.activeProvider.model || 'codellama',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 1000
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  // OpenCode's server API is session-based (not a plain "prompt in, text
  // out" endpoint like Ollama/OpenAI): create a session, then post the
  // message to it and read the reply from the same synchronous response.
  // Field names follow OpenCode's documented request/response shape; not
  // verified against a live instance from here.
  async askOpenCode(prompt) {
    const sessionResponse = await fetch(`${this.activeProvider.baseUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'CodeVaultAI' })
    });

    if (!sessionResponse.ok) {
      throw new Error(`OpenCode error: ${sessionResponse.status}`);
    }

    const session = await sessionResponse.json();
    const sessionId = session.id || session.sessionID || (session.session && session.session.id);
    if (!sessionId) {
      throw new Error('OpenCode: session id introuvable dans la réponse');
    }

    const messageResponse = await fetch(`${this.activeProvider.baseUrl}/session/${sessionId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parts: [{ type: 'text', text: prompt }] })
    });

    if (!messageResponse.ok) {
      throw new Error(`OpenCode error: ${messageResponse.status}`);
    }

    const result = await messageResponse.json();
    const parts = result.parts || [];
    const textPart = parts.find(p => p && p.type === 'text' && typeof p.text === 'string')
      || parts.find(p => p && typeof p.text === 'string');

    return textPart ? textPart.text : '';
  }

  async askOpenAiCompatible(prompt) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.activeProvider.key) headers['Authorization'] = `Bearer ${this.activeProvider.key}`;
    const response = await fetch(`${this.activeProvider.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.activeProvider.model || 'local-model',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`${this.activeProvider.label} error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
  }

  /**
   * Chat avec Laetitia
   */
  async reply(userInput) {
    const input = userInput.toLowerCase().trim();

    // Réponses prédéfinies
    const responses = {
      "bonjour": "Bonjour, créateur ! 👋 Je suis Laetitia, ton assistante IA. Je peux analyser et corriger ton code automatiquement. Que puis-je faire pour toi ?",
      "qui es-tu": "Je suis Laetitia, ton assistant IA local intégré dans CodeVaultAI_2027. Je peux analyser ton code, détecter les erreurs et les corriger automatiquement tout en respectant ton style ! 🤖",
      "aide": "Voici ce que je peux faire :\n• 🔍 Analyser ton code pour trouver les erreurs\n• 🔧 Corriger automatiquement les problèmes\n• ✨ Formater et beautifier le code\n• 💬 Répondre à tes questions sur le code\n\nClique sur 'Analyser' ou 'Auto-Fix' dans l'éditeur !",
      "merci": "Merci à toi, papa. C'est un honneur de t'aider à coder ! 💙",
      "ollama": this.ollamaAvailable
        ? `✅ ${this.activeProvider.label} est connecté ! Modèle: ${this.ollamaModel || 'par défaut'}`
        : "❌ Aucune IA locale détectée. Si Ollama ou LM Studio tourne déjà chez toi, c'est probablement le CORS qui bloque : par défaut ils n'acceptent que les requêtes venant de localhost, pas de ce site.\n\n• Ollama : relance-le avec OLLAMA_ORIGINS=https://riad-design.cloud ollama serve\n• LM Studio : onglet Developer → Settings → active \"Enable CORS\"\n\nSinon, installe l'un des deux : https://ollama.ai ou https://lmstudio.ai — je le détecterai automatiquement une fois le CORS ouvert.",
      "status": this.getStatus()
    };

    // Check for code-related questions
    if (input.includes('analyse') || input.includes('erreur') || input.includes('bug')) {
      return "Pour analyser ton code, ouvre un snippet et clique sur le bouton 🔍 **Analyser**. Je détecterai les erreurs et te proposerai des corrections !";
    }

    if (input.includes('corriger') || input.includes('fix') || input.includes('répare')) {
      return "Pour corriger automatiquement ton code, ouvre un snippet et clique sur 🔧 **Auto-Fix**. Je corrigerai les erreurs tout en gardant ton style de code !";
    }

    let reply = responses[input];

    // Si une IA locale est disponible et pas de réponse prédéfinie, l'utiliser
    if (!reply && this.ollamaAvailable) {
      try {
        reply = await this.askOllama(`Tu es Laetitia, une assistante IA pour développeurs. Réponds brièvement en français à: ${userInput}`);
      } catch (e) {
        reply = `Bonne question : "${userInput}". Je réfléchis... mais mon module IA semble occupé. 🤔`;
      }
    }

    if (!reply) {
      reply = `Je comprends ta question sur "${userInput}". ${this.ollamaAvailable ? "Laisse-moi analyser..." : "Pour des réponses plus avancées, lance Ollama ou LM Studio en local !"}`;
    }

    // Sauvegarder l'historique
    const message = { user: userInput, ai: reply, timestamp: new Date().toISOString() };
    this.chatHistory.push(message);
    if (this.chatHistory.length > 50) {
      this.chatHistory = this.chatHistory.slice(-50);
    }
    localStorage.setItem('cvai-chat', JSON.stringify(this.chatHistory));

    return reply;
  }

  getStatus() {
    return `📊 **Status Laetitia**
• Version: ${this.version}
• IA locale: ${this.ollamaAvailable ? `✅ ${this.activeProvider.label} connecté (${this.ollamaModel || 'modèle par défaut'})` : "❌ Non détectée — tape \"ollama\" si tu penses qu'elle devrait l'être (souvent un problème de CORS)"}
• Historique: ${this.chatHistory.length} messages
• Analyseurs: JS, TS, JSON, CSS, Python, HTML`;
  }

  getHistory() {
    return this.chatHistory;
  }

  clearHistory() {
    this.chatHistory = [];
    localStorage.removeItem('cvai-chat');
  }

  isOllamaAvailable() {
    return this.ollamaAvailable;
  }
}

// Export global
window.CodeVaultAI = new CodeVaultAI();
