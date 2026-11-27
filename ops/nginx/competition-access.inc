# Runs in the access phase, including before proxy_cache HIT / stale responses.
# Evaluate these URI maps in the client request, before auth_request changes $uri.
set $cuberoot_comp_gate_target $cuberoot_comp_access_path;
set $cuberoot_comp_gate_scraper $cuberoot_comp_scraper_denied;
auth_request /_cuberoot_competition_access;
error_page 403 = @cuberoot_access_denied;

location = /_cuberoot_competition_access {
    internal;
    auth_request off;
    if ($cuberoot_comp_gate_scraper) { return 403; }
    if ($cuberoot_comp_check = 0) { return 204; }
    rewrite_by_lua_block {
        if ngx.var.cuberoot_comp_check == "3" and (tonumber(ngx.var.cuberoot_comp_only_until) or 0) <= ngx.time() then
            return ngx.exit(204)
        end
    }
    proxy_pass http://127.0.0.1:3001/v1/competition-access/check;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header Host api.cuberoot.me;
    proxy_set_header X-Cuberoot-Original-URI $request_uri;
    proxy_set_header X-Cuberoot-CN-Exempt $cuberoot_cn_exempt;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Cuberoot-Comp-Service $http_x_cuberoot_comp_service;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header User-Agent $http_user_agent;
}

location @cuberoot_access_denied {
    auth_request off;
    default_type application/json;
    add_header Cache-Control "private, no-store" always;
    add_header Access-Control-Allow-Origin $cuberoot_comp_cors_origin always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Vary "Origin" always;
    content_by_lua_block {
        if ngx.var.cuberoot_comp_gate_scraper == "1" then
            ngx.header["X-CubeRoot-Comp-Scraper"] = "blocked"
            return ngx.exit(403)
        end
        -- Preserve unrelated 403s, including the incident calculator denial.
        if ngx.var.cuberoot_comp_check == "0" then return ngx.exit(403) end
        if ngx.var.cuberoot_comp_check == "3" and (tonumber(ngx.var.cuberoot_comp_only_until) or 0) <= ngx.time() then
            return ngx.exit(403)
        end
        if ngx.var.cuberoot_comp_check == "2" then
            ngx.header["X-CubeRoot-Verification-Required"] = "1"
            -- Static tools can return through the main hostname; the proof cookie
            -- is shared across these hosts. Encode queries rather than nesting &.
            local origin = ngx.var.host == "static.cuberoot.me" and "https://cuberoot.me" or ""
            return ngx.redirect(origin .. "/competition-verify?returnTo=" .. ngx.escape_uri(ngx.var.request_uri), 307)
        end
        ngx.status = 403
        local scope = ngx.var.cuberoot_comp_check == "3" and "competition" or "site"
        ngx.say('{"code":"competition_verification_required","scope":"' .. scope .. '","error":"Browser verification required"}')
        return ngx.exit(403)
    }
}
