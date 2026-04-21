# update_attendance.ps1
$baseUrl = "https://student-performance-anal-35624-default-rtdb.firebaseio.com"
$studentsUrl = "$baseUrl/students.json"

Write-Host "Fetching all members..." -ForegroundColor Cyan
$allRecords = Invoke-RestMethod -Uri $studentsUrl

if ($null -eq $allRecords) {
    Write-Host "No records found." -ForegroundColor Red
    exit
}

$today = [DateTime]::Today
$lockedStart = 4
$historyEnd = 181

Write-Host "Starting update for both students and interns..." -ForegroundColor Cyan

foreach ($key in $allRecords.Keys) {
    $member = $allRecords[$key]
    Write-Host "Updating $($member.name) ($($member.id))..." -ForegroundColor Yellow
    
    $logUpdates = @{}
    for ($i = $lockedStart; $i -le $historyEnd; $i++) {
        $date = $today.AddDays(-$i)
        $dateKey = $date.ToString("yyyy-MM-dd")
        $logUpdates[$dateKey] = "Present"
    }

    # Use PATCH to update only the attendanceLog without overwriting other fields
    $patchUrl = "$baseUrl/students/$key/attendanceLog.json"
    $json = $logUpdates | ConvertTo-Json
    
    try {
        Invoke-RestMethod -Uri $patchUrl -Method Patch -Body $json
        Write-Host "  Successfully updated $($logUpdates.Count) dates." -ForegroundColor Green
    } catch {
        Write-Host "  Failed to update: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nAll records updated successfully!" -ForegroundColor Cyan
