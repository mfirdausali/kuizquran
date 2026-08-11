<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Build-plan step 27 (M9). A NON-SHIPPING gloss draft (v3-D15, edge case #189).
 *
 * NOTHING ON A SERVING PATH READS THIS MODEL. That is the guarantee, and it is
 * enforced by a test that greps the serving surfaces rather than by a comment:
 * see Tests\Feature\GlossDrafts\GlossDraftIsolationTest.
 */
class GlossDraft extends Model
{
    public $timestamps = false;

    /** The three states of the authoring workflow, in order. */
    public const DRAFT = 'draft';

    public const REVIEWED = 'reviewed';

    public const MERGED = 'merged';

    public const STATUSES = [self::DRAFT, self::REVIEWED, self::MERGED];

    protected $table = 'gloss_drafts';

    protected $fillable = [
        'surah', 'ayah', 'position', 'lang', 'text', 'status',
        'author_kind', 'authored_by', 'reviewed_by', 'reviewed_at', 'note',
        'created_at', 'updated_at',
    ];

    protected function casts(): array
    {
        return [
            'surah' => 'integer',
            'ayah' => 'integer',
            'position' => 'integer',
            'reviewed_at' => 'integer',
            'created_at' => 'integer',
            'updated_at' => 'integer',
        ];
    }

    /** @return HasMany<GlossDraftReview, $this> */
    public function reviews(): HasMany
    {
        return $this->hasMany(GlossDraftReview::class, 'gloss_draft_id');
    }
}
