# ==============================================================================
# פלטפורמת ביטול ארוחות - מוסדות חורב ירושלים
# סקריפט גיבויים אוטומטי יומי (Automated Backup System)
# ==============================================================================

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackupDir = Join-Path $ScriptDir "backups"

# Create Backups folder if not exists
if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$SourceDb = Join-Path $ScriptDir "database.json"
$TargetBackup = Join-Path $BackupDir "database_backup_$Timestamp.json"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " [מוסדות חורב] הרצת גיבוי אוטומטי למערכת ביטולי ארוחות..." -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan

if (Test-Path $SourceDb) {
    Copy-Item -Path $SourceDb -Destination $TargetBackup -Force
    Write-Host " [הצלחה] הגיבוי נוצר בהצלחה בקובץ:" -ForegroundColor Green
    Write-Host " $TargetBackup" -ForegroundColor White
} else {
    Write-Host " [אזהרה] קובץ מסד הנתונים הראשוני עדיין לא נוצר." -ForegroundColor Red
}

Write-Host "=======================================================" -ForegroundColor Cyan
