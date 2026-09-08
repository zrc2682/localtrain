# 题目镜像归档目录

本目录用于存放题目 Docker 镜像的归档文件（`.tar`）。

LocalTrain 启动题目环境时，会优先查找本地 Docker 镜像；如果镜像不存在，则自动从本目录加载同名的 `.tar` 归档。

## 文件名规则

将镜像名中的特殊字符（如 `/`、`:`）替换为下划线 `_`，并追加 `.tar` 后缀。

| 镜像名 | 归档文件名 |
|--------|-----------|
| `example-web:latest` | `example-web_latest.tar` |
| `localtrain/web-example:latest` | `localtrain_web-example_latest.tar` |

## 导出镜像

构建好题目镜像后，使用 `docker save` 导出到本目录：

```bash
# 示例：导出 example-web 镜像
docker save -o docker-images/example-web_latest.tar example-web:latest
```

## 加载镜像

LocalTrain 会在启动环境时自动加载。也可以手动加载：

```bash
docker load -i docker-images/example-web_latest.tar
```
