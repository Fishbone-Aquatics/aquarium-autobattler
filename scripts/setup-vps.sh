#!/bin/bash

# VPS Setup Script for Aquarium Autobattle
# Run this on your fresh DigitalOcean droplet

set -e

echo "🐠 Setting up Aquarium Autobattle Server..."

# Update system
echo "📦 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
echo "📦 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build essentials
echo "📦 Installing build tools..."
sudo apt install -y build-essential git nginx

# Install PM2 globally
echo "📦 Installing PM2..."
sudo npm install -g pm2

# Create app directory
echo "📁 Creating application directory..."
sudo mkdir -p /var/www/aquarium-autobattle
sudo chown -R $USER:$USER /var/www/aquarium-autobattle

# Clone repository
echo "📥 Cloning repository..."
cd /var/www
git clone https://github.com/Fishbone-Aquatics/Aquarium-Autobattle.git aquarium-autobattle
cd aquarium-autobattle

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build the application
echo "🔨 Building application..."
npm run build:shared
npm run build:all

# Setup PM2
echo "⚙️ Setting up PM2..."
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $USER --hp /home/$USER
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/$USER

# Configure Nginx
echo "🌐 Configuring Nginx..."
sudo tee /etc/nginx/sites-available/aquarium-autobattle > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

# Enable site
sudo ln -sf /etc/nginx/sites-available/aquarium-autobattle /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Setup firewall
echo "🔒 Configuring firewall..."
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set up SSH key authentication (see setup instructions)"
echo "2. Configure GitHub secrets"
echo "3. Push to master branch to trigger deployment"
echo ""
echo "Your app should be running at http://YOUR_VPS_IP"