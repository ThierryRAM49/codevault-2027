FROM php:8.4-fpm

# Installer les dépendances système + extensions PHP
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmariadb-dev libzip-dev libpng-dev libonig-dev libxml2-dev libicu-dev unzip git curl \
    && rm -rf /var/lib/apt/lists/*

RUN docker-php-ext-install -j$(nproc) pdo_mysql intl zip mbstring xml opcache

# Créer le dossier de logs (sinon PHP-FPM crash si error_log pointe vers un dossier inexistant)
RUN mkdir -p /var/log/symfony && chown www-data:www-data /var/log/symfony

# Config PHP-FPM minimale et STABLE pour Docker (sans directives problématiques)
RUN cat > /usr/local/etc/php-fpm.d/www.conf << 'PHPEOF'
[www]
listen = 0.0.0.0:9000
user = www-data
group = www-data
listen.owner = www-data
listen.group = www-data
listen.mode = 0666
pm = ondemand
pm.max_children = 5
pm.process_idle_timeout = 10s
pm.max_requests = 500
catch_workers_output = yes
php_flag[display_errors] = off
php_admin_value[error_log] = /var/log/symfony/php-fpm-error.log
php_admin_flag[log_errors] = on
php_admin_value[memory_limit] = 256M
env[HOSTNAME] = $HOSTNAME
env[PATH] = /usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
env[TMP] = /tmp
env[TMPDIR] = /tmp
env[TEMP] = /tmp
PHPEOF

WORKDIR /var/www/html
CMD ["php-fpm"]
