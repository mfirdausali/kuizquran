<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Bearer-token auth (Sanctum personal access tokens, supports_credentials
    // false below) means a browser never auto-attaches this API's credentials
    // cross-origin — '*' is safe here in a way it would NOT be with cookies.
    // ALLOWED_ORIGINS can still restrict it (comma-separated) for defense in depth.
    'allowed_origins' => array_values(array_filter(array_map('trim', explode(
        ',',
        env('ALLOWED_ORIGINS', '*')
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
