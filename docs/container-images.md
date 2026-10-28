# STA1N API 预构建镜像

镜像地址：`ghcr.io/sta1n156/new-api:latest`。

每次推送到 `main`，GitHub Actions 自动构建 `linux/amd64` 和 `linux/arm64` 镜像。两个架构均构建成功后才更新 `latest`；构建期间可继续使用上一个已发布版本。无需配置 Docker Hub 账号或密码。

每个版本同时保留 `sha-<提交 SHA 前 12 位>` 标签，方便固定版本或回退。镜像内的网站版本号为 `main-<提交 SHA 前 12 位>`。

## 首次发布

首次发布后，在 GitHub 个人主页的 **Packages → new-api → Package settings → Change visibility** 中设为 **Public**，即可匿名拉取。若保持私有，部署平台需要配置可读取该镜像的 GitHub 凭据。

构建状态见仓库 **Actions → Publish STA1N API container**。只有该流程成功后，新镜像才可用于部署，也可在此页面手动运行构建。

## 部署平台

选择 Docker 镜像部署，镜像填写：

```text
ghcr.io/sta1n156/new-api:latest
```

容器端口为 `3000`，保留现有环境变量、数据库连接及持久化卷。应用数据目录为 `/data`。更新时重新拉取镜像并重建应用容器，服务器不再安装前端依赖或编译 Go 程序。

## 已有 Docker Compose 部署

在现有 `docker-compose.yml` 旁放置仓库提供的 `docker-compose.ghcr.yml`，执行：

```sh
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml pull new-api
docker compose -f docker-compose.yml -f docker-compose.ghcr.yml up -d --no-deps new-api
```

覆盖文件仅指定应用镜像，沿用现有数据库、环境变量、端口和数据卷。不要用仓库的示例数据库密码替换生产环境配置。

需要固定版本时，把覆盖文件中的 `latest` 改成 Actions 构建摘要里的 `sha-xxxxxxxxxxxx` 标签，再执行上述命令。
