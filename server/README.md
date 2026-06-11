# 安全生产月应用后端

这个服务同时提供两类能力：

1. 前端静态页面：打开 `http://服务器IP:8787/`
2. 飞书接口代理：提交成绩、读取排行榜、查询个人排名

## 本地运行

```powershell
cd C:\Users\admin\Documents\安全生产月应用\safety-month-2026\server
node server.js
```

然后浏览器打开：

```text
http://localhost:8787/
```

同一局域网手机访问时，把 `localhost` 换成运行电脑或服务器的 IP：

```text
http://192.168.x.x:8787/
```

## 配置

真实飞书凭证放在 `.env`：

```env
FEISHU_APP_ID=
FEISHU_APP_SECRET=
FEISHU_APP_TOKEN=
FEISHU_TABLE_ID=
PORT=8787
```

`.env` 不能提交到代码仓库，也不能放到前端。
