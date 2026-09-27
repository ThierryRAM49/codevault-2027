// Génère un lien de connexion automatique (sans mot de passe) pour un compte donné.
// Usage: node scripts/generate-magic-link.js <username> [durée, ex: 90d]

const path = require("path");
const jwt = require("jsonwebtoken");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MAGIC_LINK_SECRET = process.env.MAGIC_LINK_SECRET || "MAGIC_LINK_SECRET";
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:3000";

const users = [
  { id: 1, username: process.env.ADMIN_USERNAME || "admin", role: "admin" },
  { id: 2, username: process.env.VISITOR_USERNAME || "visitor", role: "visitor" },
];

const [, , usernameArg, expiresInArg] = process.argv;
const username = usernameArg || process.env.VISITOR_USERNAME;
const expiresIn = expiresInArg || "90d";

const user = users.find((u) => u.username === username);
if (!user) {
  console.error(`Compte "${username}" introuvable. Comptes disponibles: ${users.map((u) => u.username).join(", ")}`);
  process.exit(1);
}

const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, MAGIC_LINK_SECRET, {
  expiresIn,
});

console.log(`Lien de connexion automatique pour "${user.username}" (rôle: ${user.role}, valable ${expiresIn}) :`);
console.log(`${CLIENT_ORIGIN}/?token=${token}`);
