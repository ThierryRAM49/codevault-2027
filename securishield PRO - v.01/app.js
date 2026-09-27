// app.js - Serveur Express simple avec JWT et refresh tokens

const express = require("express");
const jwt = require("jsonwebtoken"); // Pour créer et vérifier JWT
const cookieParser = require("cookie-parser"); // Pour gérer les cookies HTTP
const bodyParser = require("body-parser");

require("dotenv").config(); // Charger les variables d'environnement

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware pour parser le JSON dans le corps des requêtes
app.use(bodyParser.json());

// Middleware pour parser les cookies (lecture des cookies HTTP-only)
app.use(cookieParser());

// Secret pour signer les tokens
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "ACCESS_SECRET";
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "REFRESH_SECRET";

// Stockage en mémoire des refresh tokens valides (exemple simplifié)
let refreshTokens = [];

// Mock base utilisateurs (en base réelle stocker en BD)
const users = [
  { id: 1, username: "user1", password: "password1" }, // Ne pas stocker passwords en clair en prod !
];

// Fonction pour créer un access token (court terme)
function generateAccessToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, ACCESS_TOKEN_SECRET, { expiresIn: "15m" }); // expire en 15 minutes
}

// Fonction pour créer un refresh token (long terme)
function generateRefreshToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" }); // expire en 7 jours
}

// Endpoint Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  // Vérification simplifiée de l'utilisateur
  const user = users.find((u) => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ message: "Identifiants invalides" });

  // Générer tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Stocker le refresh token (en base de données ou mémoire)
  refreshTokens.push(refreshToken);

  // Envoyer le refresh token en cookie HTTP-only sécurisé
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true, // Empêche le JS d’y accéder (protection XSS)
    secure: true,   // Envoyer seulement via HTTPS (mettre false en dev local)
    sameSite: "Strict", // Protège contre CSRF
    maxAge: 7 * 24 * 60 * 60 * 1000, // Expire en 7 jours
  });

  // Envoyer l’access token en réponse (à stocker en mémoire côté client)
  res.json({ accessToken });
});

// Endpoint pour rafraîchir le token d’accès
app.post("/refresh_token", (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "Pas de refresh token" });

  if (!refreshTokens.includes(token)) return res.status(403).json({ message: "Refresh token invalide" });

  jwt.verify(token, REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: "Refresh token expiré" });

    const newAccessToken = generateAccessToken({ id: user.id, username: user.username });
    res.json({ accessToken: newAccessToken });
  });
});

// Endpoint Logout (suppression du refresh token)
app.post("/logout", (req, res) => {
  const token = req.cookies.refreshToken;
  refreshTokens = refreshTokens.filter((t) => t !== token); // Retirer refresh token
  res.clearCookie("refreshToken"); // Supprimer le cookie côté client
  res.json({ message: "Déconnexion réussie" });
});

// Middleware d’authentification (vérification du token d’accès)
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];

  const token = authHeader && authHeader.split(" ")[1]; // Récupérer token Bearer
  if (!token) return res.sendStatus(401);

  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user; // stocker les infos utilisateur dans req
    next();
  });
}

// Route protégée nécessitant une authentification valide
app.get("/protected", authenticateToken, (req, res) => {
  res.json({ message: `Bonjour ${req.user.username}, accès autorisé !` });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
