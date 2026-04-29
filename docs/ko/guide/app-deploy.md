# 앱 배포

`conoha app` 은 같은 VPS 에서 공존 가능한 두 가지 배포 모드를 제공합니다. `app init` 시점에 서버 측 마커 (`/opt/conoha/<name>/.conoha-mode`) 가 기록되고, 이후의 `deploy` / `status` / `logs` / `stop` / `restart` / `destroy` / `rollback` 은 자동으로 해당 모드로 동작합니다 (모드 플래그를 다시 지정할 필요 없음).

## 모드 비교

|  | proxy (blue/green) | no-proxy (flat) |
|---|---|---|
| 기본값 | ✓ |  |
| 용도 | HTTPS 공개 앱 | 테스트 / 사내 / 비-HTTP |
| `conoha.yml` | 필요 | 불필요 |
| `conoha proxy boot` | 필요 | 불필요 |
| DNS | 필요 | 불필요 |
| TLS | Let's Encrypt 자동 | 직접 구성 |
| 레이아웃 | `/opt/conoha/<name>/<slot>/` | `/opt/conoha/<name>/` |
| rollback | ✓ (drain 윈도우 내) | × |

## proxy 모드

[conoha-proxy](https://github.com/crowdy/conoha-proxy) 가 Let's Encrypt HTTPS, Host 헤더 라우팅, drain 윈도우 내 즉시 롤백을 제공합니다. proxy 측 셋업은 일본어 가이드 ([conoha-proxy セットアップ](/guide/proxy-setup)) 를 참조하세요.

### `conoha.yml` 작성

리포지토리 루트에 둡니다.

```yaml
name: myapp                   # DNS-1123 라벨 (소문자 영숫자 + 하이픈, 1-63자)
hosts:
  - app.example.com           # 여러 개 가능, 중복 불가
web:
  service: web                # compose 파일의 서비스명과 일치 필요
  port: 8080                  # 컨테이너 측 리슨 포트 (1-65535)
# --- 이하 옵션 ---
compose_file: docker-compose.yml   # 미지정시 conoha-docker-compose.yml → docker-compose.yml → compose.yml 순으로 자동 검색
accessories: [db, redis]           # web 과 같은 네트워크에 연결되는 부가 서비스
health:
  path: /healthz
  interval_ms: 1000
  timeout_ms: 500
  healthy_threshold: 2
  unhealthy_threshold: 3
deploy:
  drain_ms: 5000                   # 구 슬롯 drain 윈도우 (ms, 미지정시 30000)
```

### proxy 부팅 후 앱 등록

```bash
# 1. proxy 컨테이너를 VPS 에 부팅 (이미 띄워져 있으면 스킵)
conoha proxy boot my-server --acme-email ops@example.com

# 2. DNS A 레코드를 VPS IP 로 설정
#    DNS 가 VPS 를 가리키지 않으면 app init 자체는 성공해도
#    인증서 발급은 실패하여 해당 호스트의 HTTPS 가 동작하지 않습니다.

# 3. 등록 + 배포
conoha app init my-server
conoha app deploy my-server
```

롤백 (drain 윈도우 내):

```bash
conoha app rollback my-server
```

### slot 자동 suffix

`--slot <id>` 로 slot ID 를 고정할 수 있습니다. 형식: `[a-z0-9][a-z0-9-]{0,63}`. 기본은 git short SHA 또는 timestamp.

기본값이 기존 compose 프로젝트와 충돌하면 CLI 가 자동으로 `-2` / `-3` suffix 를 붙여 회피합니다 (drain 중인 슬롯을 파괴적으로 덮어쓰지 않음). `--slot` 으로 명시 재사용시 작업 디렉토리를 삭제 후 재전개합니다.

### multi-host / `expose:` 블록

별도 호스트명에서 서비스되는 서브도메인 (admin UI, 웹훅 수신 등) 은 `expose:` 로 선언할 수 있습니다. 각 블록은 `<name>-<label>` 라는 이름의 독립 proxy service 로 등록됩니다.

```yaml
name: gitea
hosts: [gitea.example.com]
web:
  service: gitea
  port: 3000
expose:
  - label: dex                    # proxy service-name suffix (<name>-<label>)
    host: dex.example.com         # hosts[] 와 다른 expose 와 중복 불가
    service: dex                  # compose 서비스명 (web.service / accessories 와 상호 배타)
    port: 5556
    blue_green: false             # true (기본) 면 슬롯 회전 대상, false 면 액세서리 (단발 기동)
accessories: [db]
```

- `app status` 는 root 와 각 expose 블록을 표시. `--format json` 은 `{root, expose: [...]}` 반환.
- `app rollback` 은 기본적으로 root + 모든 블록을 선언 역순으로 롤백. `--target=<label>` (또는 `--target=web`) 로 단일 블록 지정 가능. drain 윈도우가 닫힌 블록은 경고만 표시하고 스킵.
- v0.6.0 이전 CLI 는 `expose:` 를 silently 무시. multi-host 사용시 CI 에서 v0.6.0 이상으로 고정하세요.

## no-proxy 모드

`conoha.yml` / proxy / DNS 가 불필요한 최단 경로. SSH 로 `docker compose up -d --build` 를 실행하는 것과 동일.

```bash
# 초기화 (Docker / Compose 존재 검증 + 마커 기록. 설치는 안 함)
conoha app init my-server --app-name myapp --no-proxy

# 배포 (현재 디렉터리 tar 전송 → /opt/conoha/myapp/ 전개 → docker compose up -d --build)
conoha app deploy my-server --app-name myapp --no-proxy
```

`init` 으로 마커가 기록된 후에는 `status` / `logs` / `stop` / `restart` / `destroy` 에 `--no-proxy` 를 다시 지정할 필요가 없습니다.

::: warning Docker 는 사전 설치 필요
no-proxy `app init` 은 Docker / Compose 의 존재만 검증합니다. Docker 가 없는 VPS 에서는 `conoha server create --user-data ./install-docker.sh` 등으로 사전에 설치해두세요.
:::

재배포는 tar 덮어쓰기만 수행합니다. 리포지토리에서 삭제한 파일은 서버에 그대로 남습니다 (`.env.server` 와 named volume bind mount 보호 목적). 오래된 파일은 `ssh <server> rm /opt/conoha/<name>/<path>` 로 개별 삭제하세요.

no-proxy 모드는 blue/green swap 이 없어 `rollback` 을 사용할 수 없습니다 (`rollback is not supported in no-proxy mode` 에러). 이전 커밋을 checkout 후 다시 deploy 하세요.

## 모드 전환

destroy 후 반대 모드로 다시 init.

```bash
conoha app destroy my-server --app-name myapp
conoha app init my-server --app-name myapp --no-proxy
```

같은 VPS 에서 `<app-name>` 이 다르면 proxy / no-proxy 를 병행 가능.

## 환경 변수

`conoha app env set` 은 두 모드에서 모두 동작하며 서버측 `/opt/conoha/<app>.env.server` 에 기록됩니다. **현재 proxy 모드 배포에는 값이 반영되지 않습니다** ([#94](https://github.com/crowdy/conoha-cli/issues/94) 에서 재설계 예정). proxy 모드에서는 compose 의 `environment:` / `env_file:` 을 사용하세요.

## 관련 페이지

- [`app` 레퍼런스](/ko/reference/app) — 플래그 상세
- [`proxy` 레퍼런스](/ko/reference/proxy) — proxy 명령 상세
- [`server` 레퍼런스](/ko/reference/server) — `--for proxy` 프리셋 포함 서버 명령
