$dir = 'C:\laragon\www\qr-absen-desktop\src-tauri\target\release\nsis\x64'
Get-ChildItem -Path $dir -Recurse | ForEach-Object {
    $f = $_.FullName
    try {
        $s = [System.IO.File]::Open($f, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
        $s.Close()
        Write-Host "$($_.Name) is FREE"
    } catch {
        Write-Host "$($_.Name) is LOCKED: $($_.Exception.Message)"
    }
}
