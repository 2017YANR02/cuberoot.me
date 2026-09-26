# Runs in the access phase, including before proxy_cache HIT / stale responses.
auth_request /_cuberoot_competition_access;
error_page 403 = @cuberoot_access_denied;

location = /_cuberoot_competition_access {
    internal;
    auth_request off;
    if ($cuberoot_comp_check = 0) { return 204; }
    proxy_pass http://127.0.0.1:3001/v1/competition-access/check;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header Host api.cuberoot.me;
    proxy_set_header X-Cuberoot-Original-URI $request_uri;
    proxy_set_header X-Cuberoot-CN-Exempt $cuberoot_cn_exempt;
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
    # Preserve ordinary 403 responses (e.g. the temporary calculator denial).
    if ($cuberoot_comp_check = 0) { return 403; }
    return 403 '{"code":"competition_verification_required","error":"Browser verification required"}';
}
