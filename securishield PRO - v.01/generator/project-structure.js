const fs = require('fs');
const path = require('path');

const STRUCTURES = {
  'node-api': {
    folders: ['src', 'src/controllers', 'src/models', 'src/routes', 'src/middleware', 'tests'],
    files: ['src/server.js', '.env', 'README.md', 'package.json']
  },
  'python-flask': {
    folders: ['app', 'app/routes', 'app/models', 'tests'],
    files: ['app.py', 'requirements.txt', 'README.md']
  },
  'react-app': {
    folders: ['public', 'src', 'src/components', 'src/pages', 'src/assets'],
    files: ['public/index.html', 'src/App.jsx', 'src/index.js', 'package.json', 'README.md']
  },
  'default': {
    folders: ['src', 'docs', 'tests'],
    files: ['main.js', 'README.md']
  }
};

exports.generateProject = (basePath, projectName, techStack, snippets) => {
  const projectPath = path.join(basePath, projectName.replace(/\s+/g, '-'));
  
  // Déterminer la structure
  let structureKey = 'default';
  if (techStack.includes('Node.js') || techStack.includes('Express')) structureKey = 'node-api';
  if (techStack.includes('Flask') || techStack.includes('Python')) structureKey = 'python-flask';
  if (techStack.includes('React') || techStack.includes('Frontend')) structureKey = 'react-app';

  const structure = STRUCTURES[structureKey];

  // Créer les dossiers
  structure.folders.forEach(folder => {
    const dir = path.join(projectPath, folder);
    fs.mkdirSync(dir, { recursive: true });
  });

  // Générer les fichiers clés
  const { generateReadme } = require('./readme-generator');
  const { generatePackageJson } = require('./package-json-builder');
  const generateDockerfile = require('./docker-generator');

  // README.md
  fs.writeFileSync(
    path.join(projectPath, 'README.md'),
    generateReadme(projectName, `Projet généré automatiquement par CodeVault AI`, snippets)
  );

  // package.json ou requirements.txt
  if (structureKey === 'node-api' || structureKey === 'react-app') {
    fs.writeFileSync(
      path.join(projectPath, 'package.json'),
      generatePackageJson(projectName, techStack.filter(t => t !== 'Node.js' && t !== 'React'))
    );
  }

  if (structureKey === 'python-flask') {
    fs.writeFileSync(
      path.join(projectPath, 'requirements.txt'),
      techStack.filter(t => t.startsWith('py')).join('\n')
    );
  }

  // Dockerfile
  fs.writeFileSync(
    path.join(projectPath, 'Dockerfile'),
    generateDockerfile(techStack)
  );

  return projectPath;
};













