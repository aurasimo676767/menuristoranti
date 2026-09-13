param([switch]$Restart)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class AndreaSetupWindow {
  public delegate bool WindowCallback(IntPtr window, IntPtr state);
  [DllImport("user32.dll")] public static extern bool EnumWindows(WindowCallback callback, IntPtr state);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr window, StringBuilder text, int length);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
}
'@
function Find-SetupWindow {
  $script:setupHandle = [IntPtr]::Zero
  $callback = [AndreaSetupWindow+WindowCallback] {
    param([IntPtr]$window, [IntPtr]$state)
    $title = New-Object System.Text.StringBuilder 256
    $null = [AndreaSetupWindow]::GetWindowText($window, $title, $title.Capacity)
    if ($title.ToString() -in @('Andrea BBQ - Scegli la password', 'Andrea BBQ - Copia i valori su Vercel')) {
      $script:setupHandle = $window
      return $false
    }
    return $true
  }
  $null = [AndreaSetupWindow]::EnumWindows($callback, [IntPtr]::Zero)
  return $script:setupHandle
}

$handle = Find-SetupWindow
if ($Restart -and $handle -ne [IntPtr]::Zero) {
  $title = New-Object System.Text.StringBuilder 256
  $null = [AndreaSetupWindow]::GetWindowText($handle, $title, $title.Capacity)
  # Refresh only the password form; preserve any already-generated credentials.
  if ($title.ToString() -eq 'Andrea BBQ - Scegli la password') {
    $null = [AndreaSetupWindow]::PostMessage($handle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
      Start-Sleep -Milliseconds 100
      $handle = Find-SetupWindow
      if ($handle -eq [IntPtr]::Zero) { break }
    }
    if ($handle -ne [IntPtr]::Zero) { throw 'La finestra precedente non si e chiusa. Chiudila e riprova.' }
  }
}
if ($handle -eq [IntPtr]::Zero) {
  $helperPath = Join-Path $PSScriptRoot 'setup-admin.ps1'
  # This is the interactive window explicitly requested by the user.
  $process = Start-Process -FilePath (Join-Path $PSHOME 'powershell.exe') -WindowStyle Normal -ArgumentList @('-NoProfile', '-STA', '-File', ('"' + $helperPath + '"')) -PassThru
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 250
    $handle = Find-SetupWindow
    if ($handle -ne [IntPtr]::Zero -or $process.HasExited) { break }
  }
}
if ($handle -eq [IntPtr]::Zero) { throw 'La finestra non risulta presente sul desktop di questa sessione.' }
$wasVisible = [AndreaSetupWindow]::IsWindowVisible($handle)
$null = [AndreaSetupWindow]::ShowWindowAsync($handle, 9)
$null = [AndreaSetupWindow]::ShowWindowAsync($handle, 5)
$foreground = [AndreaSetupWindow]::SetForegroundWindow($handle)
Start-Sleep -Milliseconds 200
[PSCustomObject]@{
  Found = $true
  WasVisible = $wasVisible
  Visible = [AndreaSetupWindow]::IsWindowVisible($handle)
  ForegroundRequested = $foreground
  SessionId = (Get-Process -Id $PID).SessionId
}
