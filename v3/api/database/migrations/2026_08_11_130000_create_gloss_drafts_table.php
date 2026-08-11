<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Build-plan step 27 (M9) — THE MS GLOSS AUTHORING TABLE, SCAFFOLDED EMPTY.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS TABLE IS NOT `overrides`, AND WHY THAT IS THE WHOLE POINT
 * ---------------------------------------------------------------------------
 * `overrides` is the SHIPPING correction layer: engine/src/overrides.ts reads
 * it, applyOverrides folds it into the corpus a learner drills against, and
 * corpus-compiler/src/hash.ts#ayahQariHashWithOverrides folds it into the hash
 * a qari signs. A row in `overrides` is, by construction, learner-visible.
 *
 * Malay glosses do not exist in any public source (v3-D15: the Quran.com API
 * silently returns ENGLISH for word_translation_language=ms — verified). All
 * ~11,300 must be AUTHORED, anchored to Basmeih. That is a content project
 * carrying doctrinal risk, staffed by a human reviewer who does not exist yet.
 *
 * So drafts get their OWN table with NO reader on any serving path. This is
 * edge case #189's mitigation made structural: "Agent machine-fills MS glosses
 * to be helpful -> scaffold-empty only; populated MS outside the flagged draft
 * table fails review." A draft cannot reach a learner because nothing that
 * serves a learner knows this table's name — not because a boolean says so.
 *
 * ---------------------------------------------------------------------------
 * THE TABLE SHIPS EMPTY. THERE IS NO SEEDER.
 * ---------------------------------------------------------------------------
 * BUILD-PLAN permits agents to draft into a flagged non-shipping table ONLY if
 * Firdaus ratifies that; absent ratification the surface is scaffold-empty.
 * No such ratification exists in DECISIONS.md as of this migration, so this
 * step ships the WORKFLOW and zero rows. GlossDraftsTest asserts the emptiness
 * is real rather than incidental.
 *
 * ---------------------------------------------------------------------------
 * WHY THE HASH CANNOT MOVE (v3-D15, and this is CHECKABLE, not asserted)
 * ---------------------------------------------------------------------------
 * A draft landing here must not amber a qari signature — otherwise the MS
 * content project would invalidate scholar hours already paid for, which is
 * edge case #155 exactly ("gloss.ms lands after the qari pass -> ALL sign-offs
 * amber at once").
 *
 * It cannot, for two independent reasons:
 *   1. ayahQariHash() hashes `w.gloss.en` only — `ms` is never read. Adding an
 *      ms value to a Word cannot change the digest.
 *   2. Nothing folds this table into a Word at all. Even the `ms` path through
 *      ayahQariHashWithOverrides (which reads `overrides`, not this table)
 *      rejects a non-"en" lang before touching the payload.
 * Both are proven by test, in TS and in PHP — see the tests named in
 * GlossDraftsController's docblock.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gloss_drafts', function (Blueprint $table) {
            $table->id();

            // The word coordinate. E-01: `surah` is present on every row, never
            // implied. A draft for 12:5 p3 and 103:5 p3 are different rows.
            $table->unsignedSmallInteger('surah');
            $table->unsignedSmallInteger('ayah');
            $table->unsignedSmallInteger('position');

            // The language being AUTHORED. Constrained by the controller to the
            // set of languages excluded from hash v1 — a draft may never be
            // written for a language the qari hash reads (see the controller's
            // HASH_READ_LANGS guard, which is the enforcement, and the reason
            // this column is not simply hardcoded to 'ms').
            $table->string('lang', 8);

            // The authored text. NULLABLE and NULL BY DEFAULT: a scaffolded row
            // is a coordinate awaiting authorship, not an empty string that
            // reads as "authored as blank". The distinction matters when the
            // review surface counts what is left to do.
            $table->text('text')->nullable();

            // draft -> reviewed -> merged. `merged` is terminal and, at hash v1,
            // UNREACHABLE by design: merging an ms gloss means it enters the
            // serving corpus, which v3-D15 defers past launch. The state exists
            // in the schema so the workflow is complete and the eventual merge
            // is a code change here rather than a schema migration under time
            // pressure. GlossDraftsController refuses the transition today and
            // says why.
            $table->string('status')->default('draft');

            // Provenance. v3-D22's reviewer_kind vocabulary, reused deliberately:
            // an AI-drafted gloss and a human-drafted gloss are different objects
            // for review purposes, and conflating them is how an unreviewed
            // machine gloss acquires apparent authority.
            $table->string('author_kind'); // ai | human
            $table->string('authored_by')->nullable();

            // Review trail. A reviewed row records WHO and WHEN; a rejected row
            // returns to `draft` carrying the note (append-only history lives in
            // gloss_draft_reviews, below — this is the current state).
            $table->string('reviewed_by')->nullable();
            $table->unsignedBigInteger('reviewed_at')->nullable();
            $table->text('note')->nullable();

            $table->unsignedBigInteger('created_at');
            $table->unsignedBigInteger('updated_at');

            // One live draft row per (surah, ayah, position, lang). A second
            // authored value for the same word is an EDIT of that row, with the
            // history in gloss_draft_reviews — not a competing row that some
            // future reader would have to pick between (which is how B4's
            // ordering class of bug is born).
            $table->unique(['surah', 'ayah', 'position', 'lang']);
            $table->index(['surah', 'status']);
        });

        // APPEND-ONLY review history. `gloss_drafts.status` is the current
        // state; this is how it got there. B3's lesson generalized: a single
        // mutable row with no history is how "reviewed" survives an edit that
        // invalidated it.
        Schema::create('gloss_draft_reviews', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('gloss_draft_id');

            // The transition that occurred, recorded as BOTH endpoints so a
            // replay never has to infer the previous state from row order.
            $table->string('from_status');
            $table->string('to_status');

            // The text AS REVIEWED. A reviewer signs off on bytes, not on a row
            // id — if the text later changes, this snapshot is what proves the
            // approval was for something else. Same principle as
            // ayah_verifications.content_hash.
            $table->text('text_at_review')->nullable();

            $table->string('actor_kind'); // ai | human
            $table->string('actor')->nullable();
            $table->text('note')->nullable();
            $table->unsignedBigInteger('created_at');

            $table->index(['gloss_draft_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gloss_draft_reviews');
        Schema::dropIfExists('gloss_drafts');
    }
};
