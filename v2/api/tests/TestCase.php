<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Auth;

abstract class TestCase extends BaseTestCase
{
    /**
     * Sanctum's guard (Illuminate\Auth\RequestGuard) memoizes the resolved user
     * on ITSELF for as long as the guard instance lives — and because a single
     * test method reuses one Application container across every ->getJson()/
     * ->postJson() call (unlike production, where each HTTP request boots a
     * fresh process), that memoized user would otherwise leak into every later
     * call in the same test regardless of which bearer token it sends. Forcing
     * a fresh guard per call makes each test request re-authenticate from its
     * own Authorization header, matching real request semantics.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        Auth::forgetGuards();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
