# Deployment Guide - Aquarium Autobattle

This guide covers setting up automatic deployment from GitHub to your DigitalOcean VPS.

## Prerequisites

- Fresh DigitalOcean droplet (Ubuntu 22.04 or later)
- GitHub repository access
- Domain name (optional, for custom domain)

## Step 1: Initial VPS Setup

1. **SSH into your VPS:**
```bash
ssh root@YOUR_VPS_IP
```

2. **Create a non-root user (recommended):**
```bash
adduser deploy
usermod -aG sudo deploy
su - deploy
```

3. **Run the setup script:**
```bash
curl -o setup-vps.sh https://raw.githubusercontent.com/Fishbone-Aquatics/Aquarium-Autobattle/master/scripts/setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh
```

This script will:
- Install Node.js 20, Git, Nginx
- Clone your repository
- Build the application
- Set up PM2 process manager
- Configure Nginx reverse proxy
- Set up firewall rules

## Step 2: Configure SSH Key Authentication

1. **On your VPS, generate an SSH key pair (if not exists):**
```bash
ssh-keygen -t ed25519 -C "github-actions"
# Press Enter for default location
# Leave passphrase empty for automation
```

2. **Add the public key to authorized_keys:**
```bash
cat ~/.ssh/id_ed25519.pub >> ~/.ssh/authorized_keys
```

3. **Display the private key (you'll need this for GitHub):**
```bash
cat ~/.ssh/id_ed25519
```

## Step 3: Configure GitHub Secrets

In your GitHub repository:

1. Go to **Settings → Secrets and variables → Actions**
2. Add the following secrets:

| Secret Name | Value |
|------------|-------|
| `VPS_HOST` | Your VPS IP address (e.g., `165.232.123.45`) |
| `VPS_USER` | Your VPS username (e.g., `deploy`) |
| `VPS_PORT` | SSH port (usually `22`) |
| `VPS_SSH_KEY` | The private key from Step 2 (entire content including `-----BEGIN` and `-----END` lines) |

## Step 4: Test Deployment

1. **Make a small change to your code**
2. **Commit and push to master branch:**
```bash
git add .
git commit -m "Test auto-deployment"
git push origin master
```

3. **Check GitHub Actions:**
   - Go to your repo → Actions tab
   - Watch the deployment workflow run
   - Green checkmark = successful deployment

4. **Verify deployment:**
```bash
# On your VPS
pm2 status
pm2 logs
```

## Step 5: Access Your Application

Your application will be available at:
- **Frontend:** `http://YOUR_VPS_IP`
- **Backend API:** `http://YOUR_VPS_IP/api`
- **Debug Panel:** `http://YOUR_VPS_IP/api/debug/sessions`

## Optional: Custom Domain Setup

1. **Point your domain to VPS:**
   - Add an A record: `@ → YOUR_VPS_IP`
   - Add an A record: `www → YOUR_VPS_IP`

2. **Install SSL certificate with Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

3. **Update frontend environment:**
   - Edit `/var/www/aquarium-autobattle/ecosystem.config.js`
   - Update `NEXT_PUBLIC_API_URL` to use your domain

## Monitoring & Logs

### View application logs:
```bash
pm2 logs                     # All logs
pm2 logs aquarium-backend    # Backend only
pm2 logs aquarium-frontend   # Frontend only
```

### Monitor resources:
```bash
pm2 monit                    # Real-time monitoring
pm2 status                   # Process status
```

### Log files location:
```
/var/www/aquarium-autobattle/logs/
├── backend-error.log
├── backend-out.log
├── frontend-error.log
└── frontend-out.log
```

## Troubleshooting

### If deployment fails:

1. **Check GitHub Actions logs:**
   - Click on failed workflow run
   - Expand failed step for error details

2. **Check PM2 on VPS:**
```bash
pm2 status
pm2 logs --lines 50
```

3. **Check Nginx:**
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Common issues:

- **Port already in use:** Kill existing process or change port
- **Build fails:** Ensure all dependencies are in package.json
- **PM2 not starting:** Check ecosystem.config.js paths
- **502 Bad Gateway:** Backend not running, check PM2 logs

## Manual Deployment (Fallback)

If automatic deployment fails, you can deploy manually:

```bash
ssh deploy@YOUR_VPS_IP
cd /var/www/aquarium-autobattle
git pull origin master
npm ci
npm run build:shared
npm run build:all
pm2 restart ecosystem.config.js
```

## Security Notes

- Never commit `.env` files or secrets
- Keep your VPS updated: `sudo apt update && sudo apt upgrade`
- Consider using fail2ban for SSH protection
- Regularly check PM2 logs for errors
- Set up monitoring (e.g., UptimeRobot) for availability

## TODO: Optimize for Small VPS

**Build in GitHub Actions instead of on VPS** - The build process requires significant memory (2-4GB). For small VPS instances, modify the deployment to:
1. Build the application in GitHub Actions (free, powerful runners)
2. Create a tarball of the `dist/` directories
3. Upload as GitHub artifact
4. Download and extract only compiled files to VPS
5. This reduces deployment time from ~10 minutes to ~1 minute and eliminates memory issues

## Rollback Strategy

If a deployment breaks your app:

```bash
# On your VPS
cd /var/www/aquarium-autobattle
git log --oneline -5           # Find last working commit
git checkout COMMIT_HASH        # Revert to working version
npm ci
npm run build:all
pm2 restart ecosystem.config.js
```

Then fix the issue locally before pushing again.