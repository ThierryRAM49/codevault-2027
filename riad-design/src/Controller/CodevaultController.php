<?php
namespace App\Controller;

use Anthropic\Client as AnthropicClient;
use App\Entity\CodevaultAccessToken;
use App\Repository\CodevaultAccessTokenRepository;
use Doctrine\ORM\EntityManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\DependencyInjection\Attribute\Autowire;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\RateLimiter\RateLimiterFactory;
use Symfony\Component\Routing\Attribute\Route;

// Serves the CodeVaultAI web port on riad-design.cloud (the apex, now that the
// DEVOPS tool has moved to devops.riad-design.cloud — see DevopsController).
// Everything (HTML, JS, CSS, Monaco's asset tree) goes through PHP-FPM because
// nginx's document root for this vhost doesn't map to this project's public/
// directory — the same shared-infra quirk documented on DevopsController's assets.
//
// Access model: "/" is a public landing page explaining the tool. A visitor's
// email request (requestAccess()) does NOT get them a link directly — it
// notifies the site owner (approveAccess()), who must explicitly approve it
// before the visitor's magic link is even sent. Only after that does the
// usual confirm-click flow (verifyAccess()/confirmAccess()) apply to grant
// the "/app" session flag. Replaces the old scheme where every visitor
// silently got an auto-generated admin token on first load.
class CodevaultController extends AbstractController
{
    private const MIME_TYPES = [
        'html' => 'text/html; charset=UTF-8',
        'js' => 'application/javascript',
        'css' => 'text/css',
        'json' => 'application/json',
        'png' => 'image/png',
        'jpg' => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'woff' => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf' => 'font/ttf',
        'map' => 'application/json',
        'txt' => 'text/plain; charset=UTF-8',
    ];

    private const FROM_EMAIL = 'heyou.fr@gmail.com';
    private const ADMIN_EMAIL = 'heyou.fr@gmail.com';
    private const MAGIC_LINK_TTL_MINUTES = 15;
    private const SESSION_KEY = 'codevault_access_granted';
    private const ROLE_SESSION_KEY = 'codevault_role';
    private const ACCESS_ID_SESSION_KEY = 'codevault_access_id';
    private const CSRF_SESSION_KEY = 'codevault_csrf_token';

    // Self-service read-only trial (no email, no owner approval): a single
    // click grants /app for TRIAL_DURATION_SECONDS. Deliberately far more
    // limited than the real access gate — see requestTrial()/app().
    private const TRIAL_EXPIRES_SESSION_KEY = 'codevault_trial_expires_at';
    private const TRIAL_DURATION_SECONDS = 60;

    // Cloud fallback for the in-app AI assistant, used only when the
    // visitor's browser can't find any local AI server (Ollama, LM
    // Studio...). Haiku 4.5, deliberately: this endpoint is called
    // automatically by any gated "user"/"admin" session with no volume cap
    // beyond the IP rate limiter below, so cost per call matters here.
    private const ANTHROPIC_MODEL = 'claude-haiku-4-5';
    private const ANTHROPIC_MAX_TOKENS = 1000;
    private const ANTHROPIC_MAX_PROMPT_CHARS = 4000;
    private const ANTHROPIC_SYSTEM_PROMPT = 'Tu es Laetitia, une assistante IA pour développeurs intégrée à CodeVaultAI. Réponds brièvement et en français.';

    public function __construct(
        private readonly EntityManagerInterface $em,
        private readonly CodevaultAccessTokenRepository $tokens,
        private readonly MailerInterface $mailer,
        #[Autowire(service: 'limiter.codevault_access_ip')]
        private readonly RateLimiterFactory $ipLimiter,
        #[Autowire(service: 'limiter.codevault_access_email')]
        private readonly RateLimiterFactory $emailLimiter,
        #[Autowire(service: 'limiter.codevault_anthropic_ip')]
        private readonly RateLimiterFactory $anthropicIpLimiter,
        #[Autowire(service: 'limiter.codevault_trial_ip')]
        private readonly RateLimiterFactory $trialIpLimiter,
    ) {
    }

    #[Route('/', name: 'app_codevault_home', host: 'riad-design.cloud', priority: 10)]
    #[Route('/', name: 'app_codevault_home_www', host: 'www.riad-design.cloud', priority: 10)]
    public function landing(Request $request): Response
    {
        $sent = $request->query->get('sent') === '1';
        $error = $request->query->get('error');

        // The nav's "Connexion Admin" button links here with ?admin=1 to
        // prefill the request form with the owner's own address, skipping
        // retyping it. It still goes through the normal approve + magic-link
        // email flow below — no session bypass, matches the deliberate
        // removal of the old auto-admin-token scheme.
        $prefillEmail = $request->query->get('admin') === '1' ? self::ADMIN_EMAIL : '';

        $errorMessages = [
            'invalid_email' => "Adresse email invalide.",
            'send_failed' => "Impossible d'envoyer l'email pour le moment. Réessayez dans un instant.",
            'invalid_token' => "Ce lien de connexion n'est pas valide.",
            'expired_token' => "Ce lien de connexion a expiré (validité : " . self::MAGIC_LINK_TTL_MINUTES . " minutes). Demandez-en un nouveau ci-dessous.",
            'used_token' => "Ce lien de connexion a déjà été utilisé. Demandez-en un nouveau ci-dessous.",
            'rate_limited' => "Trop de demandes récentes pour cette adresse ou cette connexion. Réessayez dans quelques minutes.",
            'invalid_request' => "Requête invalide, merci de réessayer.",
            'revoked' => "Votre accès a été révoqué. Contactez l'administrateur si besoin.",
            'trial_expired' => "Votre essai d'une minute est terminé. Demandez un accès complet ci-dessous pour continuer.",
        ];

        $ttl = self::MAGIC_LINK_TTL_MINUTES;
        $csrfToken = $this->getOrCreateCsrfToken($request);

        // Social proof: real count of people who actually completed login,
        // not requests. Framed differently below a small threshold so a low
        // number reads as "early" rather than "empty".
        $usedCount = $this->tokens->countUsed();

        // Referral: ?ref=<code> from someone's personal share link. Only
        // shown/passed through if it resolves to a real code — an invalid
        // one is just silently dropped, never an error for the visitor.
        $refCode = trim((string) $request->query->get('ref', ''));
        $referrer = $refCode !== '' ? $this->tokens->findByReferralCode($refCode) : null;

        $referralBanner = '';
        if ($referrer !== null) {
            $referralBanner = '<p class="referral-banner">👋 Invité(e) par un développeur CodeVaultAI</p>';
        }

        $socialProof = $usedCount >= 10
            ? "🔥 {$usedCount} développeurs ont déjà rejoint CodeVaultAI"
            : "🚀 Rejoignez les premiers développeurs à essayer CodeVaultAI";

        $banner = '';
        if ($sent) {
            $banner = '<div class="banner banner-ok">📩 Votre demande a été transmise. Vous recevrez un lien de connexion par email dès qu\'elle sera approuvée.</div>';
        } elseif ($error !== null && isset($errorMessages[$error])) {
            $banner = '<div class="banner banner-error">⚠️ ' . $errorMessages[$error] . '</div>';
        }

        $hologramLogo = $this->hologramLogoMarkup('CodeVaultAI');

        $response = new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CodeVaultAI — riAd Design</title>
                <meta name="description" content="Un coffre-fort de snippets de code avec éditeur, analyse, auto-fix et assistant IA. Accès par lien de connexion envoyé par email.">
                <link rel="canonical" href="https://riad-design.cloud/">
                <link rel="icon" href="/assets/icon.png">
                <meta property="og:type" content="website">
                <meta property="og:site_name" content="riAd Design">
                <meta property="og:title" content="CodeVaultAI — le coffre-fort de vos snippets de code">
                <meta property="og:description" content="Éditeur Monaco, analyse et auto-fix, formatage et assistant IA. Accès par lien de connexion envoyé par email.">
                <meta property="og:url" content="https://riad-design.cloud/">
                <meta property="og:locale" content="fr_FR">
                <meta name="twitter:card" content="summary">
                <meta name="twitter:title" content="CodeVaultAI — le coffre-fort de vos snippets de code">
                <meta name="twitter:description" content="Éditeur Monaco, analyse et auto-fix, formatage et assistant IA. Accès par lien de connexion envoyé par email.">
                <style>
                    :root { color-scheme: dark; }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        min-height: 100vh;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: radial-gradient(ellipse at top, #1e293b 0%, #0a0a15 55%, #050510 100%);
                        color: #a5f3fc;
                        display: flex;
                        justify-content: center;
                        padding: 48px 20px 80px;
                    }
                    main { width: 100%; max-width: 720px; }
                    nav {
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                        margin-bottom: 24px;
                    }
                    nav a {
                        color: #67e8f9;
                        text-decoration: none;
                        font-size: 0.85rem;
                        font-weight: 600;
                        border: 1px solid rgba(34, 211, 238, 0.3);
                        border-radius: 8px;
                        padding: 8px 14px;
                        transition: background 0.15s;
                    }
                    nav a:hover { background: rgba(34, 211, 238, 0.1); }
                    .logo {
                        display: block;
                        width: 72px;
                        height: 72px;
                        margin: 0 auto 16px;
                        border-radius: 18px;
                        box-shadow: 0 0 30px rgba(34, 211, 238, 0.35);
                    }
                    h1 {
                        font-size: 2.4rem;
                        font-weight: 800;
                        color: #fff;
                        margin: 0 0 8px;
                        text-align: center;
                    }
                    .hologram-logo { white-space: nowrap; }
                    .hologram-letter {
                        display: inline-block;
                        transform-origin: center bottom;
                        opacity: 0;
                        visibility: hidden;
                        animation:
                            hologram-intro 1.6s cubic-bezier(0.22, 0.9, 0.3, 1) var(--d, 0s) forwards,
                            hologram-lens 9s ease-in-out var(--ld, 1.6s) infinite,
                            hologram-cycle 11s ease-in-out var(--cycle-delay, 6.1s) infinite;
                        animation-play-state: paused;
                    }
                    .hologram-logo.is-animating .hologram-letter { animation-play-state: running; }
                    @keyframes hologram-intro {
                        0% { opacity: 0; visibility: visible; transform: scale(2.4); filter: blur(6px); text-shadow: none; }
                        14% { opacity: 1; transform: scale(1.7); filter: blur(2px); text-shadow: 1px 0 0 rgba(59, 130, 246, 0.4), -1px 0 0 rgba(34, 211, 238, 0.4); }
                        24% { opacity: 0.25; transform: scale(1.35); filter: blur(1px); text-shadow: none; }
                        40% { opacity: 1; transform: scale(1.18); filter: blur(0); text-shadow: 0 0 10px rgba(34, 211, 238, 0.9), 0 0 22px rgba(34, 211, 238, 0.5); }
                        58% { opacity: 0.55; transform: scale(0.94); text-shadow: 0 0 4px rgba(34, 211, 238, 0.6); }
                        100% { opacity: 1; transform: scale(1); text-shadow: 0 0 8px rgba(34, 211, 238, 0.7), 0 0 18px rgba(34, 211, 238, 0.35); }
                    }
                    @keyframes hologram-lens {
                        0%, 80%, 100% { transform: scale(1); filter: brightness(1) hue-rotate(0deg) saturate(1); }
                        84% { transform: scale(1.8); filter: brightness(1.6) hue-rotate(30deg) saturate(1.6); }
                        89% { transform: scale(2.45); filter: brightness(2.1) hue-rotate(50deg) saturate(2.2); }
                        92% { transform: scale(2.1); filter: brightness(1.5) hue-rotate(60deg) saturate(1.6); }
                        97% { transform: scale(1.15); filter: brightness(1.05) hue-rotate(20deg) saturate(1.1); }
                    }
                    @keyframes hologram-cycle {
                        0%, 30% { opacity: 1; color: rgb(34, 211, 238); text-shadow: 1px 0 0 rgba(59, 130, 246, 0.25), -1px 0 0 rgba(103, 232, 249, 0.25), 0 0 8px rgba(34, 211, 238, 0.7), 0 0 18px rgba(34, 211, 238, 0.35); }
                        34% { opacity: 0.3; text-shadow: 0 0 3px rgba(34, 211, 238, 0.4); }
                        38% { opacity: 0; visibility: hidden; color: rgb(34, 211, 238); text-shadow: none; }
                        40% { opacity: 0; visibility: hidden; color: rgb(59, 130, 246); text-shadow: none; }
                        44% { opacity: 1; visibility: visible; text-shadow: 0 0 14px rgba(59, 130, 246, 1), 0 0 28px rgba(59, 130, 246, 0.6); }
                        48% { opacity: 0.4; text-shadow: 0 0 4px rgba(59, 130, 246, 0.5); }
                        52%, 80% { opacity: 1; color: rgb(59, 130, 246); text-shadow: 1px 0 0 rgba(34, 211, 238, 0.25), -1px 0 0 rgba(255, 255, 255, 0.2), 0 0 8px rgba(59, 130, 246, 0.7), 0 0 18px rgba(59, 130, 246, 0.35); }
                        84% { opacity: 0.3; text-shadow: 0 0 3px rgba(59, 130, 246, 0.4); }
                        88% { opacity: 0; visibility: hidden; color: rgb(59, 130, 246); text-shadow: none; }
                        90% { opacity: 0; visibility: hidden; color: rgb(34, 211, 238); text-shadow: none; }
                        94% { opacity: 1; visibility: visible; text-shadow: 0 0 14px rgba(34, 211, 238, 1), 0 0 28px rgba(34, 211, 238, 0.6); }
                        97% { opacity: 0.4; text-shadow: 0 0 4px rgba(34, 211, 238, 0.5); }
                        100% { opacity: 1; color: rgb(34, 211, 238); text-shadow: 1px 0 0 rgba(59, 130, 246, 0.25), -1px 0 0 rgba(103, 232, 249, 0.25), 0 0 8px rgba(34, 211, 238, 0.7), 0 0 18px rgba(34, 211, 238, 0.35); }
                    }
                    @media (prefers-reduced-motion: reduce) {
                        .hologram-letter { animation: none; opacity: 1; visibility: visible; transform: none; filter: none; text-shadow: 0 0 8px rgba(34, 211, 238, 0.7), 0 0 18px rgba(34, 211, 238, 0.35); }
                    }
                    .tagline {
                        text-align: center;
                        color: #94a3b8;
                        font-size: 1.05rem;
                        margin: 0 0 40px;
                    }
                    .features {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 16px;
                        margin-bottom: 40px;
                    }
                    .feature {
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(34, 211, 238, 0.15);
                        border-radius: 12px;
                        padding: 18px;
                    }
                    .feature .icon { font-size: 1.6rem; margin-bottom: 8px; }
                    .feature h3 { margin: 0 0 6px; font-size: 0.95rem; color: #fff; }
                    .feature p { margin: 0; font-size: 0.85rem; color: #94a3b8; line-height: 1.4; }
                    .access {
                        background: rgba(15, 23, 42, 0.75);
                        border: 1px solid rgba(34, 211, 238, 0.25);
                        border-radius: 16px;
                        padding: 28px;
                        text-align: center;
                    }
                    .access h2 { color: #fff; font-size: 1.2rem; margin: 0 0 6px; }
                    .access p { color: #94a3b8; font-size: 0.85rem; margin: 0 0 20px; }
                    form { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
                    input[type=email] {
                        flex: 1 1 260px;
                        background: #000;
                        border: 1px solid rgba(34, 211, 238, 0.3);
                        border-radius: 8px;
                        color: #e2e8f0;
                        padding: 12px 14px;
                        font-size: 0.95rem;
                    }
                    input[type=email]:focus { outline: none; border-color: #22d3ee; }
                    button {
                        background: linear-gradient(90deg, #0891b2, #2563eb);
                        color: #fff;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-weight: 700;
                        cursor: pointer;
                        font-size: 0.9rem;
                    }
                    button:hover { filter: brightness(1.1); }
                    .social-proof {
                        text-align: center;
                        color: #67e8f9;
                        font-size: 0.85rem;
                        font-weight: 600;
                        margin: 0 0 8px;
                    }
                    .referral-banner {
                        text-align: center;
                        color: #86efac;
                        font-size: 0.85rem;
                        margin: 0 0 24px;
                    }
                    .demo {
                        background: rgba(15, 23, 42, 0.6);
                        border: 1px solid rgba(34, 211, 238, 0.15);
                        border-radius: 16px;
                        padding: 24px;
                        margin-bottom: 32px;
                    }
                    .demo h2 { color: #fff; font-size: 1.1rem; margin: 0 0 6px; }
                    .demo > p { color: #94a3b8; font-size: 0.85rem; margin: 0 0 16px; }
                    .demo-lang-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
                    .demo-lang-row label { color: #94a3b8; font-size: 0.8rem; }
                    .demo-lang-row select {
                        background: #000;
                        border: 1px solid rgba(34, 211, 238, 0.3);
                        border-radius: 8px;
                        color: #e2e8f0;
                        padding: 6px 10px;
                        font-size: 0.82rem;
                    }
                    .demo-lang-row select:focus { outline: none; border-color: #22d3ee; }
                    .demo-lang-detected { color: #67e8f9; font-size: 0.78rem; }
                    .demo-lang-detected[hidden] { display: none; }
                    .demo textarea {
                        width: 100%;
                        min-height: 110px;
                        background: #000;
                        border: 1px solid rgba(34, 211, 238, 0.3);
                        border-radius: 8px;
                        color: #e2e8f0;
                        padding: 12px 14px;
                        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
                        font-size: 0.85rem;
                        resize: vertical;
                        margin-bottom: 12px;
                    }
                    .demo textarea:focus { outline: none; border-color: #22d3ee; }
                    .demo-actions { display: flex; gap: 10px; flex-wrap: wrap; }
                    .demo-actions button { padding: 9px 16px; font-size: 0.82rem; }
                    .demo-result { margin-top: 14px; }
                    .demo-result p { margin: 4px 0; font-size: 0.82rem; }
                    .demo-err { color: #fca5a5; }
                    .demo-warn { color: #fcd34d; }
                    .demo-sug { color: #67e8f9; }
                    .demo-ok { color: #86efac; }
                    .banner {
                        max-width: 480px;
                        margin: 0 auto 20px;
                        padding: 12px 16px;
                        border-radius: 8px;
                        font-size: 0.85rem;
                        text-align: left;
                    }
                    .banner-ok { background: rgba(34, 197, 94, 0.12); border: 1px solid rgba(34, 197, 94, 0.35); color: #86efac; }
                    .banner-error { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; }
                    .privacy { text-align: center; color: #64748b; font-size: 0.75rem; margin-top: 16px; }
                    .trial-form { margin-top: 14px; text-align: center; }
                    .trial-btn {
                        background: transparent;
                        border: 1px solid rgba(251, 191, 36, 0.4);
                        color: #fcd34d;
                        padding: 9px 16px;
                        border-radius: 8px;
                        font-size: 0.8rem;
                        font-weight: 600;
                        cursor: pointer;
                    }
                    .trial-btn:hover { background: rgba(251, 191, 36, 0.1); }
                </style>
                {$this->cookieBannerStyles()}
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "SoftwareApplication",
                    "name": "CodeVaultAI",
                    "applicationCategory": "DeveloperApplication",
                    "operatingSystem": "Web",
                    "description": "Coffre-fort de snippets de code avec éditeur Monaco, analyse, auto-fix, formatage et assistant IA.",
                    "url": "https://riad-design.cloud/",
                    "offers": {
                        "@type": "Offer",
                        "price": "0",
                        "priceCurrency": "EUR"
                    }
                }
                </script>
            </head>
            <body>
                <main>
                    <nav>
                        <a href="/?admin=1#access">🔑 Connexion Admin</a>
                        <a href="https://portfolio.riad-design.cloud/">👤 Mon Portfolio →</a>
                        <a href="https://devops.riad-design.cloud/">🛠️ Outil DEVOPS →</a>
                    </nav>
                    <img src="/assets/icon.png" alt="CodeVaultAI" class="logo">
                    <h1>{$hologramLogo}</h1>
                    <p class="tagline">Le coffre-fort de vos snippets de code — organisé, analysé, et boosté à l'IA.</p>
                    <p class="social-proof">{$socialProof}</p>
                    {$referralBanner}

                    <div class="features">
                        <div class="feature">
                            <div class="icon">🔐</div>
                            <h3>Coffre-fort personnel</h3>
                            <p>Sauvegardez, taguez et retrouvez vos snippets de code en un instant.</p>
                        </div>
                        <div class="feature">
                            <div class="icon">🧠</div>
                            <h3>Éditeur Monaco</h3>
                            <p>Le même éditeur que VS Code, avec coloration syntaxique complète.</p>
                        </div>
                        <div class="feature">
                            <div class="icon">🩺</div>
                            <h3>Analyse &amp; Auto-Fix</h3>
                            <p>Détecte les erreurs courantes dans votre code et les corrige automatiquement.</p>
                        </div>
                        <div class="feature">
                            <div class="icon">✨</div>
                            <h3>Beautifier</h3>
                            <p>Reformatez n'importe quel snippet proprement, en un clic.</p>
                        </div>
                        <div class="feature">
                            <div class="icon">🤖</div>
                            <h3>Assistant IA</h3>
                            <p>Posez des questions sur votre code à un modèle connecté en local.</p>
                        </div>
                        <div class="feature">
                            <div class="icon">📥</div>
                            <h3>Import glisser-déposer</h3>
                            <p>Importez vos fichiers de code directement depuis votre explorateur.</p>
                        </div>
                    </div>

                    <div class="demo">
                        <h2>🧪 Essayez en direct</h2>
                        <p>Le vrai moteur d'analyse de CodeVaultAI, ici même — sans compte, sans envoi au serveur.</p>
                        <div class="demo-lang-row">
                            <label for="demo-lang">Langage :</label>
                            <select id="demo-lang" onchange="cvDemoLangChanged()">
                                <option value="JS" selected>JavaScript</option>
                                <option value="TYPESCRIPT">TypeScript</option>
                                <option value="PYTHON">Python</option>
                                <option value="PHP">PHP</option>
                                <option value="JSON">JSON</option>
                                <option value="CSS">CSS</option>
                                <option value="HTML">HTML</option>
                            </select>
                            <span id="demo-lang-detected" class="demo-lang-detected" hidden></span>
                        </div>
                        <textarea id="demo-code" spellcheck="false">var total = 10
            if (total == 10) {
              console.log("debug leftover")
            }</textarea>
                        <div class="demo-actions">
                            <button type="button" onclick="cvDemoAnalyze()">🔍 Analyser</button>
                            <button type="button" onclick="cvDemoFix()">🔧 Auto-Fix</button>
                            <button type="button" onclick="cvDemoFormat()">✨ Formater</button>
                        </div>
                        <div id="demo-result" class="demo-result"></div>
                    </div>

                    {$banner}

                    <div class="access" id="access">
                        <h2>Accéder à l'outil</h2>
                        <p>Entrez votre email pour envoyer une demande d'accès. Une fois approuvée, vous recevrez un lien de connexion valable {$ttl} minutes.</p>
                        <form method="post" action="/access/request">
                            <input type="hidden" name="csrf_token" value="{$csrfToken}">
                            <input type="hidden" name="ref" value="{$refCode}">
                            <input type="email" name="email" value="{$prefillEmail}" placeholder="vous@exemple.com" required>
                            <button type="submit">Demander l'accès</button>
                        </form>
                        <p class="privacy">Votre email sert uniquement à vous envoyer ce lien de connexion.</p>
                        <form method="post" action="/trial" class="trial-form">
                            <input type="hidden" name="csrf_token" value="{$csrfToken}">
                            <button type="submit" class="trial-btn">👀 Essai rapide (1 min, lecture seule, sans email)</button>
                        </form>
                    </div>

                    <footer>{$this->legalFooterMarkup()}</footer>
                </main>
                {$this->demoWidgetMarkup()}
                {$this->cookieBannerMarkup()}
                <script>
                  // Two rAFs so the "all letters hidden" state actually paints
                  // before the reveal starts, same intent as the React logo.
                  requestAnimationFrame(() => requestAnimationFrame(() => {
                    document.getElementById('cv-hologram-logo')?.classList.add('is-animating');
                  }));
                </script>
            </body>
            </html>
            HTML);

        $this->setHardeningHeaders($response);

        return $response;
    }

    #[Route('/politique-de-confidentialite', name: 'app_codevault_privacy', host: 'riad-design.cloud', priority: 10)]
    #[Route('/politique-de-confidentialite', name: 'app_codevault_privacy_www', host: 'www.riad-design.cloud', priority: 10)]
    public function privacyPolicy(): Response
    {
        $ttl = self::MAGIC_LINK_TTL_MINUTES;
        $banner = $this->cookieBannerMarkup();
        $footer = $this->legalFooterMarkup();
        $cookieStyles = $this->cookieBannerStyles();

        $response = new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Politique de confidentialité — CodeVaultAI</title>
                <meta name="description" content="Politique de confidentialité et cookies de CodeVaultAI : données collectées, finalités, durées de conservation, cookies utilisés.">
                <link rel="canonical" href="https://riad-design.cloud/politique-de-confidentialite">
                <link rel="icon" href="/assets/icon.png">
                {$this->legalPageStyles()}
                {$cookieStyles}
            </head>
            <body>
                <main>
                    <nav><a href="/">← Retour à l'accueil</a></nav>
                    <h1>Politique de confidentialité</h1>
                    <p class="updated">Dernière mise à jour : 27/08/2026</p>

                    <section class="card">
                        <h2>1. Qui sommes-nous</h2>
                        <p>CodeVaultAI est un outil édité par riAd Design, accessible sur riad-design.cloud. Pour toute question relative à vos données, contactez-nous à <a href="mailto:riad-design@gmx.com">riad-design@gmx.com</a>.</p>
                    </section>

                    <section class="card">
                        <h2>2. Données collectées</h2>
                        <ul>
                            <li><strong>Adresse email</strong> — lorsque vous demandez un accès à l'outil via le formulaire « Demander l'accès ».</li>
                            <li><strong>Métadonnées de la demande</strong> — dates de demande, d'approbation et d'utilisation du lien de connexion, adresse IP (limitation du nombre de tentatives, prévention des abus).</li>
                            <li><strong>Rôle attribué</strong> (utilisateur ou administrateur) — conservé en session le temps de votre connexion.</li>
                            <li><strong>Code de parrainage</strong> — si vous arrivez via le lien d'un autre utilisateur, ou si vous partagez le vôtre, un code technique associe les deux demandes. Aucune information supplémentaire n'est échangée entre parrain et filleul.</li>
                        </ul>
                        <p>Aucune autre donnée personnelle n'est collectée. Le contenu de vos snippets de code n'est <strong>jamais</strong> envoyé ni stocké sur nos serveurs : il reste stocké localement dans le navigateur (IndexedDB) de l'appareil que vous utilisez.</p>
                    </section>

                    <section class="card">
                        <h2>3. Finalité du traitement</h2>
                        <p>Ces données servent uniquement à :</p>
                        <ul>
                            <li>vérifier votre identité et vous transmettre un lien de connexion à usage unique ;</li>
                            <li>sécuriser l'accès à l'outil et prévenir les tentatives d'abus (limitation de débit) ;</li>
                            <li>vous attribuer les droits d'utilisation adaptés (utilisateur ou administrateur).</li>
                        </ul>
                        <p>Nous n'utilisons vos données à aucune fin commerciale, publicitaire ou de profilage.</p>
                    </section>

                    <section class="card">
                        <h2>4. Durée de conservation</h2>
                        <ul>
                            <li>Le lien de connexion expire {$ttl} minutes après approbation et n'est utilisable qu'une seule fois.</li>
                            <li>La demande d'accès (email, statut, dates) est conservée pour assurer la traçabilité et la sécurité de l'accès à l'outil ; vous pouvez en demander la suppression à tout moment (voir la page <a href="/rgpd">RGPD</a>).</li>
                            <li>La session de connexion (cookie <code>PHPSESSID</code>) est supprimée à la fermeture du navigateur ou lors de la déconnexion.</li>
                        </ul>
                    </section>

                    <section class="card" id="cookies">
                        <h2>5. Cookies</h2>
                        <p>Nous utilisons un seul cookie, strictement nécessaire au fonctionnement du site :</p>
                        <table>
                            <thead><tr><th>Cookie</th><th>Finalité</th><th>Durée</th></tr></thead>
                            <tbody>
                                <tr><td><code>PHPSESSID</code></td><td>Maintient votre session de connexion (accès approuvé, rôle)</td><td>Session (supprimé à la fermeture du navigateur)</td></tr>
                            </tbody>
                        </table>
                        <p>Ce cookie étant strictement nécessaire au fonctionnement du service, il ne requiert pas votre consentement. Aucun cookie de mesure d'audience, publicitaire ou de réseau social n'est déposé sur ce site.</p>
                        <p>Votre choix concernant le bandeau d'information cookies est mémorisé localement dans votre navigateur (<code>localStorage</code>, jamais transmis à nos serveurs) afin de ne pas vous le présenter à chaque visite. Vous pouvez le modifier à tout moment via « Gérer les cookies » en bas de page.</p>
                    </section>

                    <section class="card">
                        <h2>6. Partage des données</h2>
                        <p>Vos données ne sont ni vendues, ni louées, ni partagées avec des tiers à des fins commerciales. Elles ne quittent pas nos serveurs, à l'exception de l'envoi technique de l'email de connexion via notre prestataire d'envoi d'emails.</p>
                    </section>

                    <section class="card">
                        <h2>7. Vos droits</h2>
                        <p>Le détail de vos droits (accès, rectification, effacement, opposition) et la marche à suivre pour les exercer figurent sur notre page <a href="/rgpd">RGPD</a>.</p>
                    </section>

                    <footer>{$footer}</footer>
                </main>
                {$banner}
            </body>
            </html>
            HTML);

        $this->setHardeningHeaders($response);

        return $response;
    }

    #[Route('/rgpd', name: 'app_codevault_gdpr', host: 'riad-design.cloud', priority: 10)]
    #[Route('/rgpd', name: 'app_codevault_gdpr_www', host: 'www.riad-design.cloud', priority: 10)]
    public function gdpr(): Response
    {
        $banner = $this->cookieBannerMarkup();
        $footer = $this->legalFooterMarkup();
        $cookieStyles = $this->cookieBannerStyles();

        $response = new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>RGPD — CodeVaultAI</title>
                <meta name="description" content="Vos droits RGPD sur CodeVaultAI : responsable du traitement, base légale, droits d'accès, de rectification et d'effacement, contact et réclamation CNIL.">
                <link rel="canonical" href="https://riad-design.cloud/rgpd">
                <link rel="icon" href="/assets/icon.png">
                {$this->legalPageStyles()}
                {$cookieStyles}
            </head>
            <body>
                <main>
                    <nav><a href="/">← Retour à l'accueil</a></nav>
                    <h1>RGPD — Vos droits sur vos données</h1>
                    <p class="updated">Dernière mise à jour : 27/08/2026</p>
                    <p class="lead">Bienvenue sur CodeVaultAI. La protection de vos données personnelles est une priorité.</p>

                    <section class="card">
                        <h2>Responsable du traitement</h2>
                        <p>riAd Design — contact : <a href="mailto:riad-design@gmx.com">riad-design@gmx.com</a></p>
                    </section>

                    <section class="card">
                        <h2>Données traitées</h2>
                        <p>Le détail est décrit dans notre <a href="/politique-de-confidentialite">politique de confidentialité</a>. En résumé : votre adresse email (uniquement si vous demandez un accès), et des métadonnées techniques liées à cette demande (dates, statut, adresse IP pour la sécurité). Le contenu de vos snippets de code reste local à votre navigateur et ne nous est jamais transmis.</p>
                    </section>

                    <section class="card">
                        <h2>Base légale</h2>
                        <p>Le traitement repose sur l'intérêt légitime de riAd Design à sécuriser l'accès à son outil, et sur votre consentement lorsque vous soumettez volontairement le formulaire de demande d'accès.</p>
                    </section>

                    <section class="card">
                        <h2>Vos droits</h2>
                        <p>Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
                        <ul>
                            <li><strong>Droit d'accès</strong> — obtenir une copie des données que nous détenons sur vous.</li>
                            <li><strong>Droit de rectification</strong> — corriger une donnée inexacte.</li>
                            <li><strong>Droit à l'effacement</strong> (« droit à l'oubli ») — demander la suppression de votre demande d'accès et des données associées.</li>
                            <li><strong>Droit d'opposition</strong> — vous opposer au traitement de vos données.</li>
                            <li><strong>Droit à la limitation du traitement.</strong></li>
                        </ul>
                        <p>Pour exercer l'un de ces droits, écrivez-nous à <a href="mailto:riad-design@gmx.com">riad-design@gmx.com</a> en précisant l'adresse email concernée. Nous répondons dans un délai maximum d'un mois.</p>
                        <p>Vous disposez également du droit d'introduire une réclamation auprès de la <a href="https://www.cnil.fr" target="_blank" rel="noopener">CNIL</a> si vous estimez que vos droits ne sont pas respectés.</p>
                    </section>

                    <section class="card">
                        <h2>Sécurité</h2>
                        <p>L'accès à l'outil est protégé par un lien de connexion à usage unique, à durée de vie limitée, et par une validation manuelle de chaque demande. Aucun mot de passe n'est utilisé ni stocké.</p>
                    </section>

                    <section class="card">
                        <h2>Cookies</h2>
                        <p>Voir notre <a href="/politique-de-confidentialite#cookies">politique de confidentialité</a> pour le détail des cookies utilisés — un seul cookie technique strictement nécessaire, aucun cookie de mesure d'audience ou publicitaire.</p>
                    </section>

                    <footer>{$footer}</footer>
                </main>
                {$banner}
            </body>
            </html>
            HTML);

        $this->setHardeningHeaders($response);

        return $response;
    }

    #[Route('/robots.txt', name: 'app_codevault_robots', host: 'riad-design.cloud', priority: 10)]
    #[Route('/robots.txt', name: 'app_codevault_robots_www', host: 'www.riad-design.cloud', priority: 10)]
    public function robots(): Response
    {
        $response = new Response(<<<TXT
            User-agent: *
            Allow: /
            Disallow: /app
            Disallow: /admin
            Disallow: /access/
            Disallow: /logout

            Sitemap: https://riad-design.cloud/sitemap.xml
            TXT);
        $response->headers->set('Content-Type', 'text/plain');

        return $response;
    }

    #[Route('/sitemap.xml', name: 'app_codevault_sitemap', host: 'riad-design.cloud', priority: 10)]
    #[Route('/sitemap.xml', name: 'app_codevault_sitemap_www', host: 'www.riad-design.cloud', priority: 10)]
    public function sitemap(): Response
    {
        $response = new Response(<<<XML
            <?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                    <loc>https://riad-design.cloud/</loc>
                    <changefreq>weekly</changefreq>
                    <priority>1.0</priority>
                </url>
                <url>
                    <loc>https://riad-design.cloud/politique-de-confidentialite</loc>
                    <changefreq>monthly</changefreq>
                    <priority>0.3</priority>
                </url>
                <url>
                    <loc>https://riad-design.cloud/rgpd</loc>
                    <changefreq>monthly</changefreq>
                    <priority>0.3</priority>
                </url>
            </urlset>
            XML);
        $response->headers->set('Content-Type', 'application/xml');

        return $response;
    }

    private function legalPageStyles(): string
    {
        return <<<HTML
            <style>
                :root { color-scheme: dark; }
                * { box-sizing: border-box; }
                body {
                    margin: 0;
                    min-height: 100vh;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: radial-gradient(ellipse at top, #1e293b 0%, #0a0a15 55%, #050510 100%);
                    color: #cbd5e1;
                    display: flex;
                    justify-content: center;
                    padding: 48px 20px 100px;
                }
                main { width: 100%; max-width: 720px; }
                nav a {
                    color: #67e8f9;
                    text-decoration: none;
                    font-size: 0.85rem;
                    font-weight: 600;
                }
                nav a:hover { text-decoration: underline; }
                h1 { font-size: 1.9rem; font-weight: 800; color: #fff; margin: 24px 0 4px; }
                h2 { font-size: 1.05rem; color: #fff; margin: 0 0 10px; }
                .updated { color: #64748b; font-size: 0.8rem; margin: 0 0 8px; }
                .lead { color: #94a3b8; font-size: 0.95rem; margin: 0 0 28px; }
                .card {
                    background: rgba(15, 23, 42, 0.6);
                    border: 1px solid rgba(34, 211, 238, 0.15);
                    border-radius: 12px;
                    padding: 20px 22px;
                    margin-bottom: 16px;
                }
                .card p, .card li { font-size: 0.88rem; line-height: 1.6; color: #94a3b8; }
                .card ul { margin: 8px 0; padding-left: 20px; }
                .card a { color: #67e8f9; }
                .card strong { color: #cbd5e1; }
                code { background: rgba(148, 163, 184, 0.12); border-radius: 4px; padding: 1px 6px; font-size: 0.85em; color: #a5f3fc; }
                table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.85rem; }
                th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid rgba(148, 163, 184, 0.15); color: #94a3b8; }
                th { color: #cbd5e1; }
                footer { margin-top: 8px; }
            </style>
            HTML;
    }

    private function legalFooterMarkup(): string
    {
        return <<<HTML
            <nav class="legal-nav">
                <a href="/politique-de-confidentialite">Politique de confidentialité</a>
                <a href="/rgpd">RGPD</a>
                <a href="javascript:void(0)" onclick="cvOpenCookiePrefs()">Gérer les cookies</a>
                <a href="https://heyou.fr" target="_blank" rel="noopener">heyou.fr</a>
            </nav>
            HTML;
    }

    // Floating "parrainage" widget injected into /app for logged-in
    // visitors, independent of the React bundle (main.js) on purpose — adds
    // a self-contained referral panel without touching the app's own
    // component tree. Bottom-left, since the AI assistant panel already
    // owns bottom-right (see main.js's fixed bottom-4 right-4 chat widget).
    // Countdown banner for trial sessions (see requestTrial()) — client-side
    // enforcement as a backup to app()'s own server-side expiry check on the
    // next request. Top-center, on purpose: bottom-left is the referral
    // widget (hidden for trials anyway, no referral code) and bottom-right
    // is main.js's own AI chat panel.
    private function trialWidgetMarkup(): string
    {
        return <<<HTML
            <style>
                #cv-trial-banner {
                    position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 60;
                    background: rgba(10, 10, 21, 0.97); border: 1px solid rgba(251, 191, 36, 0.4);
                    border-radius: 999px; padding: 8px 18px; color: #fcd34d;
                    font-size: 0.8rem; font-weight: 700; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                }
            </style>
            <div id="cv-trial-banner">👀 Essai lecture seule — <span id="cv-trial-time">1:00</span></div>
            <script>
            (function () {
                var expiresAt = window.CODEVAULT_TRIAL_EXPIRES_AT;
                if (!expiresAt) return;
                var timeEl = document.getElementById('cv-trial-time');
                function tick() {
                    var remainingMs = expiresAt - Date.now();
                    if (remainingMs <= 0) {
                        var form = document.createElement('form');
                        form.method = 'post';
                        form.action = '/logout';
                        document.body.appendChild(form);
                        form.submit();
                        return;
                    }
                    var s = Math.ceil(remainingMs / 1000);
                    timeEl.textContent = Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60);
                    setTimeout(tick, 250);
                }
                tick();
            })();
            </script>
            HTML;
    }

    private function referralWidgetMarkup(): string
    {
        return <<<HTML
            <style>
                #cv-referral-btn {
                    position: fixed; left: 16px; bottom: 16px; z-index: 40;
                    background: linear-gradient(90deg, #0891b2, #2563eb);
                    color: #fff; border: none; border-radius: 999px;
                    padding: 10px 18px; font-weight: 700; font-size: 0.82rem;
                    cursor: pointer; box-shadow: 0 4px 20px rgba(8, 145, 178, 0.4);
                }
                #cv-referral-panel {
                    position: fixed; left: 16px; bottom: 64px; z-index: 40;
                    width: 300px; background: rgba(10, 10, 21, 0.97);
                    border: 1px solid rgba(34, 211, 238, 0.3); border-radius: 14px;
                    padding: 16px; color: #cbd5e1; font-size: 0.82rem;
                }
                #cv-referral-panel[hidden] { display: none; }
                #cv-referral-panel input {
                    width: 100%; background: #000; border: 1px solid rgba(34, 211, 238, 0.3);
                    border-radius: 8px; color: #e2e8f0; padding: 8px 10px; font-size: 0.78rem;
                    margin: 8px 0; box-sizing: border-box;
                }
                #cv-referral-panel button {
                    width: 100%; background: linear-gradient(90deg, #0891b2, #2563eb);
                    color: #fff; border: none; border-radius: 8px; padding: 8px; font-weight: 700;
                    font-size: 0.8rem; cursor: pointer;
                }
            </style>
            <button id="cv-referral-btn" type="button" onclick="cvToggleReferralPanel()">🎁 Parrainer</button>
            <div id="cv-referral-panel" hidden>
                <strong style="color:#fff;">Invite un développeur</strong>
                <p style="margin:6px 0 0;color:#94a3b8;">Partage ton lien : sa demande d'accès sera repérée comme venant de toi.</p>
                <input id="cv-referral-link" type="text" readonly>
                <button type="button" onclick="cvCopyReferralLink()">Copier le lien</button>
            </div>
            <script>
            (function () {
                var code = window.CODEVAULT_REFERRAL_CODE;
                var btn = document.getElementById('cv-referral-btn');
                if (!code) { btn.style.display = 'none'; return; }
                var link = window.location.origin + '/?ref=' + encodeURIComponent(code);
                document.getElementById('cv-referral-link').value = link;
                window.cvToggleReferralPanel = function () {
                    var panel = document.getElementById('cv-referral-panel');
                    panel.hidden = !panel.hidden;
                };
                window.cvCopyReferralLink = function () {
                    var input = document.getElementById('cv-referral-link');
                    input.select();
                    try { navigator.clipboard.writeText(input.value); } catch (e) {}
                };
            })();
            </script>
            HTML;
    }

    // Powers the "Essayez en direct" widget on the landing page — loads the
    // app's own real analyzer/beautifier (same files used inside /app) and
    // runs them client-side on a canned example, no auth, no server call.
    // String concatenation on purpose, not JS template literals: this file
    // is a PHP heredoc, and PHP interpolates a leading "$" inside "${...}".
    private function demoWidgetMarkup(): string
    {
        return <<<HTML
            <script src="/js/code-analyzer.js"></script>
            <script src="/js/beautifier.js"></script>
            <script>
            (function () {
                var EXAMPLES = {
                    'JS': 'var total = 10\\nif (total == 10) {\\n  console.log("debug leftover")\\n}',
                    'TYPESCRIPT': 'function greet(name: any) {\\n  var msg = "Hello, " + name\\n  console.log(msg)\\n}',
                    'PYTHON': 'import *\\n\\ndef divide(a, b):\\n    print("debug", a, b)\\n    try:\\n        return a / b\\n    except:\\n        return None',
                    'PHP': '<?php\\nfunction getUser(\$id) {\\n    \$result = mysql_query("SELECT * FROM users WHERE id = " . \$id);\\n    if (\$result == null) {\\n        var_dump("no user found");\\n    }\\n    return \$result;\\n}',
                    'JSON': '{\\n  "name": "demo",\\n  "tags": ["a", "b",],\\n}',
                    'CSS': '.card {\\n  color: red\\n  background: #zzz;\\n  font-size: 14px !important;\\n}',
                    'HTML': '<div>\\n  <img src="x.png">\\n  <button onclick="doThing()">Go</button>\\n</div>'
                };
                var LABELS = { 'JS': 'JavaScript', 'TYPESCRIPT': 'TypeScript', 'PYTHON': 'Python', 'PHP': 'PHP', 'JSON': 'JSON', 'CSS': 'CSS', 'HTML': 'HTML' };
                var BEAUTIFY_SUPPORTED = { 'JS': 1, 'TYPESCRIPT': 1, 'JSON': 1, 'CSS': 1 };
                function el(id) { return document.getElementById(id); }
                function lang() { return el('demo-lang').value; }
                function renderFindings(items, cssClass, icon) {
                    return items.map(function (f) {
                        return '<p class="' + cssClass + '">' + icon + ' Ligne ' + f.line + ': ' + f.message + '</p>';
                    }).join('');
                }
                function noCode() {
                    if (el('demo-code').value.trim() !== '') return false;
                    el('demo-result').innerHTML = '<p class="demo-warn">📭 Pas de code à traiter.</p>';
                    return true;
                }
                function hideDetected() {
                    var d = el('demo-lang-detected');
                    d.hidden = true;
                    d.textContent = '';
                }
                function detectLanguage(code) {
                    var trimmed = code.trim();
                    if (!trimmed) return null;

                    if (/<\?php/i.test(trimmed)) return 'PHP';

                    var dollarVars = (trimmed.match(/\\$[a-zA-Z_]\w*/g) || []).length;
                    if (dollarVars >= 2 && !/\b(function\s*\(|const\s|let\s|=>|console\.)/.test(trimmed)) return 'PHP';

                    if (trimmed[0] === '{' || trimmed[0] === '[') {
                        try { JSON.parse(trimmed); return 'JSON'; } catch (e) {}
                        if (/"[^"]+"\s*:/.test(trimmed) && !/\b(function|def )\b/.test(trimmed)) return 'JSON';
                    }

                    var looksLikeJs = /\b(function\s*\w*\s*\(|const\s|let\s|=>)\b/.test(trimmed);
                    if (!looksLikeJs && (/<\/(html|body|div|span|p|ul|li|a|img|button|section|head|form|table)>/i.test(trimmed) ||
                        /^<!DOCTYPE/i.test(trimmed) || /<html[\s>]/i.test(trimmed))) return 'HTML';

                    if (/\bdef\s+\w+\s*\([^)]*\)\s*:/.test(trimmed) ||
                        (/^(import|from)\s+\w+/m.test(trimmed) && !/[{};]/.test(trimmed))) return 'PYTHON';

                    if (/^[.#]?[\w-]+(\s*[,> ]\s*[.#]?[\w-]+)*\s*\{[^}]*:[^};]+;/.test(trimmed) &&
                        !/\b(function|const |let |var |def |=>)\b/.test(trimmed)) return 'CSS';

                    if (/:\s*(any|string|number|boolean)\b/.test(trimmed) ||
                        /\binterface\s+\w+/.test(trimmed) || /\btype\s+\w+\s*=/.test(trimmed)) return 'TYPESCRIPT';

                    return 'JS';
                }
                window.cvDemoLangChanged = function () {
                    var l = lang();
                    if (EXAMPLES[l]) el('demo-code').value = EXAMPLES[l];
                    el('demo-result').innerHTML = '';
                    hideDetected();
                };
                el('demo-code').addEventListener('paste', function () {
                    setTimeout(function () {
                        var detected = detectLanguage(el('demo-code').value);
                        if (detected && detected !== lang()) {
                            el('demo-lang').value = detected;
                            var d = el('demo-lang-detected');
                            d.hidden = false;
                            d.textContent = '🔍 Langage détecté : ' + LABELS[detected];
                        } else {
                            hideDetected();
                        }
                        el('demo-result').innerHTML = '';
                    }, 0);
                });
                window.cvDemoAnalyze = function () {
                    if (noCode()) return;
                    var code = el('demo-code').value;
                    var result = window.CodeAnalyzer.analyze(code, lang());
                    var html = renderFindings(result.errors, 'demo-err', '❌')
                        + renderFindings(result.warnings, 'demo-warn', '⚠️')
                        + renderFindings(result.suggestions, 'demo-sug', '💡');
                    el('demo-result').innerHTML = html || '<p class="demo-ok">✅ Aucun problème détecté !</p>';
                };
                window.cvDemoFix = function () {
                    if (noCode()) return;
                    var code = el('demo-code').value;
                    var result = window.CodeAnalyzer.autoFix(code, lang());
                    el('demo-code').value = result.code;
                    el('demo-result').innerHTML = result.fixes.length
                        ? result.fixes.map(function (f) { return '<p class="demo-ok">✅ ' + f + '</p>'; }).join('')
                        : '<p class="demo-ok">Rien à corriger automatiquement pour ce langage.</p>';
                };
                window.cvDemoFormat = function () {
                    if (noCode()) return;
                    var l = lang();
                    if (!BEAUTIFY_SUPPORTED[l]) {
                        el('demo-result').innerHTML = '<p class="demo-warn">⚠️ Le formatage automatique n\\'est pas encore disponible pour ce langage.</p>';
                        return;
                    }
                    var code = el('demo-code').value;
                    el('demo-code').value = window.CodeBeautifier.beautify(code, l);
                    el('demo-result').innerHTML = '<p class="demo-ok">✨ Code reformaté.</p>';
                };
            })();
            </script>
            HTML;
    }

    private function cookieBannerStyles(): string
    {
        return <<<HTML
            <style>
                .legal-nav {
                    display: flex;
                    justify-content: center;
                    gap: 20px;
                    flex-wrap: wrap;
                    margin-top: 32px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(148, 163, 184, 0.15);
                }
                .legal-nav a { color: #64748b; text-decoration: none; font-size: 0.78rem; cursor: pointer; }
                .legal-nav a:hover { color: #67e8f9; }
                .cv-cookie-banner {
                    position: fixed;
                    left: 16px;
                    right: 16px;
                    bottom: 16px;
                    z-index: 999;
                    max-width: 640px;
                    margin: 0 auto;
                    background: rgba(10, 10, 21, 0.97);
                    border: 1px solid rgba(34, 211, 238, 0.3);
                    border-radius: 14px;
                    padding: 18px 20px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
                }
                .cv-cookie-banner[hidden] { display: none; }
                .cv-cookie-text { color: #cbd5e1; font-size: 0.82rem; line-height: 1.5; margin-bottom: 14px; }
                .cv-cookie-text a { color: #67e8f9; }
                .cv-cookie-actions { display: flex; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
                .cv-cookie-actions button {
                    padding: 9px 16px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: 1px solid rgba(34, 211, 238, 0.3);
                    background: transparent;
                    color: #a5f3fc;
                }
                .cv-cookie-actions button:last-child {
                    background: linear-gradient(90deg, #0891b2, #2563eb);
                    color: #fff;
                    border: none;
                }
                .cv-cookie-actions button:hover { filter: brightness(1.15); }
                .cv-cookie-panel { margin-top: 14px; border-top: 1px solid rgba(148, 163, 184, 0.15); padding-top: 14px; }
                .cv-cookie-panel[hidden] { display: none; }
                .cv-cookie-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 14px; margin-bottom: 12px; }
                .cv-cookie-row strong { color: #e2e8f0; font-size: 0.82rem; }
                .cv-cookie-row p { color: #64748b; font-size: 0.75rem; margin: 4px 0 0; }
                .cv-cookie-row input { margin-top: 3px; }
            </style>
            HTML;
    }

    private function cookieBannerMarkup(): string
    {
        return <<<HTML
            <div id="cv-cookie-banner" class="cv-cookie-banner" hidden>
                <div class="cv-cookie-text">
                    🍪 CodeVaultAI utilise uniquement un cookie de session strictement nécessaire pour sécuriser votre connexion. Aucun cookie de mesure d'audience ni de publicité n'est utilisé. Pour en savoir plus, consultez notre <a href="/politique-de-confidentialite#cookies">politique de confidentialité</a>.
                </div>
                <div id="cv-cookie-panel" class="cv-cookie-panel" hidden>
                    <div class="cv-cookie-row">
                        <div>
                            <strong>Cookies strictement nécessaires</strong>
                            <p>Cookie de session (PHPSESSID) : sécurise votre connexion. Toujours actif, ne peut pas être désactivé.</p>
                        </div>
                        <input type="checkbox" checked disabled>
                    </div>
                    <div class="cv-cookie-row">
                        <div>
                            <strong>Mesure d'audience &amp; publicité</strong>
                            <p>Non utilisés sur ce site à ce jour.</p>
                        </div>
                        <input type="checkbox" disabled>
                    </div>
                </div>
                <div class="cv-cookie-actions">
                    <button type="button" onclick="cvCookieChoice('customize')">Personnaliser</button>
                    <button type="button" onclick="cvCookieChoice('rejected')">Refuser tout</button>
                    <button type="button" onclick="cvCookieChoice('accepted')">Tout accepter</button>
                </div>
            </div>
            <script>
            (function () {
                var KEY = 'cv_cookie_consent';
                var banner = document.getElementById('cv-cookie-banner');
                var panel = document.getElementById('cv-cookie-panel');
                window.cvCookieChoice = function (choice) {
                    if (choice === 'customize') { panel.hidden = !panel.hidden; return; }
                    try { localStorage.setItem(KEY, JSON.stringify({ choice: choice, ts: Date.now() })); } catch (e) {}
                    banner.hidden = true;
                };
                window.cvOpenCookiePrefs = function () {
                    banner.hidden = false;
                    panel.hidden = false;
                };
                try {
                    if (!localStorage.getItem(KEY)) { banner.hidden = false; }
                } catch (e) { banner.hidden = false; }
            })();
            </script>
            HTML;
    }

    // Self-service read-only trial: no email, no owner approval, no DB row
    // at all — just a session flag with a hard 60s expiry. Deliberately
    // separate from the real access gate (requestAccess() below), which
    // stays untouched. Rate-limited per IP since there's nothing else
    // standing between a visitor and a real (if tiny and read-only) session.
    #[Route('/trial', name: 'app_codevault_trial', host: 'riad-design.cloud', methods: ['POST'], priority: 10)]
    #[Route('/trial', name: 'app_codevault_trial_www', host: 'www.riad-design.cloud', methods: ['POST'], priority: 10)]
    public function requestTrial(Request $request): Response
    {
        $submittedCsrfToken = (string) $request->request->get('csrf_token', '');
        $sessionCsrfToken = (string) $request->getSession()->get(self::CSRF_SESSION_KEY, '');
        if ($sessionCsrfToken === '' || !hash_equals($sessionCsrfToken, $submittedCsrfToken)) {
            return $this->redirect('/?error=invalid_request');
        }

        if (!$this->trialIpLimiter->create($request->getClientIp() ?? 'unknown')->consume(1)->isAccepted()) {
            return $this->redirect('/?error=rate_limited');
        }

        $session = $request->getSession();
        $session->set(self::SESSION_KEY, true);
        $session->set(self::ROLE_SESSION_KEY, 'trial');
        $session->set(self::TRIAL_EXPIRES_SESSION_KEY, time() + self::TRIAL_DURATION_SECONDS);
        // No ACCESS_ID_SESSION_KEY — there's no CodevaultAccessToken row for
        // a trial, and app()'s revocation check already treats a missing id
        // as "nothing to check" rather than an error.

        return $this->redirect('/app');
    }

    #[Route('/access/request', name: 'app_codevault_access_request', host: 'riad-design.cloud', methods: ['POST'], priority: 10)]
    #[Route('/access/request', name: 'app_codevault_access_request_www', host: 'www.riad-design.cloud', methods: ['POST'], priority: 10)]
    public function requestAccess(Request $request): Response
    {
        $submittedCsrfToken = (string) $request->request->get('csrf_token', '');
        $sessionCsrfToken = (string) $request->getSession()->get(self::CSRF_SESSION_KEY, '');
        if ($sessionCsrfToken === '' || !hash_equals($sessionCsrfToken, $submittedCsrfToken)) {
            return $this->redirect('/?error=invalid_request');
        }

        $email = trim((string) $request->request->get('email', ''));

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return $this->redirect('/?error=invalid_email');
        }

        if (!$this->ipLimiter->create($request->getClientIp())->consume(1)->isAccepted()) {
            return $this->redirect('/?error=rate_limited');
        }

        if (!$this->emailLimiter->create(strtolower($email))->consume(1)->isAccepted()) {
            return $this->redirect('/?error=rate_limited');
        }

        $token = bin2hex(random_bytes(32));
        $approvalToken = bin2hex(random_bytes(32));
        $referralCode = bin2hex(random_bytes(8));
        $accessToken = new CodevaultAccessToken($email, $token, $approvalToken, $referralCode);

        // Optional: this signup came in via someone else's referral link
        // (?ref=... on the landing page, carried through as a hidden field).
        // Silently ignored if it doesn't match a real code — never blocks
        // the request over it.
        $referredBy = trim((string) $request->request->get('ref', ''));
        if ($referredBy !== '' && $this->tokens->findByReferralCode($referredBy) !== null) {
            $accessToken->setReferredByCode($referredBy);
        }

        $approveUrl = $request->getSchemeAndHttpHost() . '/access/approve/' . $approvalToken;

        $mail = (new Email())
            ->from(self::FROM_EMAIL)
            ->to(self::ADMIN_EMAIL)
            ->subject('Nouvelle demande d\'accès CodeVaultAI')
            ->html(
                '<p>Bonjour,</p>' .
                '<p><strong>' . htmlspecialchars($email) . '</strong> demande l\'accès à CodeVaultAI.</p>' .
                '<p><a href="' . htmlspecialchars($approveUrl) . '">Approuver cette demande</a></p>' .
                '<p>Le lien de connexion ne sera envoyé au demandeur qu\'après votre approbation.</p>'
            );

        // Persist before sending: if the mail send fails, nothing usable was
        // handed out. Sending first risked the opposite — a real link landing
        // in someone's inbox for a token that a later DB failure never saved,
        // permanently dead on click.
        $this->em->persist($accessToken);
        $this->em->flush();

        try {
            $this->mailer->send($mail);
        } catch (\Throwable) {
            $this->em->remove($accessToken);
            $this->em->flush();

            return $this->redirect('/?error=send_failed');
        }

        return $this->redirect('/?sent=1');
    }

    // GET only checks and *shows* the link — it never consumes the token.
    // That's deliberate: email security scanners (Microsoft Safe Links and
    // similar) pre-fetch links found in emails to scan them, which would
    // silently burn a single-use token before the real recipient ever clicks
    // it. Consumption only happens on confirmAccess() below, behind an
    // explicit button click (a real POST from a human, not a bot's GET).
    #[Route('/access/verify/{token}', name: 'app_codevault_access_verify', host: 'riad-design.cloud', methods: ['GET'], requirements: ['token' => '[a-f0-9]{64}'], priority: 10)]
    #[Route('/access/verify/{token}', name: 'app_codevault_access_verify_www', host: 'www.riad-design.cloud', methods: ['GET'], requirements: ['token' => '[a-f0-9]{64}'], priority: 10)]
    public function verifyAccess(string $token, Request $request): Response
    {
        $checkError = $this->checkAccessToken($token);
        if ($checkError !== null) {
            return $this->redirect('/?error=' . $checkError);
        }

        $csrfToken = $this->getOrCreateCsrfToken($request);

        $response = new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Confirmer la connexion — CodeVaultAI</title>
                <meta name="robots" content="noindex, nofollow">
                <link rel="icon" href="/assets/icon.png">
                <style>
                    :root { color-scheme: dark; }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        min-height: 100vh;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: radial-gradient(ellipse at top, #1e293b 0%, #0a0a15 55%, #050510 100%);
                        color: #a5f3fc;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .card {
                        width: 100%;
                        max-width: 420px;
                        background: rgba(15, 23, 42, 0.75);
                        border: 1px solid rgba(34, 211, 238, 0.25);
                        border-radius: 16px;
                        padding: 32px;
                        text-align: center;
                    }
                    .icon { font-size: 2rem; margin-bottom: 8px; }
                    h1 { color: #fff; font-size: 1.3rem; margin: 0 0 8px; }
                    p { color: #94a3b8; font-size: 0.9rem; margin: 0 0 24px; line-height: 1.5; }
                    button {
                        width: 100%;
                        background: linear-gradient(90deg, #0891b2, #2563eb);
                        color: #fff;
                        border: none;
                        padding: 14px 24px;
                        border-radius: 8px;
                        font-weight: 700;
                        cursor: pointer;
                        font-size: 0.95rem;
                    }
                    button:hover { filter: brightness(1.1); }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">🔐</div>
                    <h1>Confirmer la connexion</h1>
                    <p>Cliquez ci-dessous pour accéder à CodeVaultAI. Ce lien reste valable jusqu'à votre confirmation ou son expiration.</p>
                    <form method="post" action="/access/verify/{$token}">
                        <input type="hidden" name="csrf_token" value="{$csrfToken}">
                        <button type="submit">Confirmer la connexion</button>
                    </form>
                </div>
            </body>
            </html>
            HTML);

        $this->setHardeningHeaders($response);

        return $response;
    }

    #[Route('/access/verify/{token}', name: 'app_codevault_access_confirm', host: 'riad-design.cloud', methods: ['POST'], requirements: ['token' => '[a-f0-9]{64}'], priority: 10)]
    #[Route('/access/verify/{token}', name: 'app_codevault_access_confirm_www', host: 'www.riad-design.cloud', methods: ['POST'], requirements: ['token' => '[a-f0-9]{64}'], priority: 10)]
    public function confirmAccess(string $token, Request $request): Response
    {
        $submittedCsrfToken = (string) $request->request->get('csrf_token', '');
        $sessionCsrfToken = (string) $request->getSession()->get(self::CSRF_SESSION_KEY, '');
        if ($sessionCsrfToken === '' || !hash_equals($sessionCsrfToken, $submittedCsrfToken)) {
            return $this->redirect('/?error=invalid_request');
        }

        $checkError = $this->checkAccessToken($token);
        if ($checkError !== null) {
            return $this->redirect('/?error=' . $checkError);
        }

        $accessToken = $this->tokens->findByToken($token);
        $accessToken->markUsed();
        $this->em->flush();

        $role = strcasecmp($accessToken->getEmail(), self::ADMIN_EMAIL) === 0 ? 'admin' : 'user';

        $session = $request->getSession();
        $session->set(self::SESSION_KEY, true);
        $session->set(self::ROLE_SESSION_KEY, $role);
        $session->set(self::ACCESS_ID_SESSION_KEY, $accessToken->getId());

        return $this->redirect('/app');
    }

    // Same GET-shows/POST-consumes split as verifyAccess()/confirmAccess(),
    // for the same reason (an email client or scanner pre-fetching this link
    // in the owner's own inbox shouldn't be able to silently approve a
    // request the owner never actually looked at).
    #[Route('/access/approve/{approvalToken}', name: 'app_codevault_access_approve', host: 'riad-design.cloud', methods: ['GET'], requirements: ['approvalToken' => '[a-f0-9]{64}'], priority: 10)]
    #[Route('/access/approve/{approvalToken}', name: 'app_codevault_access_approve_www', host: 'www.riad-design.cloud', methods: ['GET'], requirements: ['approvalToken' => '[a-f0-9]{64}'], priority: 10)]
    public function approveAccess(string $approvalToken, Request $request): Response
    {
        $accessToken = $this->tokens->findByApprovalToken($approvalToken);
        $message = $this->checkApprovalToken($accessToken);

        if ($message !== null) {
            return $this->renderAdminMessage($message);
        }

        $csrfToken = $this->getOrCreateCsrfToken($request);
        $email = htmlspecialchars($accessToken->getEmail());

        $response = new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Approuver la demande — CodeVaultAI</title>
                <meta name="robots" content="noindex, nofollow">
                <link rel="icon" href="/assets/icon.png">
                <style>
                    :root { color-scheme: dark; }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        min-height: 100vh;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: radial-gradient(ellipse at top, #1e293b 0%, #0a0a15 55%, #050510 100%);
                        color: #a5f3fc;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                    }
                    .card {
                        width: 100%;
                        max-width: 420px;
                        background: rgba(15, 23, 42, 0.75);
                        border: 1px solid rgba(34, 211, 238, 0.25);
                        border-radius: 16px;
                        padding: 32px;
                        text-align: center;
                    }
                    .icon { font-size: 2rem; margin-bottom: 8px; }
                    h1 { color: #fff; font-size: 1.3rem; margin: 0 0 8px; }
                    p { color: #94a3b8; font-size: 0.9rem; margin: 0 0 24px; line-height: 1.5; }
                    strong { color: #fff; }
                    button {
                        width: 100%;
                        background: linear-gradient(90deg, #0891b2, #2563eb);
                        color: #fff;
                        border: none;
                        padding: 14px 24px;
                        border-radius: 8px;
                        font-weight: 700;
                        cursor: pointer;
                        font-size: 0.95rem;
                    }
                    button:hover { filter: brightness(1.1); }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="icon">🔔</div>
                    <h1>Nouvelle demande d'accès</h1>
                    <p><strong>{$email}</strong> demande à accéder à CodeVaultAI.</p>
                    <form method="post" action="/access/approve/{$approvalToken}">
                        <input type="hidden" name="csrf_token" value="{$csrfToken}">
                        <button type="submit">Approuver et envoyer le lien</button>
                    </form>
                </div>
            </body>
            </html>
            HTML);

        $this->setHardeningHeaders($response);

        return $response;
    }

    #[Route('/access/approve/{approvalToken}', name: 'app_codevault_access_approve_confirm', host: 'riad-design.cloud', methods: ['POST'], requirements: ['approvalToken' => '[a-f0-9]{64}'], priority: 10)]
    #[Route('/access/approve/{approvalToken}', name: 'app_codevault_access_approve_confirm_www', host: 'www.riad-design.cloud', methods: ['POST'], requirements: ['approvalToken' => '[a-f0-9]{64}'], priority: 10)]
    public function confirmApproveAccess(string $approvalToken, Request $request): Response
    {
        $submittedCsrfToken = (string) $request->request->get('csrf_token', '');
        $sessionCsrfToken = (string) $request->getSession()->get(self::CSRF_SESSION_KEY, '');
        if ($sessionCsrfToken === '' || !hash_equals($sessionCsrfToken, $submittedCsrfToken)) {
            return $this->renderAdminMessage('Requête invalide, merci de réessayer depuis le lien reçu par email.');
        }

        $accessToken = $this->tokens->findByApprovalToken($approvalToken);
        $message = $this->checkApprovalToken($accessToken);

        if ($message !== null) {
            return $this->renderAdminMessage($message);
        }

        $sent = $this->approveAndNotify($accessToken, $request);

        if (!$sent) {
            return $this->renderAdminMessage(
                'La demande a été approuvée mais l\'envoi du lien à ' . htmlspecialchars($accessToken->getEmail()) . ' a échoué. Réessayez en rouvrant ce même lien.',
            );
        }

        return $this->renderAdminMessage('✅ Demande approuvée. Un lien de connexion a été envoyé à ' . htmlspecialchars($accessToken->getEmail()) . '.');
    }

    // Shared by the email "Approuver cette demande" link (confirmApproveAccess
    // above) and the /admin dashboard's approve action — both need to mark a
    // request approved and get the visitor their magic link the same way.
    private function approveAndNotify(CodevaultAccessToken $accessToken, Request $request): bool
    {
        $expiresAt = new \DateTimeImmutable('+' . self::MAGIC_LINK_TTL_MINUTES . ' minutes');
        $accessToken->approve($expiresAt);
        $this->em->flush();

        $verifyUrl = $request->getSchemeAndHttpHost() . '/access/verify/' . $accessToken->getToken();

        $mail = (new Email())
            ->from(self::FROM_EMAIL)
            ->to($accessToken->getEmail())
            ->subject('Votre lien de connexion CodeVaultAI')
            ->html(
                '<p>Bonjour,</p>' .
                '<p>Votre demande d\'accès à CodeVaultAI a été approuvée. Cliquez sur le lien ci-dessous pour vous connecter. Ce lien est valable ' . self::MAGIC_LINK_TTL_MINUTES . ' minutes et ne peut être utilisé qu\'une seule fois.</p>' .
                '<p><a href="' . htmlspecialchars($verifyUrl) . '">' . htmlspecialchars($verifyUrl) . '</a></p>' .
                '<p>Si vous n\'êtes pas à l\'origine de cette demande, ignorez simplement cet email.</p>'
            );

        try {
            $this->mailer->send($mail);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    private function checkApprovalToken(?CodevaultAccessToken $accessToken): ?string
    {
        if ($accessToken === null) {
            return 'Ce lien d\'approbation n\'est pas valide.';
        }

        if ($accessToken->isUsed()) {
            return 'Cette demande a déjà été utilisée par le demandeur, il n\'y a rien à faire.';
        }

        if ($accessToken->isRejected()) {
            return 'Cette demande a été rejetée.';
        }

        return null;
    }

    private function renderAdminMessage(string $message): Response
    {
        $response = new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CodeVaultAI</title>
                <meta name="robots" content="noindex, nofollow">
                <link rel="icon" href="/assets/icon.png">
                <style>
                    :root { color-scheme: dark; }
                    body {
                        margin: 0;
                        min-height: 100vh;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: radial-gradient(ellipse at top, #1e293b 0%, #0a0a15 55%, #050510 100%);
                        color: #e2e8f0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 20px;
                        text-align: center;
                    }
                    p { max-width: 420px; font-size: 0.95rem; line-height: 1.6; }
                </style>
            </head>
            <body>
                <p>{$message}</p>
            </body>
            </html>
            HTML);

        $this->setHardeningHeaders($response);

        return $response;
    }

    private function checkAccessToken(string $token): ?string
    {
        $accessToken = $this->tokens->findByToken($token);

        if ($accessToken === null) {
            return 'invalid_token';
        }

        if ($accessToken->isUsed()) {
            return 'used_token';
        }

        if ($accessToken->isRevoked()) {
            return 'revoked';
        }

        if ($accessToken->isExpired()) {
            return 'expired_token';
        }

        return null;
    }

    private function getOrCreateCsrfToken(Request $request): string
    {
        $session = $request->getSession();
        $csrfToken = $session->get(self::CSRF_SESSION_KEY);
        if (!is_string($csrfToken)) {
            $csrfToken = bin2hex(random_bytes(32));
            $session->set(self::CSRF_SESSION_KEY, $csrfToken);
        }

        return $csrfToken;
    }

    // Clears the server-side session, not just client-side React state — the
    // old LOGOUT button only reset in-memory state, so the still-valid
    // session cookie silently let the visitor straight back into /app on
    // their next visit/reload without ever going back through the email gate.
    #[Route('/logout', name: 'app_codevault_logout', host: 'riad-design.cloud', methods: ['POST'], priority: 10)]
    #[Route('/logout', name: 'app_codevault_logout_www', host: 'www.riad-design.cloud', methods: ['POST'], priority: 10)]
    public function logout(Request $request): Response
    {
        $request->getSession()->invalidate();

        return $this->redirect('/');
    }

    #[Route('/app', name: 'app_codevault_app', host: 'riad-design.cloud', priority: 10)]
    #[Route('/app', name: 'app_codevault_app_www', host: 'www.riad-design.cloud', priority: 10)]
    public function app(Request $request): Response
    {
        $session = $request->getSession();
        if ($session->get(self::SESSION_KEY) !== true) {
            return $this->redirect('/');
        }

        $role = $session->get(self::ROLE_SESSION_KEY);
        $role = in_array($role, ['admin', 'user', 'trial'], true) ? $role : 'user';

        $trialExpiresAt = null;
        if ($role === 'trial') {
            $trialExpiresAt = (int) $session->get(self::TRIAL_EXPIRES_SESSION_KEY, 0);
            if ($trialExpiresAt <= time()) {
                $session->clear();

                return $this->redirect('/?error=trial_expired');
            }
        }

        $accessId = $session->get(self::ACCESS_ID_SESSION_KEY);
        $accessToken = is_int($accessId) ? $this->tokens->find($accessId) : null;
        if ($accessToken !== null && $accessToken->isRevoked()) {
            $session->clear();

            return $this->redirect('/?error=revoked');
        }

        $csrfToken = $this->getOrCreateCsrfToken($request);
        $anthropicConfigured = !empty($_ENV['ANTHROPIC_API_KEY'] ?? getenv('ANTHROPIC_API_KEY'));
        $referralCode = $accessToken?->getReferralCode();

        $response = $this->serveFile('index.html');
        $html = $response->getContent();
        $bootScript = '<script>'
            . 'window.CODEVAULT_ROLE = ' . json_encode($role) . ';'
            . 'window.CODEVAULT_CSRF = ' . json_encode($csrfToken) . ';'
            . 'window.CODEVAULT_AI_FALLBACK = ' . json_encode($anthropicConfigured) . ';'
            . 'window.CODEVAULT_REFERRAL_CODE = ' . json_encode($referralCode) . ';'
            . 'window.CODEVAULT_TRIAL_EXPIRES_AT = ' . json_encode($trialExpiresAt !== null ? $trialExpiresAt * 1000 : null) . ';'
            . '</script>';
        $html = str_replace('<script src="./js/web-api.js"></script>', $bootScript . "\n  " . '<script src="./js/web-api.js"></script>', $html);
        $extraWidgets = $this->referralWidgetMarkup() . ($role === 'trial' ? "\n  " . $this->trialWidgetMarkup() : '');
        $html = str_replace('<!-- App est chargé et rendu depuis js/main.js -->', $extraWidgets . "\n  " . '<!-- App est chargé et rendu depuis js/main.js -->', $html);
        $response->setContent($html);

        $this->setHardeningHeaders($response);
        // This HTML embeds this session's own CSRF token and role — a shared
        // or intermediary cache serving it to a different visitor would leak
        // both. Previously inherited serveFile()'s public 1h cache by mistake.
        $response->headers->set('Cache-Control', 'private, no-store');

        return $response;
    }

    // Cloud fallback for the in-app AI assistant (js/ai-assistant.js) — only
    // called client-side when the visitor's browser found no local AI server
    // (Ollama, LM Studio...). Gated behind the same session flag as /app
    // (never reachable pre-login) plus the session CSRF token, and rate
    // limited per IP since every call here spends real Anthropic API credit.
    #[Route('/ai/anthropic', name: 'app_codevault_ai_anthropic', host: 'riad-design.cloud', methods: ['POST'], priority: 10)]
    #[Route('/ai/anthropic', name: 'app_codevault_ai_anthropic_www', host: 'www.riad-design.cloud', methods: ['POST'], priority: 10)]
    public function anthropicProxy(Request $request): Response
    {
        $session = $request->getSession();
        if ($session->get(self::SESSION_KEY) !== true) {
            return $this->jsonResponse(['error' => 'unauthorized'], 403);
        }

        $sessionCsrfToken = (string) $session->get(self::CSRF_SESSION_KEY, '');
        $providedCsrfToken = (string) $request->headers->get('X-CSRF-Token', '');
        if ($sessionCsrfToken === '' || $providedCsrfToken === '' || !hash_equals($sessionCsrfToken, $providedCsrfToken)) {
            return $this->jsonResponse(['error' => 'invalid_csrf'], 403);
        }

        $limit = $this->anthropicIpLimiter->create($request->getClientIp() ?? 'unknown')->consume(1);
        if (!$limit->isAccepted()) {
            return $this->jsonResponse(['error' => 'rate_limited'], 429);
        }

        $apiKey = $_ENV['ANTHROPIC_API_KEY'] ?? getenv('ANTHROPIC_API_KEY');
        if (empty($apiKey)) {
            return $this->jsonResponse(['error' => 'not_configured'], 503);
        }

        $payload = json_decode($request->getContent(), true);
        $prompt = is_array($payload) && isset($payload['prompt']) ? trim((string) $payload['prompt']) : '';
        if ($prompt === '') {
            return $this->jsonResponse(['error' => 'invalid_request'], 400);
        }
        if (mb_strlen($prompt) > self::ANTHROPIC_MAX_PROMPT_CHARS) {
            $prompt = mb_substr($prompt, 0, self::ANTHROPIC_MAX_PROMPT_CHARS);
        }

        try {
            $client = new AnthropicClient(apiKey: $apiKey);
            $message = $client->messages->create(
                model: self::ANTHROPIC_MODEL,
                maxTokens: self::ANTHROPIC_MAX_TOKENS,
                system: self::ANTHROPIC_SYSTEM_PROMPT,
                messages: [
                    ['role' => 'user', 'content' => $prompt],
                ],
            );

            $reply = '';
            foreach ($message->content as $block) {
                if ($block->type === 'text') {
                    $reply = $block->text;
                    break;
                }
            }

            return $this->jsonResponse(['reply' => $reply]);
        } catch (\Throwable $e) {
            return $this->jsonResponse(['error' => 'upstream_error'], 502);
        }
    }

    private function jsonResponse(array $data, int $status = 200): Response
    {
        return new Response(json_encode($data), $status, ['Content-Type' => 'application/json']);
    }

    // "index.html" only comes through app() above, which is session-gated and
    // injects the visitor's server-resolved role. Serving it here too would
    // let anyone reach the app directly, skipping both the access gate and
    // the role injection main.js now relies on to know who it's talking to.
    #[Route('/{path}', name: 'app_codevault_static', host: 'riad-design.cloud', requirements: ['path' => '.+'], priority: 5)]
    #[Route('/{path}', name: 'app_codevault_static_www', host: 'www.riad-design.cloud', requirements: ['path' => '.+'], priority: 5)]
    public function asset(string $path, Request $request): Response
    {
        if ($path === 'index.html') {
            throw $this->createNotFoundException();
        }

        $response = $this->serveFile($path);
        // "no-cache" despite the name still lets the browser store the file —
        // it just always revalidates with the server first via Last-Modified
        // above, coming back as a cheap 304 when unchanged. That way a fresh
        // deploy of main.js/style.css is picked up on the very next load
        // instead of sitting behind the old blind 1h cache.
        $response->headers->set('Cache-Control', 'public, no-cache');
        $response->isNotModified($request);

        return $response;
    }

    // Admin-only activity dashboard: every access request ever made, its
    // current status, and actions to approve/reject/revoke it — an
    // alternative to acting from the approval email, and the only way to
    // revoke someone who already has a live session.
    #[Route('/admin', name: 'app_codevault_admin', host: 'riad-design.cloud', methods: ['GET'], priority: 10)]
    #[Route('/admin', name: 'app_codevault_admin_www', host: 'www.riad-design.cloud', methods: ['GET'], priority: 10)]
    public function adminDashboard(Request $request): Response
    {
        $denied = $this->requireAdminSession($request);
        if ($denied !== null) {
            return $denied;
        }

        $csrfToken = $this->getOrCreateCsrfToken($request);

        $statusLabels = [
            'pending' => ['En attente', 'status-pending'],
            'approved' => ['Approuvée, en attente de connexion', 'status-approved'],
            'used' => ['Connecté', 'status-used'],
            'expired' => ['Expirée', 'status-expired'],
            'rejected' => ['Rejetée', 'status-rejected'],
            'revoked' => ['Révoqué', 'status-revoked'],
        ];

        $rows = '';
        foreach ($this->tokens->findAllNewestFirst() as $accessToken) {
            $status = $accessToken->getStatus();
            [$label, $class] = $statusLabels[$status];
            $email = htmlspecialchars($accessToken->getEmail());
            $role = strcasecmp($accessToken->getEmail(), self::ADMIN_EMAIL) === 0 ? 'admin' : 'user';
            $id = $accessToken->getId();
            $requestedAt = $accessToken->getCreatedAt()->format('d/m/Y H:i');
            $approvedAt = $accessToken->getApprovedAt()?->format('d/m/Y H:i') ?? '—';
            $usedAt = $accessToken->getUsedAt()?->format('d/m/Y H:i') ?? '—';

            $actions = '';
            if ($status === 'pending') {
                $actions = <<<HTML
                    <form method="post" action="/admin/approve/{$id}" class="inline-form">
                        <input type="hidden" name="csrf_token" value="{$csrfToken}">
                        <button type="submit" class="btn-ok">Approuver</button>
                    </form>
                    <form method="post" action="/admin/reject/{$id}" class="inline-form">
                        <input type="hidden" name="csrf_token" value="{$csrfToken}">
                        <button type="submit" class="btn-danger">Rejeter</button>
                    </form>
                    HTML;
            } elseif ($status === 'approved' || $status === 'used') {
                $actions = <<<HTML
                    <form method="post" action="/admin/revoke/{$id}" class="inline-form">
                        <input type="hidden" name="csrf_token" value="{$csrfToken}">
                        <button type="submit" class="btn-danger">Révoquer</button>
                    </form>
                    HTML;
            }

            $rows .= <<<HTML
                <tr>
                    <td>{$email}<span class="role-tag">{$role}</span></td>
                    <td><span class="status {$class}">{$label}</span></td>
                    <td>{$requestedAt}</td>
                    <td>{$approvedAt}</td>
                    <td>{$usedAt}</td>
                    <td class="actions">{$actions}</td>
                </tr>
                HTML;
        }

        if ($rows === '') {
            $rows = '<tr><td colspan="6" class="empty">Aucune demande pour le moment.</td></tr>';
        }

        $response = new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Suivi d'activité — CodeVaultAI</title>
                <meta name="robots" content="noindex, nofollow">
                <link rel="icon" href="/assets/icon.png">
                <style>
                    :root { color-scheme: dark; }
                    * { box-sizing: border-box; }
                    body {
                        margin: 0;
                        min-height: 100vh;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        background: radial-gradient(ellipse at top, #1e293b 0%, #0a0a15 55%, #050510 100%);
                        color: #e2e8f0;
                        padding: 32px 20px 80px;
                    }
                    .wrap { max-width: 1100px; margin: 0 auto; }
                    h1 { color: #fff; font-size: 1.6rem; margin: 0 0 4px; }
                    .subtitle { color: #94a3b8; font-size: 0.85rem; margin: 0 0 24px; }
                    a.back { color: #67e8f9; text-decoration: none; font-size: 0.85rem; }
                    .topbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
                    .logout-form button {
                        background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35);
                        border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; font-weight: 700; cursor: pointer;
                    }
                    .logout-form button:hover { filter: brightness(1.15); }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(34, 211, 238, 0.15); border-radius: 12px; overflow: hidden; }
                    th, td { padding: 12px 14px; text-align: left; font-size: 0.85rem; border-bottom: 1px solid rgba(148, 163, 184, 0.1); }
                    th { color: #67e8f9; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; }
                    td { color: #cbd5e1; }
                    tr:last-child td { border-bottom: none; }
                    .role-tag { display: inline-block; margin-left: 8px; font-size: 0.65rem; text-transform: uppercase; color: #64748b; border: 1px solid #334155; border-radius: 4px; padding: 1px 6px; }
                    .status { padding: 3px 10px; border-radius: 999px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }
                    .status-pending { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
                    .status-approved { background: rgba(6, 182, 212, 0.15); color: #67e8f9; }
                    .status-used { background: rgba(34, 197, 94, 0.15); color: #86efac; }
                    .status-expired { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }
                    .status-rejected, .status-revoked { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
                    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
                    .inline-form { display: inline; }
                    .btn-ok, .btn-danger {
                        border: none; border-radius: 6px; padding: 6px 12px; font-size: 0.75rem; font-weight: 700; cursor: pointer;
                    }
                    .btn-ok { background: linear-gradient(90deg, #0891b2, #2563eb); color: #fff; }
                    .btn-danger { background: rgba(239, 68, 68, 0.15); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35); }
                    .btn-ok:hover, .btn-danger:hover { filter: brightness(1.15); }
                    .empty { text-align: center; color: #64748b; padding: 32px; }
                </style>
            </head>
            <body>
                <div class="wrap">
                    <div class="topbar">
                        <a class="back" href="/app">← Retour à l'app</a>
                        <form method="post" action="/logout" class="logout-form">
                            <input type="hidden" name="csrf_token" value="{$csrfToken}">
                            <button type="submit">🔓 Déconnexion</button>
                        </form>
                    </div>
                    <h1>Suivi d'activité</h1>
                    <p class="subtitle">Toutes les demandes d'accès à CodeVaultAI, du plus récent au plus ancien.</p>
                    <table>
                        <thead>
                            <tr>
                                <th>Email</th>
                                <th>Statut</th>
                                <th>Demandée le</th>
                                <th>Approuvée le</th>
                                <th>Connectée le</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {$rows}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
            HTML);

        $this->setHardeningHeaders($response);

        return $response;
    }

    #[Route('/admin/approve/{id}', name: 'app_codevault_admin_approve', host: 'riad-design.cloud', methods: ['POST'], requirements: ['id' => '\d+'], priority: 10)]
    #[Route('/admin/approve/{id}', name: 'app_codevault_admin_approve_www', host: 'www.riad-design.cloud', methods: ['POST'], requirements: ['id' => '\d+'], priority: 10)]
    public function adminApprove(int $id, Request $request): Response
    {
        $denied = $this->requireAdminSession($request);
        if ($denied !== null) {
            return $denied;
        }

        if (!$this->checkAdminCsrf($request)) {
            return $this->redirect('/admin');
        }

        $accessToken = $this->tokens->find($id);
        if ($accessToken !== null && $accessToken->getStatus() === 'pending') {
            $this->approveAndNotify($accessToken, $request);
        }

        return $this->redirect('/admin');
    }

    #[Route('/admin/reject/{id}', name: 'app_codevault_admin_reject', host: 'riad-design.cloud', methods: ['POST'], requirements: ['id' => '\d+'], priority: 10)]
    #[Route('/admin/reject/{id}', name: 'app_codevault_admin_reject_www', host: 'www.riad-design.cloud', methods: ['POST'], requirements: ['id' => '\d+'], priority: 10)]
    public function adminReject(int $id, Request $request): Response
    {
        $denied = $this->requireAdminSession($request);
        if ($denied !== null) {
            return $denied;
        }

        if (!$this->checkAdminCsrf($request)) {
            return $this->redirect('/admin');
        }

        $accessToken = $this->tokens->find($id);
        if ($accessToken !== null && $accessToken->getStatus() === 'pending') {
            $accessToken->reject();
            $this->em->flush();
        }

        return $this->redirect('/admin');
    }

    #[Route('/admin/revoke/{id}', name: 'app_codevault_admin_revoke', host: 'riad-design.cloud', methods: ['POST'], requirements: ['id' => '\d+'], priority: 10)]
    #[Route('/admin/revoke/{id}', name: 'app_codevault_admin_revoke_www', host: 'www.riad-design.cloud', methods: ['POST'], requirements: ['id' => '\d+'], priority: 10)]
    public function adminRevoke(int $id, Request $request): Response
    {
        $denied = $this->requireAdminSession($request);
        if ($denied !== null) {
            return $denied;
        }

        if (!$this->checkAdminCsrf($request)) {
            return $this->redirect('/admin');
        }

        $accessToken = $this->tokens->find($id);
        $status = $accessToken?->getStatus();
        if ($accessToken !== null && ($status === 'approved' || $status === 'used')) {
            $accessToken->revoke();
            $this->em->flush();
        }

        return $this->redirect('/admin');
    }

    private function requireAdminSession(Request $request): ?Response
    {
        $session = $request->getSession();
        if ($session->get(self::SESSION_KEY) !== true || $session->get(self::ROLE_SESSION_KEY) !== 'admin') {
            return $this->redirect('/');
        }

        return null;
    }

    private function checkAdminCsrf(Request $request): bool
    {
        $submittedCsrfToken = (string) $request->request->get('csrf_token', '');
        $sessionCsrfToken = (string) $request->getSession()->get(self::CSRF_SESSION_KEY, '');

        return $sessionCsrfToken !== '' && hash_equals($sessionCsrfToken, $submittedCsrfToken);
    }

    // Builds the same animated neon-letter markup the React app (js/main.js)
    // uses for its own logo, but as static HTML+CSS for this PHP-rendered
    // landing page — no JS framework here, so the stagger delays are computed
    // server-side instead of by a React effect.
    private function hologramLogoMarkup(string $text): string
    {
        $letters = mb_str_split($text);
        $step = 0.3;
        $introDuration = 1.6;
        $cycleDelay = (count($letters) - 1) * $step + $introDuration + 1.5;

        $spans = '';
        foreach ($letters as $i => $letter) {
            $d = round($i * $step, 2);
            $ld = round($i * $step + $introDuration, 2);
            $safeLetter = htmlspecialchars($letter, ENT_QUOTES);
            $spans .= "<span class=\"hologram-letter\" style=\"--d: {$d}s; --ld: {$ld}s;\">{$safeLetter}</span>";
        }

        $cycleDelayRounded = round($cycleDelay, 2);

        return "<span class=\"hologram-logo\" id=\"cv-hologram-logo\" aria-label=\"" . htmlspecialchars($text, ENT_QUOTES) . "\" style=\"--cycle-delay: {$cycleDelayRounded}s;\"><span aria-hidden=\"true\">{$spans}</span></span>";
    }

    // Caching is the caller's call, not this method's: app() below reuses this
    // to read index.html but injects per-session data (role, CSRF token) into
    // it, so that response must never be cached; asset() serves genuinely
    // static files and sets its own revalidation headers after calling this.
    private function serveFile(string $path): Response
    {
        $baseDir = realpath(__DIR__ . '/../../public/codevault');
        $requested = realpath($baseDir . '/' . $path);

        if ($requested === false || !str_starts_with($requested, $baseDir . DIRECTORY_SEPARATOR) || !is_file($requested)) {
            throw $this->createNotFoundException();
        }

        $ext = strtolower(pathinfo($requested, PATHINFO_EXTENSION));
        $contentType = self::MIME_TYPES[$ext] ?? 'application/octet-stream';

        $response = new Response(file_get_contents($requested));
        $response->headers->set('Content-Type', $contentType);
        $response->setLastModified(new \DateTimeImmutable('@' . filemtime($requested)));

        return $response;
    }

    private function setHardeningHeaders(Response $response): void
    {
        $response->headers->set('X-Frame-Options', 'DENY');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin');
    }
}
