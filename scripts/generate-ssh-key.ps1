# PowerShell script to generate SSH key for GitHub Actions deployment

Write-Host "🔐 Generating SSH key for GitHub Actions deployment..." -ForegroundColor Cyan

# Generate SSH key
$keyPath = "$env:USERPROFILE\.ssh\vps_deploy_key"
ssh-keygen -t ed25519 -f $keyPath -N '""' -C "github-actions-deploy"

Write-Host "`n✅ SSH key generated successfully!" -ForegroundColor Green
Write-Host "`n📋 Copy this PUBLIC key to add to your VPS:" -ForegroundColor Yellow
Get-Content "$keyPath.pub"

Write-Host "`n📋 Copy this PRIVATE key for GitHub Secrets (VPS_SSH_KEY):" -ForegroundColor Yellow
Get-Content $keyPath

Write-Host "`n⚠️  IMPORTANT NEXT STEPS:" -ForegroundColor Red
Write-Host "1. SSH into your VPS: ssh root@143.198.226.184" -ForegroundColor White
Write-Host "2. Run these commands to add the public key:" -ForegroundColor White
Write-Host "   mkdir -p ~/.ssh" -ForegroundColor Gray
Write-Host "   echo 'PASTE_PUBLIC_KEY_HERE' >> ~/.ssh/authorized_keys" -ForegroundColor Gray
Write-Host "   chmod 600 ~/.ssh/authorized_keys" -ForegroundColor Gray
Write-Host "3. Test SSH key login: ssh -i $($keyPath) root@143.198.226.184" -ForegroundColor White
Write-Host "4. Once working, disable password authentication!" -ForegroundColor Yellow