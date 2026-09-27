/**
 * CodeVaultAI - Code Beautifier/Formatter
 * Auto-formats minified code for: JSON, JS, TS, CSS, SCSS
 */

const CodeBeautifier = {
    /**
     * Détecte le type de fichier à partir de l'extension
     */
    detectLanguage(filename) {
        if (!filename) return 'Plain Text';
        const ext = filename.split('.').pop().toLowerCase();
        const langMap = {
            'js': 'JS', 'jsx': 'React', 'ts': 'TypeScript', 'tsx': 'TypeScript',
            'json': 'JSON', 'css': 'CSS', 'scss': 'SCSS', 'sass': 'SCSS',
            'py': 'Python', 'html': 'HTML', 'htm': 'HTML', 'sh': 'Bash', 'bash': 'Bash',
            'c': 'C', 'h': 'C', 'cpp': 'C++', 'hpp': 'C++', 'cc': 'C++',
            'cs': 'C#', 'java': 'Java', 'go': 'Go', 'rs': 'Rust',
            'php': 'PHP', 'rb': 'Ruby', 'swift': 'Swift', 'kt': 'Kotlin',
            'sql': 'SQL', 'xml': 'XML', 'yaml': 'YAML', 'yml': 'YAML', 'md': 'Markdown',
            'lua': 'Lua', 'r': 'R', 'pl': 'Perl', 'pm': 'Perl',
            'dockerfile': 'Docker', 'ps1': 'Powershell'
        };
        return langMap[ext] || null; // Retourne null si inconnu pour permettre le fallback
    },

    /**
     * Détecte le langage basé sur le contenu (Heuristiques) 
     */
    detectLanguageFromContent(code) {
        if (!code) return 'Plain Text';

        // C/C++
        if (code.match(/#include\s+<.*>/) || code.match(/int\s+main\s*\(/)) return 'C++';
        // Python
        if (code.match(/def\s+.*:\s*$/m) || code.match(/import\s+.*from.*/)) return 'Python';
        // React/JSX
        if (code.match(/import\s+React/) || code.match(/<\w+.*>.*<\/\w+>/)) return 'React';
        // Java
        if (code.match(/public\s+class\s+\w+/) || code.match(/System\.out\.println/)) return 'Java';
        // Go
        if (code.match(/package\s+main/) || code.match(/func\s+main\(/)) return 'Go';
        // Rust
        if (code.match(/fn\s+main\(/) || code.match(/let\s+mut\s+/)) return 'Rust';
        // PHP
        if (code.match(/<\?php/) || code.match(/\$\w+\s*=/)) return 'PHP';
        // Bash
        if (code.startsWith('#!/bin/bash') || code.startsWith('#!/bin/sh')) return 'Bash';
        // HTML
        if (code.match(/<!DOCTYPE\s+html>/i) || code.match(/<html.*>/i)) return 'HTML';
        // JSON
        if (code.trim().startsWith('{') && code.trim().endsWith('}')) return 'JSON';

        return 'Plain Text'; // Fallback
    },

    /**
     * Beautify JSON
     */
    beautifyJSON(code) {
        try {
            const parsed = JSON.parse(code);
            return JSON.stringify(parsed, null, 2);
        } catch (e) {
            console.warn('JSON parse failed, returning original');
            return code;
        }
    },

    /**
     * Beautify JavaScript/TypeScript
     */
    beautifyJS(code) {
        let result = code;

        // Ajouter des retours à la ligne après les accolades et points-virgules
        result = result.replace(/;(?!\s*[\n\r])/g, ';\n');
        result = result.replace(/\{(?!\s*[\n\r])/g, '{\n');
        result = result.replace(/\}(?!\s*[\n\r])/g, '}\n');

        // Nettoyer les espaces multiples
        result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

        // Indentation basique
        let indentLevel = 0;
        const lines = result.split('\n');
        const indentedLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';

            // Réduire l'indentation avant les accolades fermantes
            if (trimmed.startsWith('}') || trimmed.startsWith(']') || trimmed.startsWith(')')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            const indented = '  '.repeat(indentLevel) + trimmed;

            // Augmenter l'indentation après les accolades ouvrantes
            if (trimmed.endsWith('{') || trimmed.endsWith('[') || trimmed.endsWith('(')) {
                indentLevel++;
            }

            return indented;
        });

        return indentedLines.join('\n');
    },

    /**
     * Beautify CSS/SCSS
     */
    beautifyCSS(code) {
        let result = code;

        // Ajouter des retours à la ligne
        result = result.replace(/\{/g, ' {\n');
        result = result.replace(/\}/g, '\n}\n\n');
        result = result.replace(/;/g, ';\n');

        // Nettoyer les espaces multiples
        result = result.replace(/\n\s*\n\s*\n/g, '\n\n');

        // Indentation basique
        let indentLevel = 0;
        const lines = result.split('\n');
        const indentedLines = lines.map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';

            if (trimmed.startsWith('}')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            const indented = '  '.repeat(indentLevel) + trimmed;

            if (trimmed.endsWith('{')) {
                indentLevel++;
            }

            return indented;
        });

        return indentedLines.join('\n');
    },

    /**
     * Fonction principale de beautification
     */
    beautify(code, language) {
        if (!code || typeof code !== 'string') return code;

        const lang = language.toUpperCase();

        switch (lang) {
            case 'JSON':
                return this.beautifyJSON(code);
            case 'JS':
            case 'JAVASCRIPT':
            case 'TYPESCRIPT':
            case 'TS':
            case 'JSX':
            case 'TSX':
                return this.beautifyJS(code);
            case 'CSS':
            case 'SCSS':
            case 'SASS':
                return this.beautifyCSS(code);
            default:
                return code;
        }
    },

    /**
     * Détecte le thème basé sur le contenu du code
     */
    detectTheme(code, lang) {
        const lowerCode = code.toLowerCase();

        if (lowerCode.includes('jwt') || lowerCode.includes('auth') ||
            lowerCode.includes('password') || lowerCode.includes('encrypt') ||
            lowerCode.includes('hash') || lowerCode.includes('token')) {
            return 'Sécurité';
        }

        if (lowerCode.includes('express') || lowerCode.includes('flask') ||
            lowerCode.includes('django') || lowerCode.includes('fastapi') ||
            lowerCode.includes('router') || lowerCode.includes('api')) {
            return 'Backend';
        }

        if (lowerCode.includes('sort') || lowerCode.includes('search') ||
            lowerCode.includes('recursive') || lowerCode.includes('algorithm')) {
            return 'Algo';
        }

        return 'Général';
    }
};

// Export pour utilisation globale
window.CodeBeautifier = CodeBeautifier;
