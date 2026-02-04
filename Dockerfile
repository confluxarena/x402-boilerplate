FROM php:8.4-apache

# Install PostgreSQL PDO driver and curl
RUN apt-get update && apt-get install -y \
    libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Enable Apache modules
RUN a2enmod rewrite headers

# Configure Apache
RUN printf '<Directory /var/www/html>\n    AllowOverride All\n    Require all granted\n</Directory>\n' \
    > /etc/apache2/conf-available/x402.conf \
    && a2enconf x402

WORKDIR /var/www/html
COPY . .

EXPOSE 80
