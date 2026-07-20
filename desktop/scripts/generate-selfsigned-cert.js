/**
 * Generate a self-signed code signing certificate for development/testing.
 *
 * IMPORTANT LIMITATIONS:
 * - This is a SELF-SIGNED certificate, NOT trusted by Windows by default.
 * - Windows Defender SmartScreen will STILL show a warning ("Unknown Publisher").
 * - For production distribution, you MUST purchase a real code signing certificate
 *   from a trusted Certificate Authority (CA) like DigiCert, Sectigo, or SSL.com.
 *
 * WHAT THIS DOES:
 * - Uses Windows PowerShell (New-SelfSignedCertificate) to create a cert
 * - Exports it to certificate.pfx in the desktop folder
 * - Prints instructions for using it with electron-builder
 *
 * USAGE:
 *   cd desktop
 *   yarn gen-selfsign
 *
 * REQUIREMENTS:
 * - Windows OS (uses PowerShell New-SelfSignedCertificate cmdlet)
 * - Run as Administrator (recommended)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const CERT_DIR = path.join(__dirname, '..');
const CERT_PFX = path.join(CERT_DIR, 'certificate.pfx');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function main() {
  if (process.platform !== 'win32') {
    console.error('❌ 此腳本只能在 Windows 上執行');
    console.error('   Linux/macOS 用戶請使用 openssl 產生憑證');
    process.exit(1);
  }

  console.log('=======================================================');
  console.log('  自簽憑證產生器');
  console.log('=======================================================');
  console.log('');
  console.log('⚠️  注意: 自簽憑證仍會被 Windows Defender 標記為未知發行者');
  console.log('   如需完全避免警告,請購買正式簽章憑證。');
  console.log('');

  const subject = await ask('請輸入發行者名稱 (預設: Game Tracker Developer): ') || 'Game Tracker Developer';
  const password = await ask('請設定憑證密碼 (預設: gametracker123): ') || 'gametracker123';

  console.log('\n產生自簽憑證中...\n');

  const psScript = `
$cert = New-SelfSignedCertificate \`
    -Type CodeSigning \`
    -Subject "CN=${subject}" \`
    -KeyUsage DigitalSignature \`
    -FriendlyName "Game Tracker Code Signing" \`
    -CertStoreLocation "Cert:\\CurrentUser\\My" \`
    -NotAfter (Get-Date).AddYears(3) \`
    -KeyAlgorithm RSA \`
    -KeyLength 2048 \`
    -HashAlgorithm SHA256

$pwd = ConvertTo-SecureString -String "${password}" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "${CERT_PFX.replace(/\\/g, '\\\\')}" -Password $pwd | Out-Null

Write-Host "✓ 憑證已建立: ${CERT_PFX}"
Write-Host "  Thumbprint: $($cert.Thumbprint)"
`;

  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      stdio: 'inherit',
    });

    console.log('\n=======================================================');
    console.log('  ✅ 憑證產生完成!');
    console.log('=======================================================');
    console.log('');
    console.log('📁 憑證檔案: ' + CERT_PFX);
    console.log('🔑 密碼: ' + password);
    console.log('');
    console.log('📋 使用方式 (在 desktop 資料夾執行):');
    console.log('');
    console.log('   Windows CMD:');
    console.log(`     set CSC_LINK=${CERT_PFX}`);
    console.log(`     set CSC_KEY_PASSWORD=${password}`);
    console.log('     yarn dist');
    console.log('');
    console.log('   PowerShell:');
    console.log(`     $env:CSC_LINK="${CERT_PFX}"`);
    console.log(`     $env:CSC_KEY_PASSWORD="${password}"`);
    console.log('     yarn dist');
    console.log('');
    console.log('⚠️  用戶端仍需手動信任此憑證才能避免警告:');
    console.log('   1. 右鍵點擊 certificate.pfx → 安裝憑證');
    console.log('   2. 選擇「本機電腦」→ 下一步');
    console.log('   3. 選擇「將所有憑證放入以下的存放區」→ 瀏覽');
    console.log('   4. 選擇「受信任的根憑證授權單位」→ 確定');
    console.log('   5. 下一步 → 完成');
    console.log('');
  } catch (err) {
    console.error('❌ 產生憑證失敗:', err.message);
    process.exit(1);
  }
}

main();
