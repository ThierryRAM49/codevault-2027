const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');

const app = express();
const port = 3000;

// --- Middlewares ---
// Autorise les requêtes depuis votre page web vers le serveur
app.use(cors()); 
// Permet au serveur de comprendre le JSON envoyé par le formulaire
app.use(express.json({ limit: '10mb' })); 
// Sert tous les fichiers (HTML, CSS, JS, images...) de votre projet
app.use(express.static(path.join(__dirname, ''))); 

// --- Routes ---

// Route principale qui sert votre index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'src', 'html', 'index.html'));
});

// Route API pour créer un nouveau projet
app.post('/api/create-project', async (req, res) => {
    const { projectName, htmlCode, cssCode, jsCode } = req.body;

    if (!projectName) {
        return res.status(400).json({ success: false, message: "Le nom du projet est requis." });
    }

    const projectPath = path.join(__dirname, 'projets', projectName);

    try {
        // Crée le dossier du projet (ne fait rien s'il existe déjà)
        await fs.ensureDir(projectPath);

        // Crée les fichiers
        if (htmlCode) await fs.writeFile(path.join(projectPath, 'index.html'), htmlCode);
        if (cssCode) await fs.writeFile(path.join(projectPath, 'style.css'), cssCode);
        if (jsCode) await fs.writeFile(path.join(projectPath, 'script.js'), jsCode);

        console.log(`Projet "${projectName}" créé avec succès dans "${projectPath}"`);
        res.json({ success: true, message: `Projet "${projectName}" créé avec succès !` });

    } catch (error) {
        console.error("Erreur lors de la création du projet :", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la création du projet." });
    }
});

// Route API pour mettre à jour un projet existant
app.post('/api/update-project', async (req, res) => {
    const { projectName, htmlCode, cssCode, jsCode } = req.body;

    if (!projectName) {
        return res.status(400).json({ success: false, message: "Le nom du projet est requis." });
    }

    const projectPath = path.join(__dirname, 'projets', projectName);

    try {
        // Écrase les fichiers avec le nouveau contenu.
        // fs.writeFile crée le fichier s'il n'existe pas, ou l'écrase s'il existe.
        // On utilise Promise.all pour exécuter les écritures en parallèle.
        await Promise.all([
            fs.writeFile(path.join(projectPath, 'index.html'), htmlCode || ''),
            fs.writeFile(path.join(projectPath, 'style.css'), cssCode || ''),
            fs.writeFile(path.join(projectPath, 'script.js'), jsCode || '')
        ]);

        res.json({ success: true, message: `Projet "${projectName}" mis à jour avec succès !` });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du projet :", error);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la mise à jour du projet." });
    }
});

app.listen(port, () => {
    console.log(`\nServeur démarré !`);
    console.log(`Votre portfolio est maintenant accessible à l'adresse : http://localhost:${port}`);
});