#!/bin/bash
# VPS setup for Aquarium Autobattle v2
# Run from your local machine: bash scripts/vps-quick-setup.sh
set -e

VPS_IP="143.198.226.184"
VPS_USER="root"
KEY="$HOME/.ssh/vps_deploy_key"

echo "Setting up VPS at $VPS_IP for v2..."

ssh -i "$KEY" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" bash << 'REMOTE'
set -e

echo "--- Checking dependencies ---"
if ! command -v node &>/dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
node --version

if ! command -v pm2 &>/dev/null; then
  echo "Installing PM2..."
  npm install -g pm2
fi

if ! command -v nginx &>/dev/null; then
  echo "Installing Nginx..."
  apt install -y nginx
fi

echo "--- Setting up repo ---"
mkdir -p /var/www
if [ -d /var/www/aquarium-autobattle/.git ]; then
  echo "Repo exists, pulling latest..."
  cd /var/www/aquarium-autobattle
  git pull origin master
else
  echo "Cloning repo..."
  git clone https://github.com/Fishbone-Aquatics/Aquarium-Autobattle.git /var/www/aquarium-autobattle
  cd /var/www/aquarium-autobattle
fi

echo "--- Installing v2 dependencies ---"
cd /var/www/aquarium-autobattle/v2
npm ci

echo "--- Building web app ---"
npm run build

echo "--- Creating logs directory ---"
mkdir -p /var/www/aquarium-autobattle/logs

echo "--- Configuring PM2 ---"
cd /var/www/aquarium-autobattle
pm2 delete aquarium-v2 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "--- Configuring Nginx ---"
cat > /etc/nginx/sites-available/aquarium-autobattle << 'NGINX'
server {
    listen 80;
    server_name _;

    # Everything goes to the v2 server (port 3101), which serves
    # the built Vite app as static files and handles socket.io.
    location / {
        proxy_pass http://localhost:3101;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/aquarium-autobattle /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx

echo "--- Firewall ---"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
echo "y" | ufw enable || true

echo ""
echo "=== Setup complete ==="
pm2 status
echo ""
echo "App: http://$HOSTNAME"
echo "Health: http://$HOSTNAME/api/health"
REMOTE

echo ""
echo "Done. App should be live at http://$VPS_IP"
echo "Health check: http://$VPS_IP/api/health"
