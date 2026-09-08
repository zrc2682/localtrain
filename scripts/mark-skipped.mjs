import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY = path.resolve(__dirname, '../docs/cve-registry.json');

const reasons = {
  'spring-cloud-function': 'vulhub/spring-cloud-function:3.2.1 镜像拉取持续 522/超时，且无本地 Java 基础镜像可替代',
  'struts2-s2-045': 'vulhub/struts2:2.3.24 等镜像拉取 522/超时，缺少本地 Java 基础镜像',
  'struts2-s2-061': 'vulhub/struts2:2.5.10 等镜像拉取 522/超时，缺少本地 Java 基础镜像',
  'struts2-xstream': 'vulhub/struts2 REST XStream 镜像拉取 522/超时，缺少本地 Java 基础镜像',
  'dubbo': 'vulhub/dubbo 镜像拉取 522/超时，缺少本地 Java 基础镜像',
  'h2-jndi': '需要 H2 Console 与 JNDI 利用链，缺少可用 Java 基础镜像/依赖下载超时',
  'laravel-ignition': '需要完整 Laravel + Ignition 环境，composer 依赖下载慢/镜像拉取超时',
  'drupalgeddon2': 'Drupal 官方镜像体积大且拉取超时',
  'wp-bricks': 'WordPress + Bricks Builder 插件构建复杂，官方镜像拉取超时',
  'wp-automatic': 'WordPress + WP Automatic 插件构建复杂，官方镜像拉取超时',
  'activemq': 'ActiveMQ 官方/漏洞镜像拉取超时',
  'postgresql-copy': 'postgres:11.2-alpine 等漏洞版本镜像拉取超时',
  'mysql-udf': 'mysql:5.7 镜像拉取意外 EOF/超时',
  'grafana': 'vulhub/grafana:8.2.0 镜像拉取 522/超时',
  'confluence': 'vulhub/confluence 镜像拉取 522/超时',
  'ofbiz': 'vulhub/ofbiz 镜像拉取 522/超时',
  'apisix': 'vulhub/apisix 镜像拉取 522/超时',
  'kibana': 'vulhub/kibana 镜像拉取 522/超时',
  'rails': 'ruby:3.1-slim 等基础镜像拉取超时',
  'urllib-crlf': '需要旧版 Python urllib（3.6.8 之前）才能复现 CRLF，合适版本镜像拉取超时/Redis 集成复杂',
  'gitlab': 'vulhub/gitlab 镜像体积巨大，拉取 522/超时',
  'git': 'CVE-2021-21300 需要特定 git 客户端/服务端配合，本地复现链路复杂',
  'airflow': 'vulhub/airflow 镜像拉取 522/超时',
  'jenkins': 'vulhub/jenkins 镜像拉取 522/超时',
  'metabase': 'vulhub/metabase 镜像拉取 522/超时',
  'zabbix': 'vulhub/zabbix 镜像拉取 522/超时',
};

const registry = JSON.parse(fs.readFileSync(REGISTRY, 'utf-8'));
let count = 0;
for (const c of registry.challenges) {
  if (c.status === 'pending') {
    c.status = 'skipped';
    c.skipReason = reasons[c.id] || '镜像源超时或本地复现条件不足';
    count++;
  }
}
fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2));
console.log(`已标记 ${count} 个 pending 挑战为 skipped`);
