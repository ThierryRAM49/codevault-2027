// function loadSnippets() { ... } // Supprimé
// function saveSnippets(snippets) { ... } // Supprimé

// Composant logo animé (lettres néon cyan/bleu qui apparaissent puis pulsent en boucle)
const HOLOGRAM_STEP = 0.3;
const HOLOGRAM_INTRO_DURATION = 1.6;
const HOLOGRAM_CYCLE_DURATION = 11; // doit correspondre à la durée de hologram-cycle dans style.css

function hologramLetterStyle(index) {
  return {
    '--d': `${index * HOLOGRAM_STEP}s`,
    '--ld': `${index * HOLOGRAM_STEP + HOLOGRAM_INTRO_DURATION}s`,
  };
}

const HologramLogo = ({ text }) => {
  const [animate, setAnimate] = React.useState(false);
  const [loopKey, setLoopKey] = React.useState(0);
  const restarted = React.useRef(false);

  // Array.from (pas .split('')) pour ne pas couper les caractères multi-unités.
  const letters = React.useMemo(() => Array.from(text), [text]);
  const cycleDelay = (letters.length - 1) * HOLOGRAM_STEP + HOLOGRAM_INTRO_DURATION + 1.5;
  const totalLoopMs = (cycleDelay + HOLOGRAM_CYCLE_DURATION) * 1000;

  React.useEffect(() => {
    restarted.current = false;
    let frame = 0;

    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const target = performance.now() + totalLoopMs;
        setAnimate(true);

        const tick = () => {
          if (performance.now() >= target) {
            if (!restarted.current) {
              restarted.current = true;
              setAnimate(false);
              setLoopKey((k) => k + 1);
            }
            return;
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [loopKey, totalLoopMs]);

  return React.createElement(
    'span',
    {
      className: animate ? 'hologram-logo is-animating' : 'hologram-logo',
      'aria-label': text,
      style: { '--cycle-delay': `${cycleDelay}s` },
    },
    React.createElement(
      'span',
      { 'aria-hidden': 'true', key: loopKey },
      letters.map((letter, i) =>
        React.createElement(
          'span',
          { key: i, className: 'hologram-letter', style: hologramLetterStyle(i) },
          letter === ' ' ? ' ' : letter
        )
      )
    )
  );
};

// Composant pour l'affichage du code avec Prism
const CodeBlock = ({ code, lang, onClick, maxLines }) => {
  const codeRef = React.useRef(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (codeRef.current && window.Prism) {
      window.Prism.highlightElement(codeRef.current);
    }
  }, [code, lang]);

  const getPrismLang = (l) => {
    // Basic mapping for special cases, otherwise lowercase
    const map = {
      'C#': 'csharp',
      'C++': 'cpp',
      'F#': 'fsharp',
      'VB.NET': 'vbnet',
      'Objective-C': 'objectivec',
      'Vue': 'javascript', // Fallback
      'React': 'jsx',
      'Angular': 'typescript'
    };
    return map[l] || l.toLowerCase();
  };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return React.createElement('div', { className: 'relative group/code' }, [
    React.createElement('pre', {
      className: `!mt-0 !mb-0 !bg-slate-900 rounded-md !p-3 cursor-pointer hover:ring-1 hover:ring-cyan-500 transition ${maxLines ? 'max-h-32 overflow-hidden' : 'h-full overflow-auto'}`,
      onClick: onClick,
      style: { margin: 0 }
    },
      React.createElement('code', {
        ref: codeRef,
        className: `language-${getPrismLang(lang)}`
      }, code)
    ),
    React.createElement('button', {
      onClick: handleCopy,
      className: `absolute top-2 right-2 p-1.5 rounded bg-slate-700 text-xs text-white opacity-0 group-hover/code:opacity-100 transition hover:bg-slate-600 ${copied ? '!opacity-100 !bg-green-600' : ''}`,
      title: 'Copier',
      'aria-label': copied ? 'Code copié' : 'Copier le code'
    }, copied ? '✅' : '📋')
  ]);
};

// Composant Wrapper pour Monaco Editor
const MonacoEditorWrapper = ({ value, language, onChange, readOnly, theme = 'vs-dark', fontSize = 14 }) => {
  const divEl = React.useRef(null);
  const editorRef = React.useRef(null);
  const onChangeRef = React.useRef(onChange); // Ref to keep latest handler

  // Update handler ref when prop changes
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (divEl.current) {
      if (window.require) {
        window.require(['vs/editor/editor.main'], () => {
          const langMap = {
            'JS': 'javascript', 'TypeScript': 'typescript', 'JSON': 'json', 'CSS': 'css',
            'SCSS': 'scss', 'Python': 'python', 'Bash': 'shell', 'HTML': 'html', 'React': 'javascript',
            'C': 'c', 'C++': 'cpp', 'C#': 'csharp', 'Java': 'java', 'Go': 'go', 'Rust': 'rust',
            'PHP': 'php', 'Ruby': 'ruby', 'Swift': 'swift', 'Kotlin': 'kotlin', 'SQL': 'sql',
            'XML': 'xml', 'YAML': 'yaml', 'Markdown': 'markdown', 'Lua': 'lua', 'Dart': 'dart',
            'Perl': 'perl', 'R': 'r', 'Powershell': 'powershell', 'Docker': 'dockerfile'
          };
          const monacoLang = langMap[language] || 'plaintext';

          editorRef.current = window.monaco.editor.create(divEl.current, {
            value: value,
            language: monacoLang,
            theme: theme,
            readOnly: readOnly,
            minimap: { enabled: true },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            fontSize: fontSize,
            fontFamily: "'Fira Code', Consolas, 'Courier New', monospace",
            padding: { top: 16 }
          });

          // Event Listener uses Ref to avoid stale closure
          editorRef.current.onDidChangeModelContent(() => {
            if (!readOnly && onChangeRef.current) {
              const modelVal = editorRef.current.getValue();
              onChangeRef.current(modelVal);
            }
          });
        });
      }
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []);

  // Update options if fontSize changes
  React.useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({ fontSize: fontSize });
    }
  }, [fontSize]);

  // Handle prop updates dynamically
  React.useEffect(() => {
    if (editorRef.current) {
      const model = editorRef.current.getModel();

      // CRITICAL: Only update if the model value implies an external change
      // logic: if model.getValue() != value, it means the parent has a different idea
      // than the editor. BUT we must be careful not to overwrite user typing.
      // Since we push changes to parent immediately, parent 'value' should match 'model' eventually.
      // If they mismatch, it's either a lag (ignore) or an external change (format/reset).
      // We rely on checking if the value is strictly different.
      if (model && value !== model.getValue()) {
        const currentPos = editorRef.current.getPosition();
        editorRef.current.setValue(value);
        if (currentPos) {
          editorRef.current.setPosition(currentPos);
        }
      }
    }
  }, [value, readOnly]);

  React.useEffect(() => {
    if (editorRef.current) {
      window.monaco.editor.setModelLanguage(editorRef.current.getModel(), language.toLowerCase());
    }
  }, [language]);


  return React.createElement('div', { ref: divEl, className: 'w-full h-full min-h-[400px] border border-slate-700/0 rounded-md overflow-hidden' });
};

// Composant TagInput
const TagInput = ({ tags = [], onChange, suggestions = [] }) => {
  const [input, setInput] = React.useState('');

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput('');
    }
  };

  const removeTag = (tag) => {
    onChange(tags.filter(t => t !== tag));
  };

  return React.createElement('div', { className: 'flex flex-wrap items-center gap-2 p-2 bg-black/50 border border-slate-700/50 rounded-lg min-h-[42px] focus-within:ring-1 focus-within:ring-cyan-500' }, [
    tags.map(tag =>
      React.createElement('span', { key: tag, className: 'bg-cyan-900/40 text-cyan-300 px-2 py-0.5 rounded text-xs flex items-center gap-1 border border-cyan-500/30' }, [
        tag,
        React.createElement('button', { onClick: () => removeTag(tag), className: 'hover:text-white font-bold ml-1', 'aria-label': `Retirer le tag ${tag}` }, '×')
      ])
    ),
    React.createElement('input', {
      type: 'text',
      value: input,
      onChange: (e) => setInput(e.target.value),
      onKeyDown: handleKeyDown,
      onBlur: addTag,
      placeholder: tags.length === 0 ? 'Add tags...' : '',
      className: 'bg-transparent outline-none text-sm text-white flex-1 min-w-[60px]'
    })
  ]);
};

// Composant DiffModal
const DiffModal = ({ original, modified, onConfirm, onCancel, language = 'javascript' }) => {
  const containerRef = React.useRef(null);
  const diffEditorRef = React.useRef(null);

  React.useEffect(() => {
    if (containerRef.current && window.monaco) {
      diffEditorRef.current = window.monaco.editor.createDiffEditor(containerRef.current, {
        originalEditable: false,
        readOnly: true,
        theme: 'vs-dark',
        automaticLayout: true
      });

      const originalModel = window.monaco.editor.createModel(original, language);
      const modifiedModel = window.monaco.editor.createModel(modified, language);

      diffEditorRef.current.setModel({
        original: originalModel,
        modified: modifiedModel
      });

      return () => {
        if (diffEditorRef.current) {
          diffEditorRef.current.dispose();
          originalModel.dispose();
          modifiedModel.dispose();
        }
      };
    }
  }, []);

  return React.createElement('div', { className: 'fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-6' },
    React.createElement('div', { className: 'w-full max-w-7xl h-[85vh] bg-[#0a0a15] rounded-xl border border-cyan-500/30 flex flex-col shadow-2xl' }, [
      React.createElement('div', { className: 'p-4 border-b border-cyan-500/20 flex justify-between items-center bg-black/40' }, [
        React.createElement('h2', { className: 'text-xl font-bold text-cyan-400 flex items-center gap-2' }, [
          React.createElement('span', null, '⚖️'),
          'Review Auto-Fix Changes'
        ]),
        React.createElement('div', { className: 'flex items-center gap-4 text-xs' }, [
          React.createElement('span', { className: 'text-red-400' }, 'Original'),
          React.createElement('span', { className: 'text-green-400' }, 'Modified')
        ])
      ]),
      React.createElement('div', { ref: containerRef, className: 'flex-1 overflow-hidden bg-black/20' }),
      React.createElement('div', { className: 'p-4 border-t border-cyan-500/20 flex justify-end gap-3 bg-black/40' }, [
        React.createElement('button', {
          onClick: onCancel,
          className: 'px-4 py-2 text-slate-300 hover:text-white transition'
        }, 'Cancel'),
        React.createElement('button', {
          onClick: onConfirm,
          className: 'px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg shadow-lg hover:shadow-green-500/30 transition'
        }, 'Apply Fixes')
      ])
    ])
  );
};

// Composant pour les suggestions de recherche
const SearchSuggestions = ({ query, snippets, onSelect }) => {
  if (!query) return null;

  const matches = snippets.filter(s =>
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    (Array.isArray(s.tags) && s.tags.some(t => typeof t === 'string' && t.toLowerCase().includes(query.toLowerCase())))
  ).slice(0, 5); // Max 5 suggestions

  if (matches.length === 0) return null;

  return React.createElement('div', { className: 'absolute top-full left-0 right-0 bg-slate-800 border border-slate-600 rounded-md mt-1 z-20 shadow-xl' },
    matches.map(s =>
      React.createElement('div', {
        key: s.id,
        onClick: () => onSelect(s.title),
        className: 'p-2 hover:bg-slate-700 cursor-pointer text-sm text-gray-300 flex justify-between'
      }, [
        React.createElement('span', { className: 'font-bold text-cyan-400' }, s.title),
        React.createElement('span', { className: 'text-xs bg-slate-900 px-2 rounded text-gray-500' }, (s.tags || []).join(', '))
      ])
    )
  );
};


const EditModal = ({ snippet, onSave, onCancel, themes }) => {
  // Local State to isolate re-renders
  const [localSnippet, setLocalSnippet] = React.useState({ ...snippet });
  const [analysisResult, setAnalysisResult] = React.useState(null);
  const [diffResult, setDiffResult] = React.useState(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isFixing, setIsFixing] = React.useState(false);

  // Sync state if prop changes (rare in this flow but good practice)
  React.useEffect(() => {
    setLocalSnippet({ ...snippet });
  }, [snippet.id]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await window.CodeVaultAI.analyzeCode(localSnippet.code, localSnippet.lang);
      setAnalysisResult(result);
    } catch (err) {
      setAnalysisResult({ errors: [{ line: 0, message: 'Erreur lors de l\'analyse' }], warnings: [], suggestions: [] });
    }
    setIsAnalyzing(false);
  };

  const handleAutoFix = async () => {
    setIsFixing(true);
    try {
      const result = await window.CodeVaultAI.fixCode(localSnippet.code, localSnippet.lang);
      if (result.code !== localSnippet.code) {
        setDiffResult({ original: localSnippet.code, modified: result.code });
      } else {
        alert('✅ Aucune correction nécessaire !');
      }
    } catch (err) {
      alert('❌ Erreur lors de la correction');
    }
    setIsFixing(false);
  };

  const handleBeautify = async () => {
    try {
      const formatted = await window.CodeVaultAI.formatCode(localSnippet.code, localSnippet.lang);
      setLocalSnippet(prev => ({ ...prev, code: formatted }));
    } catch (err) {
      const beautified = window.CodeBeautifier.beautify(localSnippet.code, localSnippet.lang);
      setLocalSnippet(prev => ({ ...prev, code: beautified }));
    }
  };

  // Render Analysis Panel
  const renderAnalysis = () => {
    if (!analysisResult) return null;
    const { errors, warnings, suggestions, aiSuggestions } = analysisResult;
    const hasIssues = errors.length > 0 || warnings.length > 0 || suggestions.length > 0;
    return React.createElement('div', { className: 'mt-3 p-3 bg-black/50 backdrop-blur-md border border-cyan-900/50 rounded-lg text-sm max-h-40 overflow-y-auto' }, [
      !hasIssues && React.createElement('p', { className: 'text-green-400 font-bold drop-shadow-[0_0_5px_rgba(74,222,128,0.5)]' }, '✅ Aucun problème détecté !'),
      errors.map((e, i) => React.createElement('p', { key: `e-${i}`, className: 'text-red-400 ml-4 text-xs' }, `• Ligne ${e.line}: ${e.message}`)),
      suggestions.map((s, i) => React.createElement('p', { key: `s-${i}`, className: 'text-cyan-300 ml-4 text-xs' }, `• Ligne ${s.line}: ${s.message}`)),
      aiSuggestions && React.createElement('div', { className: 'mt-2 pt-2 border-t border-cyan-900/30' }, [
        React.createElement('p', { className: 'text-fuchsia-400 font-bold drop-shadow-[0_0_5px_rgba(232,121,249,0.5)]' }, '🤖 Analyse IA:'),
        React.createElement('p', { className: 'text-fuchsia-200 ml-4 text-xs' }, aiSuggestions)
      ])
    ]);
  };

  return React.createElement('div', { className: 'fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-40' },
    React.createElement('div', { className: 'bg-[#0a0a1a] p-6 rounded-2xl w-11/12 md:w-3/4 lg:w-2/3 max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(139,92,246,0.3)] border border-fuchsia-500/30' }, [
      React.createElement('div', { className: 'flex justify-between items-center mb-4 border-b border-fuchsia-500/20 pb-4' }, [
        React.createElement('h2', { className: 'text-2xl font-black text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' }, '✏️ EDIT NODE'),
        React.createElement('div', { className: 'flex gap-3' }, [
          React.createElement('button', { onClick: handleAnalyze, disabled: isAnalyzing, className: 'px-4 py-1.5 border border-purple-500/50 text-purple-300 hover:bg-purple-900/30 rounded-lg text-xs font-bold uppercase tracking-wider transition' }, isAnalyzing ? 'Scanning...' : '🔍 Analyze'),
          React.createElement('button', { onClick: handleAutoFix, disabled: isFixing, className: 'px-4 py-1.5 border border-green-500/50 text-green-300 hover:bg-green-900/30 rounded-lg text-xs font-bold uppercase tracking-wider transition' }, isFixing ? 'Patching...' : '🔧 Fix'),
          React.createElement('button', { onClick: handleBeautify, className: 'px-4 py-1.5 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/30 rounded-lg text-xs font-bold uppercase tracking-wider transition' }, '✨ Format')
        ])
      ]),
      React.createElement('div', { className: 'mb-4' },
        React.createElement(TagInput, {
          tags: localSnippet.tags || [],
          onChange: (t) => setLocalSnippet(prev => ({ ...prev, tags: t })),
          suggestions: themes
        })
      ),
      // MONACO EDITOR HERE
      React.createElement('div', { className: 'flex-1 min-h-[400px] border border-slate-700/50 rounded-lg overflow-hidden relative' },
        React.createElement(MonacoEditorWrapper, {
          value: localSnippet.code,
          language: localSnippet.lang,
          onChange: (val) => setLocalSnippet(prev => ({ ...prev, code: val }))
        })
      ),
      renderAnalysis(),
      React.createElement('div', { className: 'flex gap-4 mt-6' }, [
        React.createElement('button', { onClick: () => onSave(localSnippet), className: 'flex-1 bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-lg font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(6,182,212,0.4)] transition' }, '✅ SAVE CHANGES'),
        React.createElement('button', { onClick: onCancel, className: 'flex-1 border border-red-500/50 text-red-400 hover:bg-red-900/30 py-3 rounded-lg font-bold uppercase tracking-widest transition' }, '❌ DISCARD')
      ]),

      // Modal Diff (Nested inside EditModal)
      diffResult && React.createElement(DiffModal, {
        original: diffResult.original,
        modified: diffResult.modified,
        language: localSnippet.lang,
        onConfirm: () => {
          setLocalSnippet(prev => ({ ...prev, code: diffResult.modified }));
          setDiffResult(null);
          // Re-analyze only on confirm if wanted, effectively reusing logic
          // But since function is internal, we can just call handleAnalyze after state update
          // using a small timeout or similar, but alert is fine for now.
          alert('✅ Corrections appliquées !');
        },
        onCancel: () => setDiffResult(null)
      })
    ])
  );
};


const DEMO_EXAMPLES = {
  JS: 'var total = 10\nif (total == 10) {\n  console.log("debug leftover")\n}',
  TYPESCRIPT: 'function greet(name: any) {\n  var msg = "Hello, " + name\n  console.log(msg)\n}',
  PYTHON: 'import *\n\ndef divide(a, b):\n    print("debug", a, b)\n    try:\n        return a / b\n    except:\n        return None',
  PHP: '<?php\nfunction getUser($id) {\n    $result = mysql_query("SELECT * FROM users WHERE id = " . $id);\n    if ($result == null) {\n        var_dump("no user found");\n    }\n    return $result;\n}',
  JSON: '{\n  "name": "demo",\n  "tags": ["a", "b",],\n}',
  CSS: '.card {\n  color: red\n  background: #zzz;\n  font-size: 14px !important;\n}',
  HTML: '<div>\n  <img src="x.png">\n  <button onclick="doThing()">Go</button>\n</div>'
};
const DEMO_LANGS = [['JS', 'JavaScript'], ['TYPESCRIPT', 'TypeScript'], ['PYTHON', 'Python'], ['PHP', 'PHP'], ['JSON', 'JSON'], ['CSS', 'CSS'], ['HTML', 'HTML']];
const DEMO_BEAUTIFY_SUPPORTED = { JS: true, TYPESCRIPT: true, JSON: true, CSS: true };

const LandingPage = () => {
  const [lang, setLang] = React.useState('JS');
  const [code, setCode] = React.useState(DEMO_EXAMPLES.JS);
  const [findings, setFindings] = React.useState([]);
  const [notice, setNotice] = React.useState('');

  const findingsRows = (items, cls, icon) => (items || []).map((f, i) =>
    React.createElement('p', { key: cls + i, className: cls }, `${icon} Ligne ${f.line}: ${f.message}`));

  const analyze = () => {
    setNotice('');
    if (!window.CodeAnalyzer) return;
    const r = window.CodeAnalyzer.analyze(code, lang);
    const rows = [
      ...findingsRows(r.errors, 'text-red-400', '❌'),
      ...findingsRows(r.warnings, 'text-amber-300', '⚠️'),
      ...findingsRows(r.suggestions, 'text-cyan-300', '💡')
    ];
    setFindings(rows);
    if (rows.length === 0) setNotice('✅ Aucun problème détecté !');
  };
  const autoFix = () => {
    setNotice('');
    if (!window.CodeAnalyzer) return;
    const r = window.CodeAnalyzer.autoFix(code, lang);
    setCode(r.code);
    setFindings((r.fixes || []).map((f, i) => React.createElement('p', { key: i, className: 'text-green-300' }, '✅ ' + f)));
    if (!r.fixes || r.fixes.length === 0) setNotice('Rien à corriger automatiquement pour ce langage.');
  };
  const format = () => {
    setNotice('');
    if (!DEMO_BEAUTIFY_SUPPORTED[lang]) { setNotice("⚠️ Le formatage automatique n'est pas disponible pour ce langage."); return; }
    if (!window.CodeBeautifier) return;
    setCode(window.CodeBeautifier.beautify(code, lang));
    setFindings([]);
    setNotice('✨ Code reformaté.');
  };

  const linkCls = 'border border-cyan-500/50 bg-cyan-900/10 text-cyan-300 hover:bg-cyan-500/20 px-4 py-2 rounded-lg font-bold text-sm transition-all backdrop-blur-sm inline-flex items-center';

  return React.createElement('div', { className: 'p-6 min-h-screen' }, [
    React.createElement('div', { className: 'max-w-5xl mx-auto' }, [
      React.createElement('div', { className: 'flex flex-wrap justify-end gap-3 mb-8' }, [
        React.createElement('a', { key: 'p', href: 'https://portfolio.riad-design.cloud/', target: '_blank', rel: 'noopener', className: linkCls }, '👤 MON PORTFOLIO →'),
        React.createElement('a', { key: 'd', href: 'https://devops.riad-design.cloud/', target: '_blank', rel: 'noopener', className: linkCls }, '🛠️ OUTIL DEVOPS →')
      ]),
      React.createElement('h1', { className: 'text-5xl font-black flex items-center gap-3 justify-center' }, [
        React.createElement('span', { key: 'e', 'aria-hidden': 'true' }, '🔐'),
        React.createElement(HologramLogo, { key: 'l', text: 'CodeVaultAI' })
      ]),
      React.createElement('p', { className: 'text-center text-cyan-200/70 mt-3 mb-10 font-mono text-sm tracking-widest uppercase' }, 'Le coffre-fort de vos snippets de code'),
      React.createElement('div', { className: 'bg-black/30 backdrop-blur-md border border-cyan-500/15 rounded-2xl p-6 mb-8' }, [
        React.createElement('h2', { className: 'text-xl font-bold text-white mb-2' }, '🧪 Essayez en direct'),
        React.createElement('p', { className: 'text-sm text-cyan-200/60 mb-4' }, "Le vrai moteur d'analyse de CodeVaultAI — sans compte, sans envoi au serveur."),
        React.createElement('div', { className: 'flex items-center gap-3 mb-3' }, [
          React.createElement('label', { className: 'text-sm text-gray-400' }, 'Langage :'),
          React.createElement('select', {
            value: lang,
            onChange: (e) => { const l = e.target.value; setLang(l); setCode(DEMO_EXAMPLES[l] || ''); setFindings([]); setNotice(''); },
            className: 'bg-black/50 border border-cyan-900/50 rounded-lg text-cyan-100 px-3 py-2 text-sm focus:border-cyan-400 outline-none'
          }, DEMO_LANGS.map(([v, label]) => React.createElement('option', { key: v, value: v }, label)))
        ]),
        React.createElement('textarea', {
          value: code, spellCheck: false,
          onChange: (e) => { setCode(e.target.value); setFindings([]); setNotice(''); },
          className: 'w-full min-h-[140px] bg-black/50 border border-cyan-900/50 rounded-lg text-slate-200 p-3 font-mono text-sm resize-y focus:border-cyan-400 outline-none mb-3'
        }),
        React.createElement('div', { className: 'flex gap-3 flex-wrap' }, [
          React.createElement('button', { key: 'a', onClick: analyze, className: 'px-4 py-2 rounded-lg font-bold text-sm text-white bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500' }, '🔍 Analyser'),
          React.createElement('button', { key: 'f', onClick: autoFix, className: 'px-4 py-2 rounded-lg font-bold text-sm border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10' }, '🔧 Auto-Fix'),
          React.createElement('button', { key: 'm', onClick: format, className: 'px-4 py-2 rounded-lg font-bold text-sm border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10' }, '✨ Formater')
        ]),
        (notice || findings.length > 0) && React.createElement('div', { className: 'mt-4 text-sm space-y-1' }, [
          notice && React.createElement('p', { key: 'n', className: 'text-green-300' }, notice),
          findings
        ])
      ]),
      React.createElement('p', { className: 'text-center text-sm text-cyan-200/50' }, "🔒 L'accès complet (coffre, éditeur Monaco, assistant IA) se fait via l'application de bureau.")
    ])
  ]);
};

const App = () => {
  const [userRole, setUserRole] = React.useState(null); // 'admin' | 'user' | null
  const [password, setPassword] = React.useState(''); // Token Input
  const [loginError, setLoginError] = React.useState('');
  const [snippets, setSnippets] = React.useState([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [newTitle, setNewTitle] = React.useState('');
  const [newLang, setNewLang] = React.useState('JS');
  const [newTags, setNewTags] = React.useState([]);
  const [editingSnippet, setEditingSnippet] = React.useState(null);
  const [autonomousMode, setAutonomousMode] = React.useState(() => {
    return localStorage.getItem('cvai-autonomous') === 'true';
  });
  const [maximizedSnippet, setMaximizedSnippet] = React.useState(null); // Nouveau state
  const [showChat, setShowChat] = React.useState(false);
  const [chatInput, setChatInput] = React.useState('');
  const [chatMessages, setChatMessages] = React.useState([]);
  const chatEndRef = React.useRef(null);

  // Drag & Drop
  const [draggedItem, setDraggedItem] = React.useState(null);
  const [isDraggingFile, setIsDraggingFile] = React.useState(false);
  const dragCounter = React.useRef(0); // Counter to track drag depth

  React.useEffect(() => {
    // Check if running in detached mode
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    const id = params.get('id');

    if (mode === 'detached' && id) {
      // Load specific snippet
      window.electronAPI.getSnippets().then(all => {
        const found = all.find(s => s.id == id); // Loose equality for string/int
        if (found) {
          // We simulate maximized mode but slightly different
          setSnippets([found]); // Just to have it in context if needed
          setMaximizedSnippet(found);
        }
      });
    } else {
      loadData();
    }
  }, []);

  React.useEffect(() => {
    // GLOBAL DnD HANDLER with Counter Strategy
    const handleGlobalDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Strict Check: Must be a File
      if (!e.dataTransfer || !e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) {
        return;
      }

      dragCounter.current += 1;
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDraggingFile(true);
      }
    };

    const handleGlobalDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current -= 1;
      if (dragCounter.current <= 0) {
        setIsDraggingFile(false);
        dragCounter.current = 0; // Reset safety
      }
    };

    const handleGlobalDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (isDraggingFile) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleGlobalDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Reset Everything
      setIsDraggingFile(false);
      dragCounter.current = 0;

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImportFiles({ target: { files: e.dataTransfer.files, value: '' } });
      }
    };

    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsDraggingFile(false);
        dragCounter.current = 0;
      }
    };

    document.addEventListener('dragenter', handleGlobalDragEnter);
    document.addEventListener('dragleave', handleGlobalDragLeave); // Added Leave Listener
    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);
    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('dragenter', handleGlobalDragEnter);
      document.removeEventListener('dragleave', handleGlobalDragLeave);
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isDraggingFile]);

  React.useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  // Debounced search effect
  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-login on mount (must run unconditionally, before any early return,
  // to keep hook call order stable across renders — see Rules of Hooks).
  // The server (CodevaultController::app()) already resolved and injected
  // the visitor's role based on the email they confirmed through the access
  // gate — trust that over the old per-browser token store when present.
  React.useEffect(() => {
    if (window.CODEVAULT_ROLE === 'admin' || window.CODEVAULT_ROLE === 'user' || window.CODEVAULT_ROLE === 'trial') {
      setUserRole(window.CODEVAULT_ROLE);
      // Trial sessions get 2-3 example snippets seeded into their (per-browser,
      // never-sent-to-server) vault so there's something to actually look at —
      // a brand new visitor's IndexedDB is otherwise empty. Only seeds once
      // (checks emptiness first), never overwrites real content.
      if (window.CODEVAULT_ROLE === 'trial') {
        window.electronAPI.getSnippets().then((existing) => {
          if (existing && existing.length > 0) return;
          const examples = [
            {
              title: 'Debounce (JS)',
              lang: 'JS',
              tags: ['Utilitaire'],
              code: "function debounce(fn, delay) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), delay);\n  };\n}"
            },
            {
              title: 'Slugify (Python)',
              lang: 'Python',
              tags: ['Script'],
              code: "import re\n\ndef slugify(text):\n    text = text.lower().strip()\n    text = re.sub(r'[^a-z0-9]+', '-', text)\n    return text.strip('-')"
            },
            {
              title: 'Card component (CSS)',
              lang: 'CSS',
              tags: ['UI'],
              code: ".card {\n  border-radius: 12px;\n  padding: 16px;\n  box-shadow: 0 4px 20px rgba(0,0,0,0.15);\n}"
            }
          ];
          examples.forEach((snippet) => window.electronAPI.addSnippet(snippet));
          setTimeout(loadData, 100);
        });
      }
      return;
    }
    const storedToken = localStorage.getItem('cvai-token');
    if (storedToken) {
      handleLogin(storedToken, true);
    }
  }, []);

  // Helper pour sécuriser les données (parsing tags)
  const processSnippets = (rawSnippets) => {
    return rawSnippets.map(s => {
      let tags = [];
      try {
        tags = s.tags ? (typeof s.tags === 'string' ? JSON.parse(s.tags) : s.tags) : [];
      } catch (e) { tags = []; }

      // Fallback legacy theme s'il existe et pas de tags
      if ((!tags || tags.length === 0) && s.theme) {
        tags = [String(s.theme)];
      }

      // Ensure tags is array of strings
      if (!Array.isArray(tags)) tags = [];
      tags = tags.map(String); // Force conversion to string

      return { ...s, tags };
    });
  };

  const loadData = async () => {
    try {
      const dbSnippets = await window.electronAPI.getSnippets();
      const processed = processSnippets(dbSnippets);

      setSnippets(processed);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (query) => {
    if (!query.trim()) {
      const all = await window.electronAPI.getSnippets();
      setSnippets(processSnippets(all));
      return;
    }

    try {
      const results = await window.electronAPI.searchSnippets(query);
      setSnippets(processSnippets(results));
    } catch (err) {
      console.error(err);
    }
  };

  // Drag & Drop Handlers
  const handleDragStart = (e, index) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = "move";
    // Petite astuce pour cacher l'image fantôme par défaut si voulu, mais pas obligatoire
  };

  const handleDragOver = (e, index) => {
    e.preventDefault(); // Nécessaire pour permettre le drop
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, index) => {
    e.preventDefault();
    if (draggedItem === null || draggedItem === index) return;

    const newSnippets = [...snippets];
    // Retirer l'élément dragué
    const [movedItem] = newSnippets.splice(draggedItem, 1);
    // Insérer à la nouvelle position
    newSnippets.splice(index, 0, movedItem);

    setSnippets(newSnippets);
    setDraggedItem(null);

    // Sauvegarder l'ordre en base
    try {
      await window.electronAPI.updatePositions(newSnippets);
    } catch (err) {
      console.error("Erreur sauvegarde ordre", err);
    }
  };

  // Langages supportés (Liste étendue)
  const languages = [
    'JS', 'TypeScript', 'Python', 'Java', 'C', 'C++', 'C#', 'Go', 'Rust', 'PHP',
    'Ruby', 'Swift', 'Kotlin', 'Dart', 'Lua', 'R', 'Perl', 'SQL', 'Bash', 'Powershell',
    'HTML', 'CSS', 'SCSS', 'JSON', 'XML', 'YAML', 'Markdown', 'Docker',
    'React', 'Vue', 'Angular', 'Svelte',
    'Objective-C', 'F#', 'Haskell', 'Elixir', 'Clojure', 'Groovy', 'Scala'
  ].sort();
  const themes = ['Général', 'Sécurité', 'Backend', 'Algo', 'Frontend', 'DevOps'];

  if (!userRole) {
    return React.createElement(LandingPage, { key: 'landing' });
  }

  async function handleLogin(tokenToUse = null, isAuto = false) {
    const token = tokenToUse || password;
    if (!token) return;

    try {
      const result = await window.electronAPI.login(token);
      if (result.success) {
        setUserRole(result.role);
        localStorage.setItem('cvai-token', token); // Sauvegarde persistance
        if (!isAuto) setPassword(''); // Clean input si manuel
      } else {
        if (isAuto) {
          localStorage.removeItem('cvai-token'); // Clean si invalide (révoqué entre temps)
        } else {
          setLoginError('❌ Token Invalide ou Révoqué');
        }
      }
    } catch (e) {
      console.error(e);
      setLoginError('❌ Erreur système');
    }
  }

  const handleLogout = async () => {
    localStorage.removeItem('cvai-token');
    // Destroy the server-side session too — without this, the still-valid
    // session cookie would silently let the visitor straight back into /app
    // (window.CODEVAULT_ROLE would just get re-injected) without ever going
    // back through the email access gate.
    try {
      await fetch('/logout', { method: 'POST' });
    } catch (e) {
      // Best-effort: if this fails, the hard navigation below still gets them
      // off the app screen even though their session survives server-side.
    }
    window.location.href = '/';
  };

  const addSnippet = async () => {
    if (!newTitle.trim()) return;
    try {
      const snippet = {
        title: newTitle,
        lang: newLang,
        tags: newTags,
        code: "// Nouveau code"
      };
      await window.electronAPI.addSnippet(snippet);
      loadData();
      setNewTitle('');
      setNewTags([]);
    } catch (err) {
      console.error(err);
      alert("Erreur d'ajout");
    }
  };

  const deleteSnippet = async (id) => {
    if (!confirm('🗑️ Supprimer ce snippet ?')) return;
    try {
      await window.electronAPI.deleteSnippet(id);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erreur de suppression");
    }
  };

  const editSnippet = (snippet) => {
    setEditingSnippet({ ...snippet });
  };

  const updateSnippet = async (updatedSnippet) => {
    if (!updatedSnippet.title || !updatedSnippet.code) return;
    try {
      await window.electronAPI.updateSnippet(updatedSnippet);
      loadData();
      setEditingSnippet(null); // Close modal
    } catch (err) {
      console.error(err);
      alert("Erreur de mise à jour");
    }
  };

  const cancelEdit = () => {
    setEditingSnippet(null);
  };

  const openDetached = async (snippet) => {
    try {
      await window.electronAPI.openSnippetWindow(snippet.id);
    } catch (err) {
      console.error("Erreur ouverture fenêtre :", err);
    }
  };

  // === CHAT IA ===
  const handleChat = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { type: 'user', text: userMsg }]);
    try {
      const reply = await window.CodeVaultAI.reply(userMsg);
      setChatMessages(prev => [...prev, { type: 'ai', text: reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { type: 'ai', text: 'Désolée, une erreur...' }]);
    }
  };

  // === IMPORT/EXPORT (Keep existing logic) ===
  // === IMPORT/EXPORT (Updated for robust file handling) ===
  const handleImportFiles = (e) => {
    // Gestionnaire pour input[type=file] et potentiellement DnD manuel si implémenté
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Utilisation de Promise.all pour plus de robustesse
    const fileReaders = Array.from(files).map(file => {
      return new Promise((resolve) => {
        // Validation basique
        if (!file) { resolve(null); return; }

        const reader = new FileReader();

        reader.onload = async () => {
          let code = reader.result;
          if (!code) { resolve(null); return; }

          let lang = 'Plain Text';
          let theme = 'Général';
          let title = file.name;
          let tags = [];

          if (autonomousMode) {
            // 1. Détection Langage (Extension + Contenu)
            const ext = file.name.split('.').pop();
            lang = window.CodeBeautifier.detectLanguage(file.name);

            if (!lang || lang === 'Plain Text') {
              lang = window.CodeBeautifier.detectLanguageFromContent(code);
            }

            // 2. IA Metadata (Titre + Tags)
            if (window.CodeVaultAI) {
              const metadata = await window.CodeVaultAI.generateMetadata(code, ext);
              if (metadata.title && metadata.title !== 'Untitled Snippet') title = metadata.title;
              if (metadata.tags.length > 0) tags = metadata.tags;
              if (metadata.lang && metadata.lang !== 'Plain Text') lang = metadata.lang;
            }

            // 3. Auto-Beautify
            if (window.CodeBeautifier && lang !== 'Plain Text') {
              code = window.CodeBeautifier.beautify(code, lang);
            }

            // 4. Thème (Backup)
            theme = window.CodeBeautifier.detectTheme(code, lang);

          } else {
            // Mode Classique
            lang = window.CodeBeautifier ? window.CodeBeautifier.detectLanguage(file.name) : 'Plain Text';
            theme = window.CodeBeautifier ? window.CodeBeautifier.detectTheme(code, lang) : 'vs-dark';
            if (window.CodeBeautifier && lang !== 'Plain Text') {
              try { code = window.CodeBeautifier.beautify(code, lang); } catch (e) { }
            }
          }

          resolve({ title, lang, theme, code, tags });
        };

        reader.onerror = () => {
          console.error(`Erreur lecture: ${file.name}`);
          resolve(null); // On résout quand même pour ne pas bloquer Promise.all
        };

        try {
          reader.readAsText(file);
        } catch (err) {
          console.error(err);
          resolve(null);
        }
      });
    });

    try {
      Promise.all(fileReaders).then(results => {
        const validSnippets = results.filter(s => s !== null);
        if (validSnippets.length > 0) {
          saveImported(validSnippets);
        } else {
          console.warn("Aucun fichier n'a pu être importé.");
        }
      });
    } catch (err) {
      console.error("Erreur globale import", err);
    }

    e.target.value = '';
  };

  const saveImported = async (list) => {
    if (list.length === 0) return;
    try {
      await window.electronAPI.importSnippetsToDb(list);
      loadData();
      // alert(`📥 ${list.length} fichier(s) importé(s) !`); // Removed blocking alert
    } catch (err) { console.error("Erreur import", err); }
  };

  const handleExportAll = async () => {
    try {
      const saved = await window.electronAPI.saveSnippets(snippets);
      if (saved) console.log(`✅ Sauvegardé :\n${saved}`);
    } catch (err) { console.error("Erreur d'export", err); }
  };

  const handleExportSnippet = async (snippet) => {
    const ext = { 'JS': 'js', 'TypeScript': 'ts', 'JSON': 'json', 'CSS': 'css', 'Python': 'py', 'HTML': 'html' }[snippet.lang] || 'txt';
    const filename = `${snippet.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
    await window.electronAPI.exportSnippet(filename, snippet.code);
  };

  const handleImportBackup = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const loaded = JSON.parse(reader.result);
        if (Array.isArray(loaded)) {
          await window.electronAPI.importSnippetsToDb(loaded);
          loadData();
          alert(`📥 ${loaded.length} restaurés !`);
        }
      } catch (err) { alert("Fichier invalide"); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };



  // Toggle Autonomous Mode
  const toggleAutonomous = () => {
    const newVal = !autonomousMode;
    setAutonomousMode(newVal);
    localStorage.setItem('cvai-autonomous', newVal);
  };

  const renderChatPanel = () => {
    if (!showChat) return null;
    return React.createElement('div', { className: 'fixed bottom-4 right-4 w-80 bg-slate-900/90 backdrop-blur-xl rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.3)] border border-cyan-500/30 z-50 flex flex-col' }, [
      React.createElement('div', { className: 'flex justify-between items-center p-3 border-b border-cyan-500/30' }, [
        React.createElement('span', { className: 'font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' }, '🤖 Laetitia'),
        React.createElement('button', { onClick: () => setShowChat(false), className: 'text-slate-400 hover:text-white transition', 'aria-label': 'Fermer le chat' }, '✕')
      ]),
      React.createElement('div', { className: 'p-3 h-64 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent' }, [
        chatMessages.map((msg, i) => React.createElement('div', { key: i, className: `mb-2 p-2 rounded text-sm ${msg.type === 'user' ? 'bg-cyan-900/40 text-cyan-100 ml-8 border border-cyan-500/20' : 'bg-slate-800/80 text-green-300 mr-8 border border-green-500/20'}` }, msg.text)),
        React.createElement('div', { ref: chatEndRef })
      ]),
      React.createElement('div', { className: 'p-3 border-t border-cyan-500/30 flex gap-2' }, [
        React.createElement('input', { type: 'text', value: chatInput, onChange: (e) => setChatInput(e.target.value), onKeyDown: (e) => e.key === 'Enter' && handleChat(), className: 'flex-1 p-2 bg-black/50 text-white rounded text-sm border border-cyan-900 focus:border-cyan-500 outline-none transition' }),
        React.createElement('button', { onClick: handleChat, className: 'px-3 bg-cyan-600/80 hover:bg-cyan-500 rounded text-white font-bold shadow-[0_0_10px_rgba(8,145,178,0.5)] transition', 'aria-label': 'Envoyer le message' }, '➤')
      ])
    ]);
  };

  // RENDER DETACHED MODE
  const params = new URLSearchParams(window.location.search);
  const isDetached = params.get('mode') === 'detached';

  if (isDetached && maximizedSnippet) {
    return React.createElement('div', { className: 'h-screen w-screen bg-[#050510] flex flex-col overflow-hidden font-[Onest,sans-serif]' }, [
      React.createElement('div', { className: 'flex justify-between items-center p-4 bg-black/40 border-b border-cyan-500/30' }, [
        React.createElement('div', { className: 'flex items-center gap-4' }, [
          React.createElement('h1', { className: 'text-2xl font-black text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' }, maximizedSnippet.title),
          React.createElement('span', { className: 'text-xs uppercase px-2 py-1 rounded bg-purple-900/30 text-purple-300 border border-purple-500/30 tracking-widest' }, 'DETACHED STUDIO')
        ]),
        userRole === 'admin' && React.createElement('button', {
          onClick: async () => {
            await window.electronAPI.updateSnippet(maximizedSnippet); // Save to DB
            alert('✅ Saved!');
          },
          className: 'px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] transition uppercase tracking-widest'
        }, '💾 SAVE')
      ]),
      React.createElement('div', { className: 'flex-1 relative bg-black/20' },
        React.createElement(MonacoEditorWrapper, {
          value: maximizedSnippet.code,
          language: maximizedSnippet.lang,
          readOnly: userRole !== 'admin',
          fontSize: 16,
          onChange: (val) => setMaximizedSnippet({ ...maximizedSnippet, code: val })
        })
      )
    ]);
  } else if (isDetached && !maximizedSnippet) {
    return React.createElement('div', { className: 'h-screen flex items-center justify-center text-cyan-500 animate-pulse' }, 'Loading Node...');
  }

  return React.createElement('div', { className: 'p-6 max-w-7xl mx-auto font-[Onest,sans-serif]' }, [
    // Header
    React.createElement('div', { className: 'flex flex-wrap items-center justify-between mb-8 gap-6 relative z-10' }, [
      React.createElement('div', {}, [
        React.createElement('h1', { className: 'text-5xl font-black flex items-center gap-3' }, [
          React.createElement('span', { key: 'emoji', 'aria-hidden': 'true' }, '🔐'),
          React.createElement(HologramLogo, { key: 'logo', text: 'CodeVaultAI' })
        ]),
        React.createElement('p', { className: 'text-cyan-200/70 mt-1 font-mono text-sm tracking-widest uppercase' }, 'Secure Neural Coding Environment 2027')
      ]),

      // SEARCH BAR avec SUGGESTIONS
      React.createElement('div', { className: 'flex-1 max-w-lg mx-4 relative group' }, [
        React.createElement('div', { className: 'relative' }, [
          React.createElement('span', { className: 'absolute left-3 top-3 text-cyan-500 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]' }, '🔍'),
          React.createElement('input', {
            type: 'text',
            value: searchQuery,
            onChange: (e) => setSearchQuery(e.target.value),
            placeholder: 'Search Snippet / Command...',
            style: { WebkitAppRegion: 'no-drag' },
            className: 'w-full pl-10 pr-4 py-3 bg-black/30 text-white rounded-xl border border-cyan-900/50 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.3)] outline-none transition-all backdrop-blur-sm relative z-50'
          })
        ]),
        // Suggestions Dropdown
        React.createElement(SearchSuggestions, {
          query: searchQuery,
          snippets: snippets.length < 100 ? snippets : [],
          onSelect: (val) => setSearchQuery(val)
        })
      ]),

      // Boutons Header
      React.createElement('div', { className: 'flex gap-3 flex-wrap items-center' }, [
        // LOGOUT BUTTON
        React.createElement('button', { onClick: handleLogout, className: 'tap-target border border-red-500/30 bg-red-900/10 text-red-400 hover:bg-red-500/20 px-3 py-2 rounded-lg font-bold text-xs transition-all backdrop-blur-sm', title: 'Déconnexion' }, '🔓 LOGOUT'),

        // PROJETS LINKS
        React.createElement('a', { href: 'https://portfolio.riad-design.cloud/', target: '_blank', rel: 'noopener', className: 'border border-cyan-500/50 bg-cyan-900/10 text-cyan-300 hover:bg-cyan-500/20 px-4 py-2 rounded-lg font-bold text-sm transition-all backdrop-blur-sm inline-flex items-center' }, '👤 PORTFOLIO'),
        React.createElement('a', { href: 'https://devops.riad-design.cloud/', target: '_blank', rel: 'noopener', className: 'border border-cyan-500/50 bg-cyan-900/10 text-cyan-300 hover:bg-cyan-500/20 px-4 py-2 rounded-lg font-bold text-sm transition-all backdrop-blur-sm inline-flex items-center' }, '🛠️ DEVOPS'),

        React.createElement('button', { onClick: () => setShowChat(!showChat), className: 'tap-target border border-fuchsia-500/50 bg-fuchsia-900/20 text-fuchsia-300 hover:bg-fuchsia-500/20 hover:shadow-[0_0_15px_rgba(217,70,239,0.4)] px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 backdrop-blur-sm' }, '🤖 LAETITIA'),
        (userRole === 'admin' || userRole === 'user') && React.createElement('label', { className: 'tap-target border border-blue-500/50 bg-blue-900/20 text-blue-300 hover:bg-blue-500/20 hover:shadow-[0_0_15px_rgba(59,130,246,0.4)] px-4 py-2 rounded-lg font-bold cursor-pointer text-sm flex items-center gap-2 transition-all duration-300 backdrop-blur-sm' }, [
          '📥 IMPORT',
          React.createElement('input', { type: 'file', multiple: true, style: { display: 'none' }, onChange: handleImportFiles })
        ]),
        (userRole === 'admin' || userRole === 'user') && React.createElement('label', { className: 'tap-target border border-amber-500/50 bg-amber-900/20 text-amber-300 hover:bg-amber-500/20 hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] px-4 py-2 rounded-lg font-bold cursor-pointer text-sm flex items-center gap-2 transition-all duration-300 backdrop-blur-sm' }, [
          '📦 RESTORE',
          React.createElement('input', { type: 'file', accept: '.json', style: { display: 'none' }, onChange: handleImportBackup })
        ]),
        React.createElement('button', { onClick: handleExportAll, className: 'tap-target border border-green-500/50 bg-green-900/20 text-green-300 hover:bg-green-500/20 hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 backdrop-blur-sm' }, '💾 EXPORT'),
        React.createElement('button', {
          onClick: toggleAutonomous,
          className: `tap-target border ${autonomousMode ? 'border-purple-500 bg-purple-900/40 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'border-slate-600 bg-slate-900/40 text-slate-500'} px-4 py-2 rounded-lg font-bold text-sm transition-all duration-300 backdrop-blur-sm flex items-center gap-2`,
          title: 'Mode Autonome : Détection automatique langage + IA',
          'aria-pressed': autonomousMode,
          'aria-label': `Mode autonome ${autonomousMode ? 'activé' : 'désactivé'}`
        }, [
          React.createElement('span', { className: autonomousMode ? 'animate-pulse' : '' }, '🧠'),
          'AUTO'
        ]),
        React.createElement('button', { onClick: () => window.location.reload(), className: 'tap-target border border-cyan-500/50 text-cyan-500 hover:bg-cyan-500/10 px-3 py-2 rounded-lg font-bold transition', title: 'Rafraîchir', 'aria-label': 'Rafraîchir la page' }, '↻')
      ])
    ]),

    // Formulaire d'ajout (admin et user peuvent créer ; seul l'admin peut ensuite modifier/supprimer)
    (userRole === 'admin' || userRole === 'user') && React.createElement('div', { className: 'bg-black/30 backdrop-blur-md p-5 rounded-2xl mb-8 grid grid-cols-1 md:grid-cols-6 gap-4 items-end border border-cyan-500/20 shadow-[0_0_40px_rgba(8,145,178,0.1)] relative z-10' }, [
      React.createElement('input', { type: 'text', placeholder: 'Snippet Title...', value: newTitle, onChange: (e) => setNewTitle(e.target.value), onKeyDown: (e) => e.key === 'Enter' && addSnippet(), style: { WebkitAppRegion: 'no-drag' }, className: 'md:col-span-2 p-3 bg-black/50 text-white rounded-lg text-sm border border-cyan-900/50 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] outline-none transition relative z-50' }),
      React.createElement('select', { value: newLang, onChange: (e) => setNewLang(e.target.value), style: { WebkitAppRegion: 'no-drag' }, className: 'p-3 bg-black/50 text-cyan-100 rounded-lg text-sm border border-cyan-900/50 focus:border-cyan-400 outline-none transition relative z-50' }, languages.map(l => React.createElement('option', { key: l, value: l }, l))),
      React.createElement('div', { style: { WebkitAppRegion: 'no-drag' }, className: 'relative z-50' }, React.createElement(TagInput, { tags: newTags, onChange: setNewTags, suggestions: themes })),
      React.createElement('button', { onClick: addSnippet, className: 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-3 rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all' }, '➕ ADD'),
      React.createElement('span', { className: 'text-cyan-500/50 text-xs font-mono text-center uppercase tracking-widest' }, `${snippets.length} ACTIVE NODES`)
    ]),

    // Modal Edit (Render Standalone Component)
    editingSnippet && React.createElement(EditModal, {
      snippet: editingSnippet,
      themes: themes,
      onSave: updateSnippet,
      onCancel: () => setEditingSnippet(null)
    }),

    // Modal Maximize
    maximizedSnippet && React.createElement('div', { className: 'fixed inset-0 bg-black/95 bg-opacity-95 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-fade-in' },
      React.createElement('div', { className: 'w-full h-full max-w-7xl flex flex-col bg-[#050510] border border-cyan-500/30 rounded-2xl shadow-[0_0_100px_rgba(6,182,212,0.2)] overflow-hidden' }, [
        React.createElement('div', { className: 'flex justify-between items-center p-4 border-b border-cyan-500/30 bg-black/40' }, [
          React.createElement('div', { className: 'flex items-center gap-4' }, [
            React.createElement('h2', { className: 'text-3xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]' }, maximizedSnippet.title),
            React.createElement('span', { className: 'text-xs uppercase tracking-widest text-cyan-500/50 border border-cyan-500/20 px-2 py-1 rounded' }, 'FULL SCREEN STUDIO')
          ]),
          React.createElement('div', { className: 'flex gap-3' }, [
            userRole === 'admin' && React.createElement('button', {
              onClick: async () => {
                await window.electronAPI.updateSnippet(maximizedSnippet); // Save to DB
                loadData(); // Refresh list
                alert('✅ Saved!');
              },
              className: 'px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold rounded-lg shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all uppercase tracking-widest'
            }, '💾 SAVE'),
            React.createElement('button', { onClick: () => setMaximizedSnippet(null), className: 'text-cyan-500/50 hover:text-cyan-400 text-3xl transition ml-4', 'aria-label': 'Fermer' }, '✕')
          ])
        ]),
        React.createElement('div', { className: 'flex-1 overflow-hidden relative p-4 bg-black/20 backdrop-blur-sm' },
          React.createElement(MonacoEditorWrapper, {
            value: maximizedSnippet.code,
            language: maximizedSnippet.lang,
            readOnly: userRole !== 'admin',
            fontSize: 18,
            onChange: (val) => setMaximizedSnippet({ ...maximizedSnippet, code: val })
          })
        )
      ])
    ),

    // DRAG OVERLAY
    isDraggingFile && React.createElement('div', {
      className: 'fixed inset-0 bg-cyan-500/20 backdrop-blur-sm z-[100] flex items-center justify-center border-4 border-dashed border-cyan-400 m-4 rounded-xl animate-pulse cursor-pointer',
      onClick: () => setIsDraggingFile(false), // Click to cancel
      onDragLeave: (e) => {
        // Only hide if leaving the window (not just entering child)
        if (e.clientX === 0 && e.clientY === 0) setIsDraggingFile(false);
      },
      onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; },
      onDrop: (e) => {
        e.preventDefault(); e.stopPropagation();
        setIsDraggingFile(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleImportFiles({ target: { files: e.dataTransfer.files, value: '' } });
        }
      }
    }, [
      React.createElement('div', { className: 'text-center' }, [
        React.createElement('div', { className: 'text-6xl mb-4' }, '📂'),
        React.createElement('h2', { className: 'text-4xl font-bold text-cyan-100 drop-shadow-lg' }, 'DROP TO IMPORT'),
        React.createElement('p', { className: 'text-cyan-300 mt-2' }, 'Release to add files • Click or Esc to cancel')
      ])
    ]),

    renderChatPanel(),

    // Grid (avec Drag & Drop)
    snippets.length === 0
      ? React.createElement('div', { className: 'text-center p-20' }, [
        React.createElement('div', { className: 'text-6xl mb-4 animate-pulse' }, '🌌'),
        React.createElement('p', { className: 'text-cyan-500/50 text-xl font-light tracking-widest uppercase' }, 'System Empty. Initialize new node.')
      ])
      : React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 py-4' },
        snippets.map((s, index) =>
          React.createElement('div', {
            key: s.id,
            draggable: true,
            onDragStart: (e) => handleDragStart(e, index),
            onDragOver: (e) => handleDragOver(e, index),
            onDrop: (e) => handleDrop(e, index),
            className: `bg-[#0a0a15]/80 backdrop-blur-sm p-0 rounded-xl border border-white/5 hover:border-cyan-400/50 transition-all duration-300 hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] group flex flex-col cursor-move overflow-hidden relative ${draggedItem === index ? 'opacity-30 border-dashed border-cyan-500' : ''}`
          }, [
            // Header Card
            React.createElement('div', { className: 'p-4 border-b border-white/5 bg-gradient-to-r from-transparent to-white/5 flex justify-between items-start' }, [
              React.createElement('div', { className: 'overflow-hidden' }, [
                React.createElement('h3', { className: 'font-bold text-lg truncate text-gray-200 group-hover:text-cyan-300 transition-colors' }, s.title),
                React.createElement('div', { className: 'flex gap-2 mt-1 flex-wrap' }, [
                  React.createElement('span', { className: 'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-900/30 text-cyan-400 border border-cyan-500/20' }, s.lang),
                  ...(s.tags || []).map(t => React.createElement('span', { key: t, className: 'text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-fuchsia-900/30 text-fuchsia-400 border border-fuchsia-500/20' }, t))
                ])
              ]),
              React.createElement('div', { className: 'flex gap-1.5 opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0' }, [
                // ADMIN ACTIONS ONLY
                userRole === 'admin' && React.createElement('button', { onClick: (e) => { e.stopPropagation(); editSnippet(s); }, className: 'tap-target-sm text-amber-400 p-1.5 hover:bg-amber-500/20 rounded-md transition', title: 'Edit', 'aria-label': `Modifier ${s.title}` }, '✏️'),
                userRole === 'admin' && React.createElement('button', { onClick: (e) => { e.stopPropagation(); deleteSnippet(s.id); }, className: 'tap-target-sm text-red-400 p-1.5 hover:bg-red-500/20 rounded-md transition', title: 'Delete', 'aria-label': `Supprimer ${s.title}` }, '🗑️'),
                // READ ONLY ACTION: OPEN
                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openDetached(s); }, className: 'tap-target-sm text-cyan-400 p-1.5 hover:bg-cyan-500/20 rounded-md transition', title: 'Open', 'aria-label': `Ouvrir ${s.title}` }, '↗️'),
                React.createElement('button', { onClick: (e) => { e.stopPropagation(); handleExportSnippet(s); }, className: 'tap-target-sm text-blue-400 p-1.5 hover:bg-blue-500/20 rounded-md transition', title: 'Export', 'aria-label': `Exporter ${s.title}` }, '📤'),
                React.createElement('button', { onClick: (e) => { e.stopPropagation(); openDetached(s); }, className: 'tap-target-sm text-cyan-400 p-1.5 hover:bg-cyan-500/20 rounded-md transition', title: 'Maximize', 'aria-label': `Agrandir ${s.title}` }, '⛶')
              ])
            ]),
            // Code Preview
            React.createElement('div', { className: 'p-3 flex-1 bg-black/40' },
              React.createElement(CodeBlock, { code: s.code, lang: s.lang, maxLines: true })
            ),
            // Footer Glow Line
            React.createElement('div', { className: 'h-0.5 bg-gradient-to-r from-cyan-500 via-purple-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500' })
          ])
        )
      )
  ]);
};

ReactDOM.render(React.createElement(App), document.getElementById('root'));
