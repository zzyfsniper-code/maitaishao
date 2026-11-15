# 接口与数据约定

所有写入使用 `POST` 和 `application/json`。本机接口同源访问；共享入口经独立口令网关，允许指定 GitHub Pages 来源。成功返回相关结果和最新 `state`；失败返回 `{ "error": "说明" }`。主要错误码：400 无效输入、409 过期版本、422 无可行候选/来源不可读、429 模型忙。

日期 `YYYY-MM-DD`，周以周一为起始。餐次固定 `breakfast / lunch / dinner`。成员、菜谱使用稳定 ID。份数允许小数，食材明确数量和单位，采购按 `实际份数 / 菜谱基础份数` 缩放。

| 接口 | 输入 | 行为 |
| --- | --- | --- |
| GET `/api/state` | 无 | 全部家庭状态、默认周、Agent 不含密钥的配置、菜单冲突检查、按家庭范围统计的 nutrition |
| GET `/api/health` | 无 | 服务标识与连接可用性；不是模型真实调用证明 |
| POST `/api/members/save` | `revision, member` | 保存档案、`avatar` 图片、`profileTags`、固定规律；不改旧菜单 |
| POST `/api/attendance` | `revision, week, date, kind, memberIds, portions` | 生成指定餐次的临时调整建议，确认前不修改规律或菜单 |
| POST `/api/menus/generate` | `week, version` | 无旧菜单直接生成；有旧菜单则产生待确认建议 |
| POST `/api/menus/replace` | `week, date, kind, recipeId, version` | 同类合规替换，立即生效并保留撤销版本 |
| POST `/api/menus/undo` | `week, version` | 在当前档案/规则仍允许时恢复上一版菜单 |
| POST `/api/chat` | `text, week` | 明确指令校验后直接保存；只有 execution=preview 时保留待确认建议。自动执行的 proposal 带 automatic=true、status=confirmed |
| POST `/api/proposals/confirm` | `id` | 同时检查数据修订号与菜单版本，然后应用建议 |
| POST `/api/proposals/cancel` | `id` | 取消建议 |
| GET `/api/shopping?start=…&end=…` | 日期范围 | 派生采购清单，返回对应菜单版本 |
| POST `/api/imports/draft` | `week, memberId, schoolGroup?, type, text, image?` | 识别指定班级午餐，保存草稿与 sourceImages 原图、provider、toolCalls；图片为 data URL |
| POST `/api/imports/confirm` | `revision, id, records` | 确认校正记录；同成员同日确认记录被新记录替代 |
| POST `/api/imports/resolve` | `id` | 只对重复的晚餐提出调整，不自动覆盖 |
| POST `/api/recipes/draft` | `type, text, image?` | 真实模型生成新菜草稿 |
| POST `/api/recipes/save` | `revision, recipe, confirm` | 经 MCP 保存新草稿、确认或更新已确认菜谱；recipe.knowledgeVersion 防止旧表单覆盖，旧版本留存 |
| GET `/api/knowledge/search?q=…&status=…` | 关键词、all/draft/confirmed | 经 MCP 查询菜名、食材、标签、做法、来源 |
| GET `/api/knowledge/history?id=…` | 稳定菜谱 ID | 经 MCP 返回历次完整版本，按版本倒序 |
| POST `/api/feedback` | `memberId, date, meal, text` | 保存单次反馈 |
| POST `/api/feedback/confirm` | `revision, id` | 确认长期禁用建议 |
| POST `/api/agent/config` | `provider, baseUrl, model, apiKey` | 后台保存连接；空 Key 保留已有值，不返回 Key |
| POST `/api/agent/test` | `{}` | 真实模型连接测试 |
| POST `/api/settings` | `revision, scheduleTime, timezone, scheduleEnabled` | 配置每周日的后台生成任务 |
| POST `/api/schedule/run` | `{}` | 执行一次目标为下周的后台任务；已有菜单跳过 |
| POST `/api/documents` | `kind, name, content` | 保存待接入规则文档，不执行其中的指令 |

## 版本保护

整个数据库状态有 `revision`；每周菜单另有 `version`。耗时 Agent 调用开始时记录数据版本，返回后若状态已变化则拒绝应用。调整建议在用户确认时再次核对版本，禁止旧响应覆盖新操作。规则、成员、导入等变化后，旧菜单保留并显示核对提示。

## 形象与标签

成员 `avatar` 保存 PNG/JPEG/WebP data URL，前端按原始比例压缩到最长边 512px；禁止将形象数据作为文字发送给对话模型。`profileTags` 保存预设或自定义标签，不得从“控糖”等词自行生成医疗或营养阈值。`allergies` 与 `restrictions` 是显式硬约束；`likes`、`dislikes` 和部分口味标签影响偏好排序。

## Agent 的职责

Pi 可调用 get_kitchen_context、find_recipes、preview_menu_adjustment、preview_kitchen_update、get_shopping_list 及按文章范围提供的 read_source_image，然后返回固定 schema 的操作意图、午餐识别或菜谱草稿。菜单计算、份量缩放、硬约束、保存和采购在服务端执行。模型失败时显示错误，不把本地模板回复冒充真实模型结果。新菜和外部午餐必须经过确认才能参与排菜。

共享网关要求 `Authorization: Bearer <组员口令>`，口令错误返回 401，次数过多返回 429，来源不允许或远程改模型配置返回 403。模型 Key 永远不作为此口令使用。

## 菜谱知识迁移

`recipe_knowledge` 是当前菜谱，`recipe_knowledge_history` 保留版本，`knowledge_migration` 保存首次迁移前完整状态。原有 recipes 字段迁移一次，普通应用状态保存不再写菜谱；菜谱变更经 MCP 原子保存，并同时递增全局 revision。网页 state 的菜谱由 MCP 查询返回。详见《Agent与知识库架构》。


## 菜数与重复间隔（2026-11-15 更新）

午晚餐 `dishCount` 为菜的数量，取 1–5，另加一份主食；0 使用默认五道菜。默认至少两荤两素，第五道从符合限制的荤菜或素菜中选择。全周请求保持早餐主食加蛋白质的两项搭配。同菜间隔为一个完整自然日，可隔天再吃，仍禁止同日及相邻日重复，保留基础早餐例外。执行规则版本为 `demo-v2`。
