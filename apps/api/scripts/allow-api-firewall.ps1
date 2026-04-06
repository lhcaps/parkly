# Parkly API — Mo port 3000 tren Windows Firewall (Private + Public)
# Chay: PowerShell "Run as Administrator" -> .\allow-api-firewall.ps1

$ruleName = "Parkly API 3000"

# Xoa rule cu neu co (de cap nhat profile)
netsh advfirewall firewall delete rule name=$ruleName 2>$null | Out-Null

# Them rule moi: cho phep ca Private (LAN) va Public
netsh advfirewall firewall add rule name=$ruleName dir=in action=allow protocol=TCP localport=3000 profile=private,public
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Firewall: TCP 3000 allowed (Private + Public)."
} else {
    Write-Host "[ERROR] Can quyen Administrator. Right-click PowerShell -> Run as administrator."
    exit 1
}
