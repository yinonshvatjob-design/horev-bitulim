$ErrorActionPreference = "Stop"

# Configuration
$ApiUrl = "https://bitulim.horevit.com/api/backup"
$AdminDevId = "ADMIN_DEV" # or 203084637
$BackupDir = Join-Path $PSScriptRoot "..\backups"
$DateStr = (Get-Date).ToString("yyyy-MM-dd_HH-mm-ss")
$BackupFile = Join-Path $BackupDir "bitulim_backup_$DateStr.json"

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

Write-Host "Starting backup from $ApiUrl..." -ForegroundColor Cyan

try {
    # We need to simulate the frontend's Authorization header
    # The server expects: Authorization: Bearer <AdminDevId> (because of how authenticateToken works)
    $Headers = @{
        "Authorization" = "Bearer $AdminDevId"
    }

    $Response = Invoke-RestMethod -Uri $ApiUrl -Method Get -Headers $Headers
    
    if ($Response.success -and $Response.backup) {
        $JsonContent = $Response.backup | ConvertTo-Json -Depth 10
        Set-Content -Path $BackupFile -Value $JsonContent -Encoding UTF8
        Write-Host "Successfully backed up Bitulim data to: $BackupFile" -ForegroundColor Green
    } else {
        Write-Host "API returned success=false. Backup failed." -ForegroundColor Red
    }
} catch {
    Write-Host "Failed to download backup: $_" -ForegroundColor Red
}
