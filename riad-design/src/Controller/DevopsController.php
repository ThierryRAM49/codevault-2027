<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

// Serves the "AI Platform Selection Tool" SPA on devops.riad-design.cloud.
// The apex (riad-design.cloud) is a separate host-scoped controller —
// see CodevaultController.
class DevopsController extends AbstractController
{
    #[Route('/', name: 'app_devops_home', host: 'devops.riad-design.cloud', priority: 10)]
    #[Route('/analysis', name: 'app_devops_analysis', host: 'devops.riad-design.cloud', priority: 10)]
    #[Route('/recommendations', name: 'app_devops_recommendations', host: 'devops.riad-design.cloud', priority: 10)]
    public function index(): Response
    {
        return new Response(<<<HTML
            <!doctype html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Outil de sélection de plateforme IA — riAd Design</title>
                <meta name="description" content="Décrivez votre idée d'application et obtenez instantanément la plateforme d'hébergement la plus adaptée. Gratuit, anonyme, et une équipe prête à la construire pour vous.">
                <link rel="canonical" href="https://devops.riad-design.cloud/">
                <meta property="og:type" content="website">
                <meta property="og:site_name" content="riAd Design">
                <meta property="og:title" content="Outil de sélection de plateforme IA">
                <meta property="og:description" content="Décrivez votre idée d'application et obtenez instantanément la plateforme d'hébergement la plus adaptée.">
                <meta property="og:url" content="https://devops.riad-design.cloud/">
                <meta property="og:locale" content="fr_FR">
                <meta name="twitter:card" content="summary">
                <meta name="twitter:title" content="Outil de sélection de plateforme IA">
                <meta name="twitter:description" content="Décrivez votre idée d'application et obtenez instantanément la plateforme d'hébergement la plus adaptée.">
                <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
                <link rel="icon" type="image/x-icon" href="/assets/favicon.ico">
                <link rel="apple-touch-icon" href="/assets/favicon-180.png">
                <link rel="stylesheet" crossorigin href="/assets/index-k4pSG5yc.css">
                <script type="module" crossorigin src="/assets/index-DsViGLmS.js"></script>
            </head>
            <body>
                <div id="root"></div>
            </body>
            </html>
            HTML);
    }

    // nginx's document root for this vhost doesn't map to this project's
    // public/ directory (shared infra quirk), so every request already goes
    // through PHP-FPM. Serving the built SPA assets here keeps them working
    // without depending on nginx static file serving.
    private const ASSET_MIME_TYPES = [
        'css' => 'text/css',
        'js' => 'application/javascript',
        'svg' => 'image/svg+xml',
        'ico' => 'image/x-icon',
        'png' => 'image/png',
    ];

    #[Route('/assets/{file}', name: 'app_devops_asset', host: 'devops.riad-design.cloud', priority: 10, requirements: ['file' => 'index-k4pSG5yc\.css|index-DsViGLmS\.js|favicon\.svg|favicon\.ico|favicon-180\.png'])]
    public function asset(string $file): Response
    {
        $path = __DIR__ . '/../../public/assets/' . $file;
        $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
        $contentType = self::ASSET_MIME_TYPES[$ext] ?? 'application/octet-stream';

        $response = new Response(file_get_contents($path));
        $response->headers->set('Content-Type', $contentType);

        // The hashed bundle (index-<hash>.js/css) is content-addressed, so a
        // new build gets a new URL — safe to cache forever. The favicon files
        // keep stable names, so an immutable year-long cache would trap a
        // future icon change the same way CodeVault's old static-file caching
        // did; give those a short cache instead.
        $response->headers->set(
            'Cache-Control',
            str_starts_with($file, 'favicon') ? 'public, max-age=86400' : 'public, max-age=31536000, immutable'
        );

        return $response;
    }

    #[Route('/robots.txt', name: 'app_devops_robots', host: 'devops.riad-design.cloud', priority: 10)]
    public function robots(): Response
    {
        $response = new Response(<<<TXT
            User-agent: *
            Allow: /

            Sitemap: https://devops.riad-design.cloud/sitemap.xml
            TXT);
        $response->headers->set('Content-Type', 'text/plain');

        return $response;
    }

    #[Route('/sitemap.xml', name: 'app_devops_sitemap', host: 'devops.riad-design.cloud', priority: 10)]
    public function sitemap(): Response
    {
        $response = new Response(<<<XML
            <?xml version="1.0" encoding="UTF-8"?>
            <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                    <loc>https://devops.riad-design.cloud/</loc>
                    <changefreq>weekly</changefreq>
                    <priority>1.0</priority>
                </url>
            </urlset>
            XML);
        $response->headers->set('Content-Type', 'application/xml');

        return $response;
    }
}
