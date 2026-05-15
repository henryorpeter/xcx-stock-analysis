# XCX 股票智能分析系统

这是一个面向 A 股、港股、美股的股票智能分析项目，支持数据抓取、技术分析、新闻检索、LLM 分析、报告生成和通知推送。

## 核心能力

- 多市场股票分析与报告生成
- Web 和桌面端管理界面
- FastAPI 服务与自动化任务
- 多数据源适配与降级
- 支持企业微信、飞书、Telegram、Discord、Slack、邮件等通知

## 适用场景

- 每日自选股分析
- 盘前和盘后复盘
- 策略验证与回测
- 本地或云端部署的分析工作台

## 快速开始

```bash
pip install -r requirements.txt
python main.py --serve-only
```

打开以下地址：

- `http://127.0.0.1:8000`
- `http://127.0.0.1:8000/docs`

## 主要入口

- `main.py`：分析任务主入口
- `server.py`：FastAPI 服务入口
- `apps/dsa-web/`：Web 前端
- `apps/dsa-desktop/`：桌面端

## 项目结构

- `src/`：核心业务逻辑
- `api/`：FastAPI 接口
- `data_provider/`：多数据源适配
- `bot/`：机器人接入
- `docs/`：文档与部署说明

## 文档

- `docs/full-guide.md`
- `docs/README_EN.md`
- `docs/README_CHT.md`
- `docs/INDEX.md`

## 许可证

MIT
