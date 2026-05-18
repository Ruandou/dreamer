API: POST /api/templates/:id/generate-outline

新增支持参数：

- `autoGenerateFirstEpisode` (boolean, optional)

行为：

- 当 `autoGenerateFirstEpisode=true` 时，服务端会在保存大纲并创建/更新 episode stub 后，创建一个 `PipelineJob(jobType='script-first')` 并将任务入队到后台 pipeline（非阻塞请求）。
- 若项目当前存在进行中的大纲/剧本解析任务（`script-first`/`script-batch`/`parse-script`），接口会返回 409 并附带说明。
- 成功入队后返回 `{ outline, template, jobId }`。

前端变更：

- 模板生成表单新增 `autoGenerateFirstEpisode` 开关（默认 false），勾选后会把该字段连同其他参数一并发送到服务器。

项目状态：

- 当模板接口自动入队第一集时，服务端会将 `Project.status` 置为 `writing`，表示正在生成剧本（第一集）。
- 当 `parse-script` 任务完成后，服务端会把 `Project.status` 更新为 `final`。

备注：

- 该变更将模板入口与 pipeline 作业衔接，避免在 HTTP 请求中同步执行耗时的 AI 生成任务，从而改善前端体验与任务可观测性。
