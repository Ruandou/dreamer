-- 合并迁移后一次性清理：从 _prisma_migrations 删除旧迁移名（不改业务表）。
-- 推荐：`pnpm --filter @dreamer/backend run db:migrate:squash-drift-rows`，再 `db:migrate:deploy`（见 AGENTS.md）。

DELETE FROM "_prisma_migrations"
WHERE migration_name IN (
  '20260412120000_add_project_episode_synopsis',
  '20260413000000_add_character_voice_fields',
  '20260413120000_add_location_image_url',
  '20260413130000_add_composition_episode_id',
  '20260414100000_baseline_schema_extensions',
  '20260415120000_story_context_job_type'
);
