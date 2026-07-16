<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** FR9 parity: the daily anchor hour, ported from v1's /settings. */
class SettingsTest extends TestCase
{
    use RefreshDatabase;

    private function authHeader(): array
    {
        $token = User::factory()->create()->createToken('device')->plainTextToken;

        return ['Authorization' => "Bearer $token"];
    }

    public function test_defaults_to_4_5(): void
    {
        $this->withHeaders($this->authHeader())
            ->getJson('/api/settings')
            ->assertOk()
            ->assertJson(['anchorHour' => 4.5]);
    }

    public function test_updates_and_persists(): void
    {
        $headers = $this->authHeader();

        $this->withHeaders($headers)
            ->postJson('/api/settings', ['anchorHour' => 6.25])
            ->assertOk()
            ->assertJson(['ok' => true, 'anchorHour' => 6.25]);

        $this->withHeaders($headers)
            ->getJson('/api/settings')
            ->assertJson(['anchorHour' => 6.25]);
    }

    public function test_rejects_out_of_range(): void
    {
        $this->withHeaders($this->authHeader())
            ->postJson('/api/settings', ['anchorHour' => 24])
            ->assertStatus(400);
    }

    public function test_requires_auth(): void
    {
        $this->getJson('/api/settings')->assertStatus(401);
    }
}
