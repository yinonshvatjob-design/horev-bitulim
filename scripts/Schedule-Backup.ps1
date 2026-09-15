$Action = New-ScheduledTaskAction -Execute 'Powershell.exe' -Argument "-ExecutionPolicy Bypass -WindowStyle Hidden -File ""$PSScriptRoot\Backup-Bitulim.ps1"""
$Trigger = New-ScheduledTaskTrigger -Daily -At 2:00AM
$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -Action $Action -Trigger $Trigger -Settings $Settings -TaskName "Bitulim_DailyBackup" -Description "Daily backup of Bitulim Firebase DB to local JSON" -Force

Write-Host "Scheduled task 'Bitulim_DailyBackup' registered successfully. It will run daily at 2:00 AM." -ForegroundColor Green
Write-Host "To test it now, run: Start-ScheduledTask -TaskName 'Bitulim_DailyBackup'" -ForegroundColor Yellow
