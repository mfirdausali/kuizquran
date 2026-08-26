<?php

namespace Tests\Feature\Settings;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * `SettingsController` (v3-D140) — the write half of the daily anchor hour.
 * `anchor_hour`/`anchorHour` have existed since the Laravel skeleton (step
 * 13) but never had a route until now.
 */
class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_both_routes_require_authentication(): void
    {
        $this->getJson('/api/settings')->assertStatus(401);
        $this->postJson('/api/settings', ['anchorHour' => 8])->assertStatus(401);
    }

    public function test_show_returns_the_callers_own_default(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->getJson('/api/settings');

        $response->assertStatus(200)->assertJson(['anchorHour' => 4.5]);
    }

    public function test_update_persists_and_is_read_back(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $update = $this->postJson('/api/settings', ['anchorHour' => 8]);
        $update->assertStatus(200)->assertJson(['ok' => true, 'anchorHour' => 8]);

        $again = $this->getJson('/api/settings');
        $again->assertStatus(200)->assertJson(['anchorHour' => 8]);

        $this->assertSame(8.0, $user->fresh()->anchor_hour);
    }

    /** Half-hours are the whole point (v2's own ANCHOR_CHOICES: "Early morning" = 5.5). */
    public function test_update_accepts_a_fractional_hour(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/settings', ['anchorHour' => 22.5]);

        $response->assertStatus(200)->assertJson(['ok' => true, 'anchorHour' => 22.5]);
    }

    public function test_update_rejects_a_non_numeric_value(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $response = $this->postJson('/api/settings', ['anchorHour' => 'evening']);

        $response->assertStatus(400)->assertJson(['error' => 'anchorHour (number, 0-24) required']);
        $this->assertSame(4.5, $user->fresh()->anchor_hour);
    }

    public function test_update_rejects_an_out_of_range_value(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $this->postJson('/api/settings', ['anchorHour' => 24])->assertStatus(400);
        $this->postJson('/api/settings', ['anchorHour' => -1])->assertStatus(400);
        $this->assertSame(4.5, $user->fresh()->anchor_hour);
    }

    /** The id always comes from the token — never the body, never another caller's row. */
    public function test_update_never_touches_another_users_row(): void
    {
        $me = User::factory()->create();
        $other = User::factory()->create(['anchor_hour' => 4.5]);
        Sanctum::actingAs($me);

        $this->postJson('/api/settings', ['anchorHour' => 20, 'user_id' => $other->id])
            ->assertStatus(200);

        $this->assertSame(4.5, $other->fresh()->anchor_hour);
        $this->assertSame(20.0, $me->fresh()->anchor_hour);
    }
}
