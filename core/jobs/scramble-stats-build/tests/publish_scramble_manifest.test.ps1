#!/usr/bin/env pwsh
# Offline regression: extract real publisher blocks, replace only SSH with a local stdin recorder.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../../..'))
$fixture = Join-Path $repo ".tmp/png/publish-manifest-test-$([Guid]::NewGuid().ToString('N'))"
[void][IO.Directory]::CreateDirectory($fixture)
$publisher = Join-Path $PSScriptRoot '../publish_scramble_incremental.ps1'
$tokens = $null
$parseErrors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($publisher, [ref]$tokens, [ref]$parseErrors)
if($parseErrors.Count){ throw ($parseErrors | Out-String) }

foreach($name in @('Load', 'Save-PublishBaseline', 'BashPath')){
  $definition = @($ast.FindAll({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name}, $true))
  if($definition.Count -ne 1){ throw "Missing or duplicated function: $name" }
  . ([scriptblock]::Create($definition[0].Extent.Text))
}
$utf8 = [Text.UTF8Encoding]::new($false)
$hashA = 'a' * 40
$hashB = 'b' * 40
$Manifest = Join-Path $fixture 'baseline.sha1'
$cur = Join-Path $fixture 'current.sha1'
[IO.File]::WriteAllText($Manifest, "$hashA  ./one.txt`n$hashB *./中文 空格.txt`n", $utf8)
$loaded = Load $Manifest
if($loaded.Count -ne 2 -or $loaded['./one.txt'] -ne $hashA -or $loaded['./中文 空格.txt'] -ne $hashB){
  throw 'Text/binary SHA1 markers were not both parsed accurately'
}
foreach($content in @(
  "broken`n",
  "$hashA  ./../escape.txt`n",
  "$hashA  ./nested/./file.txt`n",
  "$hashA  ./back\slash.txt`n",
  "$hashA  ./duplicate.txt`n$hashB  ./duplicate.txt`n"
)){
  $invalid = Join-Path $fixture "invalid-$([Guid]::NewGuid().ToString('N')).sha1"
  [IO.File]::WriteAllText($invalid, $content, $utf8)
  $rejected = $false
  try { $null = Load $invalid } catch { $rejected = $true }
  if(-not $rejected){ throw "Invalid manifest accepted: $content" }
}

$source = Join-Path $fixture 'source'
$unpacked = Join-Path $fixture 'unpacked'
[void][IO.Directory]::CreateDirectory($source)
[void][IO.Directory]::CreateDirectory($unpacked)
$changed = [Collections.Generic.List[string]]::new()
foreach($name in @('__proto__', '-option.txt', '中文 空格.txt', ' leading.txt', "quote'file.txt")){
  $changed.Add("./$name")
  [IO.File]::WriteAllText((Join-Path $source $name), "contents:$name", $utf8)
}
$list = Join-Path $fixture 'changed.txt'
$writer = @($ast.FindAll({param($n) $n -is [Management.Automation.Language.InvokeMemberExpressionAst] -and $n.Member.Value -eq 'WriteAllText'}, $true))
if($writer.Count -ne 1){ throw 'Expected one changed-list writer' }
& ([scriptblock]::Create($writer[0].Extent.Text))
$expectedList = ($changed -join "`n") + "`n"
if([IO.File]::ReadAllText($list) -cne $expectedList){ throw 'Changed list must preserve names and use LF' }
$bash = 'C:\Program Files\Git\bin\bash.exe'
if(-not (Test-Path -LiteralPath $bash)){ $bash = 'bash' }
$bLocal = BashPath $source
$deltaB = BashPath (Join-Path $fixture 'delta.tgz')
$listB = BashPath $list
$unpackedB = BashPath $unpacked
$tarCommand = @($ast.FindAll({param($n) $n -is [Management.Automation.Language.CommandAst] -and $n.Extent.Text.Contains('--verbatim-files-from')}, $true))
if($tarCommand.Count -ne 1){ throw 'Expected one verbatim delta tar command' }
& ([scriptblock]::Create($tarCommand[0].Extent.Text))
if($LASTEXITCODE -ne 0){ throw 'Actual delta tar command failed' }
& $bash -c "tar -xzf '$deltaB' -C '$unpackedB'"
if($LASTEXITCODE -ne 0){ throw 'Fixture archive extraction failed' }
if(@([IO.Directory]::GetFiles($unpacked)).Count -ne $changed.Count){ throw 'Archive file count differs' }
foreach($relative in $changed){
  $name = $relative.Substring(2)
  if([IO.File]::ReadAllText((Join-Path $unpacked $name)) -cne "contents:$name"){ throw "Archive content differs: $name" }
}

$deleteBlock = @($ast.EndBlock.Statements | Where-Object {
  $_ -is [Management.Automation.Language.IfStatementAst] -and $_.Clauses[0].Item1.Extent.Text -eq '$deleted.Count -gt 0'
})
$saveCall = @($ast.EndBlock.Statements | Where-Object { $_.Extent.Text -eq 'Save-PublishBaseline' })
if($deleteBlock.Count -ne 1 -or $saveCall.Count -ne 1){ throw 'Publisher deletion/save structure changed' }
if($saveCall[0].Extent.StartOffset -lt $deleteBlock[0].Extent.EndOffset){ throw 'Baseline advanced before deletion completed' }
$mock = Join-Path $fixture 'record-stdin.cjs'
$capture = Join-Path $fixture 'stdin.bin'
[IO.File]::WriteAllText($mock, 'const fs=require("node:fs");let chunks=[];process.stdin.on("data",b=>chunks.push(b));process.stdin.on("end",()=>{fs.writeFileSync(process.argv[2],Buffer.concat(chunks));process.exitCode=Number(process.argv[3]);});', $utf8)
$simulated = $deleteBlock[0].Extent.Text.Replace("[Diagnostics.ProcessStartInfo]::new('ssh')", "[Diagnostics.ProcessStartInfo]::new('node')")
$simulated = $simulated.Replace('$sshInfo.ArgumentList.Add($RHost)', '$sshInfo.ArgumentList.Add($mock)')
$simulated = $simulated.Replace('$sshInfo.ArgumentList.Add($deleteScript)', '$sshInfo.ArgumentList.Add($capture); $sshInfo.ArgumentList.Add($mockExitCode.ToString())')
if($simulated.Contains("::new('ssh')") -or -not $simulated.Contains("::new('node')")){ throw 'SSH substitution failed; refusing to execute' }
$simulated += "`n" + $saveCall[0].Extent.Text
$deleted = $changed
$RDest = '/unused-offline-fixture'
$before = [IO.File]::ReadAllText($Manifest)
[IO.File]::WriteAllText($cur, "$hashB  ./replacement.txt`n", $utf8)
$mockExitCode = 23
$failed = $false
try { & ([scriptblock]::Create($simulated)) } catch {
  if($_.Exception.Message -notlike '*远端删孤儿失败*'){ throw }
  $failed = $true
}
if(-not $failed){ throw 'Nonzero deletion exit was ignored' }
if([IO.File]::ReadAllText($Manifest) -cne $before){ throw 'Failed deletion advanced baseline' }
$mockExitCode = 0
& ([scriptblock]::Create($simulated))
$actualBytes = [Convert]::ToHexString([IO.File]::ReadAllBytes($capture))
$expectedBytes = [Convert]::ToHexString($utf8.GetBytes($expectedList))
if($actualBytes -cne $expectedBytes){ throw 'Deletion stdin is not exact UTF8 LF bytes' }
if([IO.File]::ReadAllText($Manifest) -cne [IO.File]::ReadAllText($cur)){ throw 'Successful deletion did not advance baseline' }
if(Test-Path -LiteralPath "$Manifest.$PID.tmp"){ throw 'Atomic baseline temporary remains after success' }
Write-Host 'PASS: manifest parsing, invalid/duplicate rejection, tar roundtrip, exact stdin, deletion failure and atomic baseline'
Write-Host "Fixtures: $fixture"
