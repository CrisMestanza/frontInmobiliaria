$path = "src/pages/mapa/MapSidebarProyecto.jsx"
$content = [System.IO.File]::ReadAllText((Resolve-Path $path))

# Add import after gsap.registerPlugin line
$importBlock = @"

import {
  parseFinancingConfig,
  formatMoney,
  clamp,
  getRangeStyle,
  calcPayment,
} from "../../components/utils/financing";
"@

$content = $content -replace "gsap\.registerPlugin\(useGSAP\);", "gsap.registerPlugin(useGSAP);`r`n$importBlock"

[System.IO.File]::WriteAllText((Resolve-Path $path), $content)
Write-Host "Done!"
