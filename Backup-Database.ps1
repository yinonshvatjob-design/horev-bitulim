# ==============================================================================
# פלטפורמת ביטול ארוחות - מוסדות חורב ירושלים
# סקריפט גיבוי מסד נתונים PostgreSQL (Exact same as school-inventory)
# ==============================================================================

$ErrorActionPreference = "Stop"
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = "./database_backup_$Timestamp.sql"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " [מוסדות חורב] הרצת גיבוי PostgreSQL למערכת ביטולי ארוחות..." -ForegroundColor Yellow
Write-Host "=======================================================" -ForegroundColor Cyan

# Check if Docker container is running
$Container = docker ps --filter "name=school_bitulim_db_prod" --format "{{.Names}}"

if ($Container -eq "school_bitulim_db_prod") {
    docker exec school_bitulim_db_prod sh -c "pg_dump -U admin -d school_bitulim > /tmp/backup.sql"
    docker cp school_bitulim_db_prod:/tmp/backup.sql $BackupFile
    docker exec school_bitulim_db_prod rm /tmp/backup.sql
    Write-Host " [הצלחה] גיבוי ה-PostgreSQL נוצר בהצלחה בקובץ:" -ForegroundColor Green
    Write-Host " $BackupFile" -ForegroundColor White
} else {
    # Fallback to local JSON snapshot backup
    Copy-Item -Path "./database.json" -Destination "./database_backup_$Timestamp.json" -Force
    Write-Host " [הצלחה] גיבוי הנתונים נוצר בהצלחה בקובץ:" -ForegroundColor Green
    Write-Host " ./database_backup_$Timestamp.json" -ForegroundColor White
}

Write-Host "=======================================================" -ForegroundColor Cyan
