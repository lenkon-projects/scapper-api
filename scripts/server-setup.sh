#!/bin/bash
set -e

echo "========================================="
echo "WordPress Parser API - Server Setup"
echo "========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "❌ This script must be run as root"
    echo "Please run: sudo bash $0"
    exit 1
fi

echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y

echo "📦 Installing essential packages..."
apt-get install -y curl wget git ufw fail2ban ca-certificates gnupg lsb-release

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker..."

    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg

    # Set up the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

    echo "✅ Docker installed successfully"
else
    echo "✅ Docker is already installed"
fi

# Start and enable Docker
systemctl start docker
systemctl enable docker

echo "✅ Docker service started and enabled"

# Install Nginx
if ! command -v nginx &> /dev/null; then
    echo "🌐 Installing Nginx..."
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
    echo "✅ Nginx installed successfully"
else
    echo "✅ Nginx is already installed"
fi

# Install Certbot
if ! command -v certbot &> /dev/null; then
    echo "🔒 Installing Certbot..."
    apt-get install -y certbot python3-certbot-nginx
    echo "✅ Certbot installed successfully"
else
    echo "✅ Certbot is already installed"
fi

# Configure Firewall (UFW)
echo "🔥 Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable

echo "✅ Firewall configured"

# Start fail2ban
echo "🛡️  Starting fail2ban..."
systemctl start fail2ban
systemctl enable fail2ban

echo "✅ Fail2ban started and enabled"

# Create application directory
echo "📁 Creating application directories..."
mkdir -p /root/wordpress-parser/{output,logs}
chmod 755 /root/wordpress-parser

echo "✅ Application directories created"

# Docker version info
echo ""
echo "========================================="
echo "Installation Summary"
echo "========================================="
docker --version
docker compose version
nginx -v
certbot --version
echo ""

echo "✅ Server setup completed successfully!"
echo ""
echo "📋 Next steps:"
echo "  1. Run the SSL setup script: bash scripts/ssl-setup.sh"
echo "  2. Copy nginx configuration to /etc/nginx/sites-available/"
echo "  3. Configure GitHub Actions secrets"
echo "  4. Push code to trigger deployment"
echo ""
