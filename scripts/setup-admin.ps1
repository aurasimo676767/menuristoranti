param([switch]$CheckOnly)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$ErrorActionPreference = 'Stop'
$script:settingsReady = $false
$script:settingsFile = $null
$script:credentialValues = $null

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Andrea BBQ - Scegli la password'
$form.ClientSize = New-Object System.Drawing.Size(720, 710)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)
$form.BackColor = [System.Drawing.Color]::FromArgb(245, 243, 238)

function Add-Text($parent, $text, $x, $y, $width, $height, $bold = $false) {
  $label = New-Object System.Windows.Forms.Label
  $label.Text = $text
  $label.Location = New-Object System.Drawing.Point($x, $y)
  $label.Size = New-Object System.Drawing.Size($width, $height)
  if ($bold) { $label.Font = New-Object System.Drawing.Font('Segoe UI', 12, [System.Drawing.FontStyle]::Bold) }
  $parent.Controls.Add($label)
  return $label
}
function Add-Button($parent, $text, $x, $y, $width = 130) {
  $button = New-Object System.Windows.Forms.Button
  $button.Text = $text
  $button.Location = New-Object System.Drawing.Point($x, $y)
  $button.Size = New-Object System.Drawing.Size($width, 36)
  $parent.Controls.Add($button)
  return $button
}

$null = Add-Text $form '1. Scegli la password per il tuo menu' 24 20 660 35 $true
$null = Add-Text $form 'Usa almeno 8 caratteri.' 24 62 660 30
$null = Add-Text $form 'Password' 24 103 170 26
$firstPassword = New-Object System.Windows.Forms.TextBox
$firstPassword.Location = New-Object System.Drawing.Point(200, 100)
$firstPassword.Size = New-Object System.Drawing.Size(480, 28)
$firstPassword.UseSystemPasswordChar = $true
$firstPassword.MaxLength = 256
$form.Controls.Add($firstPassword)
$null = Add-Text $form 'Ripeti la password' 24 144 170 26
$repeatPassword = New-Object System.Windows.Forms.TextBox
$repeatPassword.Location = New-Object System.Drawing.Point(200, 141)
$repeatPassword.Size = New-Object System.Drawing.Size(480, 28)
$repeatPassword.UseSystemPasswordChar = $true
$repeatPassword.MaxLength = 256
$form.Controls.Add($repeatPassword)
$prepare = Add-Button $form 'Prepara i valori' 200 185 190
$prepare.BackColor = [System.Drawing.Color]::FromArgb(255, 150, 70)
$notice = Add-Text $form 'La password resta su questo computer. Ricordala per accedere al menu.' 24 235 660 48

$settingsPanel = New-Object System.Windows.Forms.Panel
$settingsPanel.Location = New-Object System.Drawing.Point(0, 295)
$settingsPanel.Size = New-Object System.Drawing.Size(710, 360)
$settingsPanel.Enabled = $false
$form.Controls.Add($settingsPanel)
$null = Add-Text $settingsPanel '2. Copia questi tre valori su Vercel' 24 0 660 32 $true
$null = Add-Text $settingsPanel "Apri il progetto su Vercel > Settings > Environment Variables.`r`nPer ogni riga: aggiungi il nome in Key e il valore in Value. Scegli Production." 24 40 660 55

$settingNames = @('ADMIN_PASSWORD_HASH', 'ADMIN_SESSION_SECRET', 'MENU_STORE_PREFIX')
for ($index = 0; $index -lt $settingNames.Length; $index++) {
  $settingName = $settingNames[$index]
  $y = 110 + $index * 55
  $null = Add-Text $settingsPanel $settingName 24 ($y + 6) 300 28
  $copyName = Add-Button $settingsPanel 'Copia nome' 330 $y 155
  $copyName.Tag = $settingName
  $copyName.Add_Click({
    try {
      [System.Windows.Forms.Clipboard]::SetText([string]$this.Tag)
      $notice.Text = 'Nome copiato. Su Vercel incollalo nel campo Key (Nome).'
    } catch { $notice.Text = 'Non riesco a copiare. Premi di nuovo il pulsante.' }
  })
  $copyValue = Add-Button $settingsPanel 'Copia valore' 500 $y 180
  $copyValue.Tag = $settingName
  $copyValue.Add_Click({
    try {
      [System.Windows.Forms.Clipboard]::SetText([string]$script:credentialValues.([string]$this.Tag))
      $notice.Text = 'Valore copiato. Su Vercel incollalo nel campo Value (Valore), poi salva.'
    } catch { $notice.Text = 'Non riesco a copiare. Premi di nuovo il pulsante.' }
  })
}
$null = Add-Text $settingsPanel 'Dopo aver salvato tutte e tre le righe su Vercel, torna in chat e scrivi FATTO.' 24 285 660 52
$close = Add-Button $form 'Chiudi' 550 660 130
$close.Add_Click({ $form.Close() })

$prepare.Add_Click({
  if ($firstPassword.Text.Length -lt 8) { $notice.Text = 'La password e troppo corta: scrivi almeno 8 caratteri.'; return }
  if ($firstPassword.Text -cne $repeatPassword.Text) { $notice.Text = 'Le due password sono diverse. Riscrivile uguali.'; return }
  $prepare.Enabled = $false
  $form.UseWaitCursor = $true
  $worker = $null
  try {
    $nodePath = (Get-Command node -ErrorAction Stop).Source
    $helperPath = Join-Path $PSScriptRoot 'admin-credentials.cjs'
    $startInfo = New-Object System.Diagnostics.ProcessStartInfo
    $startInfo.FileName = $nodePath
    $startInfo.Arguments = '"' + $helperPath + '"'
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $startInfo.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
    $worker = New-Object System.Diagnostics.Process
    $worker.StartInfo = $startInfo
    $null = $worker.Start()
    $payload = @{ password = $firstPassword.Text } | ConvertTo-Json -Compress
    $passwordBytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
    $worker.StandardInput.BaseStream.Write($passwordBytes, 0, $passwordBytes.Length)
    $worker.StandardInput.Close()
    [Array]::Clear($passwordBytes, 0, $passwordBytes.Length)
    $payload = $null
    if (-not $worker.WaitForExit(10000)) { $worker.Kill(); throw 'Helper timeout' }
    if ($worker.ExitCode -ne 0) { throw 'Helper failed' }
    $result = $worker.StandardOutput.ReadToEnd() | ConvertFrom-Json
    $script:credentialValues = $result.credentials
    $script:settingsFile = $result.file
    $script:settingsReady = $true
    $firstPassword.Clear()
    $repeatPassword.Clear()
    $firstPassword.Enabled = $false
    $repeatPassword.Enabled = $false
    $settingsPanel.Enabled = $true
    $notice.Text = 'Password preparata. Ora segui il punto 2 qui sotto. I valori sono salvati anche sul computer.'
    $form.Text = 'Andrea BBQ - Copia i valori su Vercel'
  } catch {
    $notice.Text = 'Non riesco a preparare i valori. Torna in chat e dimmi che compare questo messaggio.'
    $prepare.Enabled = $true
  } finally {
    if ($worker) { $worker.Dispose() }
    $form.UseWaitCursor = $false
  }
})
$form.AcceptButton = $prepare
$form.Add_Shown({ $form.Activate(); $firstPassword.Focus() })
if ($CheckOnly) { Write-Output 'PASS: finestra di configurazione creata, controlli e pulsanti pronti.' }
else { $null = $form.ShowDialog() }
$form.Dispose()
