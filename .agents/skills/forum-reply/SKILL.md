---
name: forum-reply
description: Read or reply to a CubeRoot forum thread directly through the API without opening a browser. Use when the user provides a /forum/t/{id} or /zh/forum/t/{id} URL and asks what it says, asks for a draft, or asks AI to reply.
---

# Forum Reply

1. Extract the numeric thread ID from the URL.
2. Read `https://api.cuberoot.me/v1/forum/t/<id>?page=1&size=100` with `Invoke-RestMethod`. Fetch later pages only when `total > 100`.
3. If the user only asks for an explanation or draft, stop without writing.
4. Post only after the user explicitly asks to reply. Read `ADMIN_API_KEY` from the repository-root `.password.md`, never print it, then call:

```powershell
$keyText = Get-Content -Raw -LiteralPath '.password.md'
$keyMatch = [regex]::Match($keyText, 'ADMIN_API_KEY\*\*\s*\|\s*`([^`]+)`')
if (-not $keyMatch.Success) { throw 'ADMIN_API_KEY not found in .password.md' }
$headers = @{ 'X-Admin-Key' = $keyMatch.Groups[1].Value }
$body = @{ threadId = $threadId; content = $reply } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'https://api.cuberoot.me/v1/forum/posts' -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body
```

5. Report the returned `id`, `postNo`, and `status`. `approved` is public; `pending` awaits review. The existing forum notification path handles station messages and eligible email.
