DROP INDEX IF EXISTS idx_search_results_snapshot_position;
DROP INDEX IF EXISTS idx_search_snapshots_user_created_at;
DROP INDEX IF EXISTS idx_keyword_runs_user_created_at;

DROP INDEX IF EXISTS idx_product_keyword_runs_user_created_at;
DROP INDEX IF EXISTS idx_product_keyword_runs_product_id;
DROP INDEX IF EXISTS idx_product_keyword_rank_cache_expires_at;

DROP INDEX IF EXISTS idx_product_seo_audits_user_created_at;
DROP INDEX IF EXISTS idx_product_seo_audits_seller_name;
DROP INDEX IF EXISTS idx_product_seo_audits_primary_keyword;

DROP INDEX IF EXISTS idx_rank_tracking_targets_user_active;
DROP INDEX IF EXISTS idx_rank_tracking_targets_next_check;
DROP INDEX IF EXISTS idx_rank_tracking_targets_product;
DROP INDEX IF EXISTS idx_rank_tracking_checks_target_checked;
DROP INDEX IF EXISTS idx_rank_tracking_checks_user_checked;

DROP TABLE IF EXISTS search_results;
DROP TABLE IF EXISTS keyword_runs;
DROP TABLE IF EXISTS search_snapshots;

DROP TABLE IF EXISTS product_keyword_rank_cache;
DROP TABLE IF EXISTS product_keyword_runs;
DROP TABLE IF EXISTS product_seo_audits;

DROP TABLE IF EXISTS rank_tracking_checks;
DROP TABLE IF EXISTS rank_tracking_targets;
