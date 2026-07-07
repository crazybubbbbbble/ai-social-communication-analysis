# 采集运行说明

## 1. 当前工具状态

主采集工具：

- `tools/MediaCrawler`
- 来源：`https://github.com/NanmiCoder/MediaCrawler`
- 本地依赖：已在 `tools/MediaCrawler/.venv` 中通过 `uv sync` 安装
- 验证命令：`uv run main.py --help` 已通过

备用工具：

- 小红书备用：`ReaJason/xhs`
- 使用条件：MediaCrawler 的小红书模块遇到登录态、风控或页面结构变化导致无法采集时再启用。

## 2. 合规边界

只采集公开可见内容，不采集私信、非公开聊天记录、付费内容或需要绕过权限的数据。

采集时需要控制数量和频率：

- 微博优先，目标是清洗后不少于 900 条。
- 小红书和知乎作为补充数据源。
- 微信公众号采用半自动整理，不作为大规模自动化采集对象。

所有作者信息只保留匿名编号，不保存真实用户名。

## 3. 关键词文件

项目关键词配置源：

```text
config/keywords.yaml
```

MediaCrawler 运行用关键词由脚本生成：

```powershell
python scripts/export_mediacrawler_keywords.py
```

生成文件：

```text
config/mediacrawler_keywords/weibo_p0.txt
config/mediacrawler_keywords/weibo_p0_comma.txt
config/mediacrawler_keywords/xhs_p1.txt
config/mediacrawler_keywords/xhs_p1_comma.txt
config/mediacrawler_keywords/zhihu_p1.txt
config/mediacrawler_keywords/zhihu_p1_comma.txt
config/mediacrawler_keywords/wechat_p2.txt
config/mediacrawler_keywords/wechat_p2_comma.txt
```

`*_comma.txt` 是英文逗号分隔版本，可直接传给 MediaCrawler 的 `--keywords` 参数。

## 4. MediaCrawler 基础命令

进入工具目录：

```powershell
cd tools\MediaCrawler
```

查看帮助：

```powershell
uv run main.py --help
```

微博关键词搜索示例：

```powershell
uv run main.py --platform wb --lt qrcode --type search --keywords "AI 回消息,AI 帮我回消息" --crawler_max_notes_count 20 --save_data_option csv --save_data_path "..\..\data\raw\mediacrawler"
```

小红书关键词搜索示例：

```powershell
uv run main.py --platform xhs --lt qrcode --type search --keywords "AI 恋爱军师,AI 嘴替" --crawler_max_notes_count 20 --save_data_option csv --save_data_path "..\..\data\raw\mediacrawler"
```

知乎关键词搜索示例：

```powershell
uv run main.py --platform zhihu --lt qrcode --type search --keywords "如何看待用 AI 帮忙回消息,AI 能不能分析聊天记录" --crawler_max_notes_count 20 --save_data_option csv --save_data_path "..\..\data\raw\mediacrawler"
```

## 5. 建议采集顺序

第一轮只做小规模连通性测试：

```text
微博：2 个关键词，每个最多 20 条
小红书：2 个关键词，每个最多 20 条
知乎：1-2 个关键词，每个最多 20 条
```

连通性测试通过后再扩大：

```text
微博：先采 P0 全部关键词，目标原始 1300-1800 条
小红书：采 P1 关键词，目标原始 500-800 条
知乎：采 P1 问题式关键词，目标原始 250-500 条
微信公众号：半自动整理 50-120 篇
```

## 6. 采集后处理

MediaCrawler 导出的原始数据需要映射到本项目统一 schema。

当前标准模板：

```text
data/raw/raw_data_weibo.csv
data/raw/raw_data_xhs.csv
data/raw/raw_data_zhihu.csv
data/raw/raw_data_wechat.csv
```

后续流程：

```powershell
python scripts/clean_text.py
python scripts/label_rules.py
python scripts/validate_schema.py
```

## 7. 失败备用路线

如果微博可用但小红书不可用：

- 微博继续作为主样本。
- 小红书改用 ReaJason/xhs 或半自动采集。
- 保留失败原因和截图，报告中说明平台限制。

如果知乎搜索噪声过大：

- 先人工筛选 10-20 个相关问题链接。
- 再抓问题下回答。
- 不把知乎作为数量主样本，只作为观点解释补充。

如果 MediaCrawler 登录态失败：

- 优先使用二维码登录。
- 若 CDP 模式连接已有浏览器失败，关闭已有浏览器后重试。
- 不绕过验证码、不绕过访问限制。
