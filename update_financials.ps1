$baseUrl = "https://student-performance-anal-35624-default-rtdb.firebaseio.com"
$studentsUrl = "$baseUrl/students.json"

Write-Host "Fetching all members to update financial records..." -ForegroundColor Cyan
$allRecords = Invoke-RestMethod -Uri $studentsUrl

if ($null -eq $allRecords) {
    Write-Host "No records found." -ForegroundColor Red
    exit
}

Write-Host "Updating finances..." -ForegroundColor Cyan

foreach ($prop in $allRecords.psobject.properties) {
    $key = $prop.Name
    $member = $prop.Value
    
    $calculatedFunds = 0

    if ($member.type -eq 'Student') {
        $calculatedFunds = 35000
    } elseif ($member.type -eq 'Intern') {
        # default duration months to 0
        $durationInt = 0
        if ($member.duration -match "^(\d+)") {
            $durationInt = [int]$matches[1]
        }
        $calculatedFunds = 15000 * $durationInt
    }

    Write-Host "Updating $($member.name) ($($member.type)) to Rs $($calculatedFunds)..." -ForegroundColor Yellow

    $patchBody = @{
        funds = $calculatedFunds
    } | ConvertTo-Json -Depth 10

    $patchUrl = "$baseUrl/students/$key.json"
    
    try {
        Invoke-RestMethod -Uri $patchUrl -Method Patch -Body $patchBody | Out-Null
        Write-Host "  Successfully patched Rs $($calculatedFunds)." -ForegroundColor Green
    } catch {
        Write-Host "  Failed to update $($member.name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`nAll financial records updated successfully in Firebase!" -ForegroundColor Green
