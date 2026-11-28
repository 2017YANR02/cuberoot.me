# Runs in the access phase, including before proxy_cache HIT / stale responses.
# Evaluate these URI maps in the client request, before auth_request changes $uri.
set $cuberoot_comp_gate_target $cuberoot_comp_access_path;
set $cuberoot_comp_gate_scraper $cuberoot_comp_scraper_denied;
# Only the internal verifier proxy may supply these fields. All external
# locations in these vhosts inherit this rewrite before proxying requests.
rewrite_by_lua_block {
    ngx.req.clear_header("X-CubeRoot-Auth-Subrequest")
    ngx.req.clear_header("X-CubeRoot-Competition-Path")
}
auth_request /_cuberoot_competition_access;
auth_request_set $cuberoot_auth_limit $upstream_http_x_cuberoot_competition_limit;
auth_request_set $cuberoot_auth_retry_after $upstream_http_retry_after;
auth_request_set $cuberoot_auth_status $upstream_status;
error_page 403 = @cuberoot_access_denied;

location = /_cuberoot_competition_access {
    internal;
    auth_request off;
    if ($cuberoot_comp_gate_scraper) { return 403; }
    if ($cuberoot_comp_check = 0) { return 204; }
    rewrite_by_lua_block {
        if ngx.var.cuberoot_comp_check == "3" then
            if (tonumber(ngx.var.cuberoot_comp_only_until) or 0) <= ngx.time() then
                return ngx.exit(204)
            end
            -- Google Search crawler candidates still require the API's
            -- official-IP check. Other anonymous reads need no round trip.
            local cookies = ";" .. (ngx.var.http_cookie or "")
            local browser = cookies:match(";%s*__Secure%-cuberoot_comp_manual=([^;]+)")
            local service = ngx.var.http_x_cuberoot_comp_service
            if not browser and (not service or service == "") then
                local candidate = ngx.re.find(ngx.var.http_user_agent or "", [[\b(?:Googlebot|Google-InspectionTool)\b]], "ijo")
                if not candidate then return ngx.exit(403) end
            end
        end
    }
    proxy_pass http://127.0.0.1:3001/v1/competition-access/check;
    # auth_request only accepts 2xx, 401 and 403. Translate verifier failures
    # inside this subrequest, then emit an explicit 503 on the client request.
    proxy_intercept_errors on;
    error_page 500 502 503 504 = @cuberoot_verifier_failed;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header Host api.cuberoot.me;
    proxy_set_header X-Cuberoot-Original-URI $request_uri;
    proxy_set_header X-CubeRoot-Auth-Subrequest 1;
    proxy_set_header X-CubeRoot-Competition-Path $cuberoot_comp_gate_target;
    proxy_set_header X-Cuberoot-CN-Exempt $cuberoot_comp_cn_exempt;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Cuberoot-Comp-Service $http_x_cuberoot_comp_service;
    proxy_set_header Cookie $http_cookie;
    proxy_set_header User-Agent $http_user_agent;
}

location @cuberoot_verifier_failed {
    auth_request off;
    return 403;
}

location @cuberoot_access_denied {
    auth_request off;
    default_type application/json;
    add_header Cache-Control "private, no-store" always;
    add_header Access-Control-Allow-Origin $cuberoot_comp_cors_origin always;
    add_header Access-Control-Allow-Credentials "true" always;
    add_header Vary "Origin" always;
    add_header Access-Control-Expose-Headers "Retry-After" always;
    content_by_lua_block {
        if ngx.var.cuberoot_comp_gate_scraper == "1" then
            ngx.header["X-CubeRoot-Comp-Scraper"] = "blocked"
            return ngx.exit(403)
        end
        if (ngx.var.cuberoot_auth_status or ""):match("^5%d%d$") then
            ngx.status = 503
            ngx.header["Retry-After"] = "5"
            ngx.say('{"code":"verification_unavailable"}')
            return ngx.exit(503)
        end
        if ngx.var.cuberoot_auth_limit == "1" then
            ngx.status = 429
            ngx.header["Retry-After"] = tonumber(ngx.var.cuberoot_auth_retry_after) or 60
            ngx.say('{"code":"competition_session_limited"}')
            return ngx.exit(429)
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
