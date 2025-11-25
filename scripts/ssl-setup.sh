#!/bin/bash
set -e

DOMAIN="scrapper.liorizhakidrums.com"
EMAIL="lenkon1@gmail.com"

echo "========================================="
echo "SSL Certificate Setup"
echo "========================================="
echo ""
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root"
    echo "Please run: sudo bash $0"
    exit 1
fi

# Check if nginx is installed
if ! command -v nginx &> /dev/null; then
    echo "❌ Nginx is not installed. Please run server-setup.sh first."
    exit 1
fi

# Check if certbot is installed
if ! command -v certbot &> /dev/null; then
    echo "❌ Certbot is not installed. Please run server-setup.sh first."
    exit 1
fi

# Check if nginx config exists
NGINX_CONFIG="/etc/nginx/sites-available/${DOMAIN}.conf"
if [ ! -f "$NGINX_CONFIG" ]; then
    echo "❌ Nginx configuration not found at: $NGINX_CONFIG"
    echo "Please copy the nginx configuration file first."
    exit 1
fi

# Check if site is enabled
NGINX_ENABLED="/etc/nginx/sites-enabled/${DOMAIN}.conf"
if [ ! -L "$NGINX_ENABLED" ]; then
    echo "📝 Enabling nginx site..."
    ln -s "$NGINX_CONFIG" "$NGINX_ENABLED"
    echo "✅ Site enabled"
fi

# Test nginx configuration
echo "🔍 Testing nginx configuration..."
if ! nginx -t; then
    echo "❌ Nginx configuration test failed"
    exit 1
fi

echo "✅ Nginx configuration is valid"

# Reload nginx
echo "🔄 Reloading nginx..."
systemctl reload nginx

echo "✅ Nginx reloaded"

# Obtain SSL certificate
echo "🔒 Obtaining SSL certificate from Let's Encrypt..."
echo ""

certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

echo ""
echo "✅ SSL certificate obtained successfully!"
echo ""

# Test auto-renewal
echo "🔄 Testing automatic renewal..."
certbot renew --dry-run

echo ""
echo "========================================="
echo "SSL Setup Complete!"
echo "========================================="
echo ""
echo "Certificate details:"
certbot certificates | grep -A 10 "$DOMAIN"
echo ""
echo "📋 Certificate will be automatically renewed by certbot"
echo "✅ Your site is now secured with HTTPS"
echo ""
echo "🌐 You can access your API at: https://$DOMAIN"
echo ""
