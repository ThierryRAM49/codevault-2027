/**
 * CodeVaultAI - Analyseur et Correcteur de Code
 * Détecte les erreurs et propose des corrections automatiques
 */

const CodeAnalyzer = {
    /**
     * Analyse le code et retourne les erreurs trouvées
     */
    analyze(code, language) {
        const errors = [];
        const warnings = [];
        const suggestions = [];
        const lang = (language || 'JS').toUpperCase();

        if (!code || typeof code !== 'string') {
            return { errors, warnings, suggestions, correctedCode: code };
        }

        // Analyse selon le langage
        switch (lang) {
            case 'JS':
            case 'JAVASCRIPT':
            case 'JSX':
            case 'REACT':
                this.analyzeJS(code, errors, warnings, suggestions);
                break;
            case 'TYPESCRIPT':
            case 'TS':
            case 'TSX':
                this.analyzeTS(code, errors, warnings, suggestions);
                break;
            case 'JSON':
                this.analyzeJSON(code, errors, warnings, suggestions);
                break;
            case 'CSS':
            case 'SCSS':
            case 'SASS':
                this.analyzeCSS(code, errors, warnings, suggestions);
                break;
            case 'PYTHON':
            case 'PY':
                this.analyzePython(code, errors, warnings, suggestions);
                break;
            case 'HTML':
                this.analyzeHTML(code, errors, warnings, suggestions);
                break;
            case 'PHP':
                this.analyzePHP(code, errors, warnings, suggestions);
                break;
        }

        return { errors, warnings, suggestions };
    },

    /**
     * Corrige automatiquement le code
     */
    autoFix(code, language) {
        let fixed = code;
        const lang = (language || 'JS').toUpperCase();
        const fixes = [];
        let result;

        switch (lang) {
            case 'JS':
            case 'JAVASCRIPT':
            case 'JSX':
            case 'REACT':
            case 'TYPESCRIPT':
            case 'TS':
            case 'TSX':
                result = this.fixJS(code);
                break;
            case 'JSON':
                result = this.fixJSON(code);
                break;
            case 'CSS':
            case 'SCSS':
            case 'SASS':
                result = this.fixCSS(code);
                break;
            case 'HTML':
                result = this.fixHTML(code);
                break;
            case 'PHP':
                result = this.fixPHP(code);
                break;
        }

        if (result) {
            fixed = result.code;
            fixes.push(...result.fixes);
        }

        return { code: fixed, fixes };
    },

    // === ANALYSEURS ===

    analyzeJS(code, errors, warnings, suggestions) {
        const lines = code.split('\n');

        lines.forEach((line, i) => {
            const lineNum = i + 1;
            const trimmed = line.trim();

            // Erreurs de syntaxe courantes
            if (trimmed.includes('console.log') && !trimmed.includes('//')) {
                warnings.push({ line: lineNum, message: 'console.log détecté - à supprimer en production', type: 'warning' });
            }

            if (trimmed.match(/var\s+\w+/)) {
                suggestions.push({ line: lineNum, message: 'Utiliser let ou const au lieu de var', type: 'suggestion' });
            }

            if (trimmed.includes('==') && !trimmed.includes('===') && !trimmed.includes('!==')) {
                warnings.push({ line: lineNum, message: 'Utiliser === au lieu de == pour une comparaison stricte', type: 'warning' });
            }

            if (trimmed.includes('!=') && !trimmed.includes('!==')) {
                warnings.push({ line: lineNum, message: 'Utiliser !== au lieu de != pour une comparaison stricte', type: 'warning' });
            }

            // Détecter les fonctions non fermées
            const openBraces = (line.match(/\{/g) || []).length;
            const closeBraces = (line.match(/\}/g) || []).length;

            // Vérifier les parenthèses
            const openParens = (line.match(/\(/g) || []).length;
            const closeParens = (line.match(/\)/g) || []).length;

            // Détecter les erreurs de syntaxe
            if (trimmed.endsWith(',)') || trimmed.endsWith(',]') || trimmed.endsWith(',}')) {
                errors.push({ line: lineNum, message: 'Virgule en trop avant la fermeture', type: 'error' });
            }

            // Détecter les points-virgules manquants (heuristique simple)
            if (trimmed && !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
                !trimmed.endsWith(',') && !trimmed.endsWith(';') &&
                !trimmed.endsWith('(') && !trimmed.endsWith(':') &&
                !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                !trimmed.startsWith('*') && !trimmed.startsWith('if') &&
                !trimmed.startsWith('else') && !trimmed.startsWith('for') &&
                !trimmed.startsWith('while') && !trimmed.startsWith('function') &&
                !trimmed.startsWith('class') && !trimmed.startsWith('import') &&
                !trimmed.startsWith('export') && !trimmed.startsWith('return') &&
                trimmed.length > 3) {
                // Heuristique légère, ne pas marquer comme erreur
            }

            // Détecter les chaînes non fermées
            const singleQuotes = (line.match(/'/g) || []).length;
            const doubleQuotes = (line.match(/"/g) || []).length;
            const backticks = (line.match(/`/g) || []).length;

            if (singleQuotes % 2 !== 0 && !line.includes("\\'")) {
                warnings.push({ line: lineNum, message: 'Guillemet simple non fermé possible', type: 'warning' });
            }

            // Async/await sans try-catch
            if (trimmed.includes('await ') && !code.includes('try {')) {
                suggestions.push({ line: lineNum, message: 'await sans try-catch - considérer la gestion d\'erreurs', type: 'suggestion' });
            }
        });

        // Vérifier l'équilibre global des accolades
        const totalOpen = (code.match(/\{/g) || []).length;
        const totalClose = (code.match(/\}/g) || []).length;
        if (totalOpen !== totalClose) {
            errors.push({ line: 0, message: `Accolades non équilibrées: ${totalOpen} ouvertes, ${totalClose} fermées`, type: 'error' });
        }

        // Vérifier l'équilibre des parenthèses
        const totalOpenP = (code.match(/\(/g) || []).length;
        const totalCloseP = (code.match(/\)/g) || []).length;
        if (totalOpenP !== totalCloseP) {
            errors.push({ line: 0, message: `Parenthèses non équilibrées: ${totalOpenP} ouvertes, ${totalCloseP} fermées`, type: 'error' });
        }

        // Vérifier l'équilibre des crochets
        const totalOpenB = (code.match(/\[/g) || []).length;
        const totalCloseB = (code.match(/\]/g) || []).length;
        if (totalOpenB !== totalCloseB) {
            errors.push({ line: 0, message: `Crochets non équilibrés: ${totalOpenB} ouverts, ${totalCloseB} fermés`, type: 'error' });
        }
    },

    analyzeTS(code, errors, warnings, suggestions) {
        // Inclure l'analyse JS
        this.analyzeJS(code, errors, warnings, suggestions);

        const lines = code.split('\n');
        lines.forEach((line, i) => {
            const lineNum = i + 1;
            const trimmed = line.trim();

            // Vérifier les any explicites
            if (trimmed.includes(': any') || trimmed.includes(':any')) {
                warnings.push({ line: lineNum, message: 'Type "any" détecté - considérer un type plus spécifique', type: 'warning' });
            }

            // Vérifier les assertions de type dangereuses
            if (trimmed.includes(' as any') || trimmed.includes('<any>')) {
                warnings.push({ line: lineNum, message: 'Assertion "as any" dangereuse', type: 'warning' });
            }
        });
    },

    analyzeJSON(code, errors, warnings, suggestions) {
        try {
            JSON.parse(code);
        } catch (e) {
            const match = e.message.match(/position (\d+)/);
            if (match) {
                const pos = parseInt(match[1]);
                const beforeError = code.substring(0, pos);
                const lineNum = (beforeError.match(/\n/g) || []).length + 1;
                errors.push({ line: lineNum, message: `JSON invalide: ${e.message}`, type: 'error' });
            } else {
                errors.push({ line: 0, message: `JSON invalide: ${e.message}`, type: 'error' });
            }
        }

        // Vérifier les virgules en trop
        if (code.includes(',]') || code.includes(',}')) {
            errors.push({ line: 0, message: 'Virgule en trop avant ] ou }', type: 'error' });
        }
    },

    analyzeCSS(code, errors, warnings, suggestions) {
        const lines = code.split('\n');

        lines.forEach((line, i) => {
            const lineNum = i + 1;
            const trimmed = line.trim();

            // Vérifier les propriétés sans point-virgule
            if (trimmed.includes(':') && !trimmed.endsWith(';') &&
                !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
                !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                trimmed.length > 5) {
                warnings.push({ line: lineNum, message: 'Point-virgule manquant possible', type: 'warning' });
            }

            // Vérifier !important
            if (trimmed.includes('!important')) {
                suggestions.push({ line: lineNum, message: '!important détecté - à éviter si possible', type: 'suggestion' });
            }

            // Vérifier les couleurs hex invalides
            const hexMatch = trimmed.match(/#([0-9a-fA-F]+)/);
            if (hexMatch) {
                const hex = hexMatch[1];
                if (hex.length !== 3 && hex.length !== 6 && hex.length !== 8) {
                    errors.push({ line: lineNum, message: `Couleur hex invalide: #${hex}`, type: 'error' });
                }
            }
        });

        // Vérifier l'équilibre des accolades
        const totalOpen = (code.match(/\{/g) || []).length;
        const totalClose = (code.match(/\}/g) || []).length;
        if (totalOpen !== totalClose) {
            errors.push({ line: 0, message: `Accolades non équilibrées: ${totalOpen} ouvertes, ${totalClose} fermées`, type: 'error' });
        }
    },

    analyzePython(code, errors, warnings, suggestions) {
        const lines = code.split('\n');
        let indentStack = [0];

        lines.forEach((line, i) => {
            const lineNum = i + 1;
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith('#')) return;

            // Vérifier les imports
            if (trimmed.startsWith('import *')) {
                warnings.push({ line: lineNum, message: 'import * peut causer des conflits de noms', type: 'warning' });
            }

            // Vérifier les prints de debug
            if (trimmed.startsWith('print(') && trimmed.includes('debug')) {
                warnings.push({ line: lineNum, message: 'print de debug détecté', type: 'warning' });
            }

            // Vérifier l'utilisation de eval
            if (trimmed.includes('eval(')) {
                errors.push({ line: lineNum, message: 'eval() est dangereux - à éviter', type: 'error' });
            }

            // Vérifier les except génériques
            if (trimmed === 'except:' || trimmed.startsWith('except Exception:')) {
                warnings.push({ line: lineNum, message: 'except générique - spécifier le type d\'exception', type: 'warning' });
            }
        });
    },

    analyzeHTML(code, errors, warnings, suggestions) {
        // Vérifier les balises non fermées (simple)
        const openTags = code.match(/<([a-z]+)[^>]*(?<!\/)\s*>/gi) || [];
        const closeTags = code.match(/<\/([a-z]+)>/gi) || [];

        // Tags auto-fermants
        const selfClosing = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];

        // Vérifier les attributs alt manquants sur les images
        const imgTags = code.match(/<img[^>]*>/gi) || [];
        imgTags.forEach(img => {
            if (!img.includes('alt=')) {
                warnings.push({ line: 0, message: 'Image sans attribut alt', type: 'warning' });
            }
        });

        // Vérifier les scripts inline
        if (code.includes('onclick=') || code.includes('onload=') || code.includes('onerror=')) {
            suggestions.push({ line: 0, message: 'Event handlers inline détectés - préférer addEventListener', type: 'suggestion' });
        }
    },

    analyzePHP(code, errors, warnings, suggestions) {
        const lines = code.split('\n');

        lines.forEach((line, i) => {
            const lineNum = i + 1;
            const trimmed = line.trim();

            if (trimmed.includes('==') && !trimmed.includes('===') && !trimmed.includes('!==')) {
                warnings.push({ line: lineNum, message: 'Utiliser === au lieu de == pour une comparaison stricte', type: 'warning' });
            }

            if (trimmed.includes('!=') && !trimmed.includes('!==')) {
                warnings.push({ line: lineNum, message: 'Utiliser !== au lieu de != pour une comparaison stricte', type: 'warning' });
            }

            if (/\b(var_dump|print_r)\s*\(/.test(trimmed)) {
                warnings.push({ line: lineNum, message: 'var_dump/print_r détecté - à supprimer en production', type: 'warning' });
            }

            if (/\bmysql_(query|connect|select_db)\s*\(/.test(trimmed)) {
                errors.push({ line: lineNum, message: 'Fonction mysql_* supprimée depuis PHP 7 - utiliser mysqli ou PDO', type: 'error' });
            }

            if (/\beval\s*\(/.test(trimmed)) {
                errors.push({ line: lineNum, message: 'eval() est dangereux - à éviter', type: 'error' });
            }

            if (/\bextract\s*\(/.test(trimmed)) {
                warnings.push({ line: lineNum, message: 'extract() peut créer des variables inattendues - à éviter', type: 'warning' });
            }

            if (trimmed.endsWith(',)') || trimmed.endsWith(',]')) {
                errors.push({ line: lineNum, message: 'Virgule en trop avant la fermeture', type: 'error' });
            }
        });

        const totalOpen = (code.match(/\{/g) || []).length;
        const totalClose = (code.match(/\}/g) || []).length;
        if (totalOpen !== totalClose) {
            errors.push({ line: 0, message: `Accolades non équilibrées: ${totalOpen} ouvertes, ${totalClose} fermées`, type: 'error' });
        }

        const totalOpenP = (code.match(/\(/g) || []).length;
        const totalCloseP = (code.match(/\)/g) || []).length;
        if (totalOpenP !== totalCloseP) {
            errors.push({ line: 0, message: `Parenthèses non équilibrées: ${totalOpenP} ouvertes, ${totalCloseP} fermées`, type: 'error' });
        }
    },

    // === CORRECTEURS ===

    fixJS(code) {
        let fixed = code;
        const fixes = [];

        // Corriger var -> let (conservateur)
        if (fixed.includes('var ')) {
            fixed = fixed.replace(/\bvar\s+(\w+)\s*=/g, 'let $1 =');
            fixes.push('var remplacé par let');
        }

        // Corriger == -> === (seulement les cas simples)
        const eqPattern = /([^=!<>])={2}(?!=)/g;
        if (eqPattern.test(fixed)) {
            fixed = fixed.replace(eqPattern, '$1===');
            fixes.push('== remplacé par ===');
        }

        // Corriger != -> !==
        if (fixed.includes('!=') && !fixed.includes('!==')) {
            fixed = fixed.replace(/!=(?!=)/g, '!==');
            fixes.push('!= remplacé par !==');
        }

        // Supprimer les virgules trailing
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        if (code !== fixed && fixed.includes('}')) {
            fixes.push('Virgules trailing supprimées');
        }

        // Ajouter des points-virgules manquants (très conservateur)
        // Ne pas faire ça automatiquement car c'est risqué

        return { code: fixed, fixes };
    },

    fixJSON(code) {
        let fixed = code;
        const fixes = [];

        // Supprimer les virgules trailing
        fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        if (code !== fixed) {
            fixes.push('Virgules trailing supprimées');
        }

        // Essayer de réparer les guillemets
        try {
            JSON.parse(fixed);
        } catch (e) {
            // Essayer de remplacer les guillemets simples par doubles
            const withDoubleQuotes = fixed.replace(/'/g, '"');
            try {
                JSON.parse(withDoubleQuotes);
                fixed = withDoubleQuotes;
                fixes.push('Guillemets simples remplacés par doubles');
            } catch (e2) {
                // Impossible de réparer
            }
        }

        return { code: fixed, fixes };
    },

    fixCSS(code) {
        let fixed = code;
        const fixes = [];

        // Ajouter des points-virgules manquants
        const lines = fixed.split('\n');
        const fixedLines = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed.includes(':') && !trimmed.endsWith(';') &&
                !trimmed.endsWith('{') && !trimmed.endsWith('}') &&
                !trimmed.startsWith('//') && !trimmed.startsWith('/*') &&
                !trimmed.startsWith('@') && trimmed.length > 5) {
                return line.replace(/(\S)\s*$/, '$1;');
            }
            return line;
        });

        const newFixed = fixedLines.join('\n');
        if (newFixed !== fixed) {
            fixed = newFixed;
            fixes.push('Points-virgules ajoutés');
        }

        return { code: fixed, fixes };
    },

    fixHTML(code) {
        let fixed = code;
        const fixes = [];

        // Pas de corrections automatiques risquées pour HTML
        // Car cela pourrait casser la structure

        return { code: fixed, fixes };
    },

    fixPHP(code) {
        let fixed = code;
        const fixes = [];

        const eqPattern = /([^=!<>])={2}(?!=)/g;
        if (eqPattern.test(fixed)) {
            fixed = fixed.replace(eqPattern, '$1===');
            fixes.push('== remplacé par ===');
        }

        if (fixed.includes('!=') && !fixed.includes('!==')) {
            fixed = fixed.replace(/!=(?!=)/g, '!==');
            fixes.push('!= remplacé par !==');
        }

        const newFixed = fixed.replace(/,(\s*[}\]])/g, '$1');
        if (newFixed !== fixed) {
            fixed = newFixed;
            fixes.push('Virgules trailing supprimées');
        }

        return { code: fixed, fixes };
    },

    /**
     * Générer un rapport d'analyse formaté
     */
    generateReport(analysis) {
        const { errors, warnings, suggestions } = analysis;
        let report = '';

        if (errors.length === 0 && warnings.length === 0 && suggestions.length === 0) {
            return '✅ Aucun problème détecté !';
        }

        if (errors.length > 0) {
            report += `🔴 **${errors.length} Erreur(s)**\n`;
            errors.forEach(e => {
                report += `  • Ligne ${e.line}: ${e.message}\n`;
            });
        }

        if (warnings.length > 0) {
            report += `🟡 **${warnings.length} Avertissement(s)**\n`;
            warnings.forEach(w => {
                report += `  • Ligne ${w.line}: ${w.message}\n`;
            });
        }

        if (suggestions.length > 0) {
            report += `💡 **${suggestions.length} Suggestion(s)**\n`;
            suggestions.forEach(s => {
                report += `  • Ligne ${s.line}: ${s.message}\n`;
            });
        }

        return report;
    }
};

// Export global
window.CodeAnalyzer = CodeAnalyzer;
