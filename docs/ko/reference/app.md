# app

애플리케이션 배포 및 관리 명령. 대부분의 서브커맨드는 `--proxy` / `--no-proxy` 로 모드를 강제할 수 있습니다 (서버측 마커와 불일치시 에러).

## app init

conoha-proxy 에 앱을 등록 (proxy 모드) 하거나 no-proxy 마커를 기록합니다.

### 사용법

```bash
conoha app init <서버> [flags]
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--app-name` | 애플리케이션명 |
| `--proxy` | proxy 모드 강제 (마커 불일치시 에러) |
| `--no-proxy` | no-proxy 모드 강제 (`--proxy` 와 상호 배타) |
| `--data-dir` | 서버측 conoha-proxy 데이터 디렉토리 (기본값: `/var/lib/conoha-proxy`) |
| `--insecure` | known_hosts 검증 스킵 (TOFU 비활성화) |
| `--identity`, `-i` | SSH 비밀키 경로 |
| `--user`, `-l` | SSH 사용자 (기본값: `root`) |
| `--port`, `-p` | SSH 포트 (기본값: `22`) |

---

## app deploy

현재 디렉토리를 배포합니다.

### 사용법

```bash
conoha app deploy <서버> [flags]
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--app-name` | 애플리케이션명 |
| `--proxy` / `--no-proxy` | 모드 강제 |
| `--slot` | slot ID 고정 (기본: git short SHA / timestamp; 형식 `[a-z0-9][a-z0-9-]{0,63}`). 기존 슬롯 재사용시 작업 디렉토리 삭제 후 재전개. |
| `--data-dir` | 서버측 proxy 데이터 디렉토리 |
| `--insecure` | known_hosts TOFU 스킵 |
| `--identity`, `-i` / `--user`, `-l` / `--port`, `-p` | SSH 연결 플래그 |

### 동작

1. 프로젝트 디렉토리를 `tar` (`. dockerignore` 패턴 + `.git/` 제외)
2. SSH 로 업로드
3. (no-proxy) `.env` 합성: 리포지토리 `.env` → `.env.server` (마지막 우선)
4. `docker compose up -d --build`

---

## app rollback

drain 윈도우 내 직전 슬롯으로 복귀. **proxy 모드 전용.** `expose:` 블록을 가진 multi-host 앱은 기본적으로 root + 모든 블록을 선언 역순으로 롤백합니다.

### 사용법

```bash
conoha app rollback <서버> [flags]
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--app-name` | 애플리케이션명 |
| `--proxy` / `--no-proxy` | 모드 강제 |
| `--target` | 단일 블록만 롤백: `web` 또는 `expose:` 의 label (기본: 전체) |
| `--drain-ms` | 복귀 대상의 drain 윈도우 ms 덮어쓰기 (`0` = proxy 기본) |
| `--data-dir` | 서버측 proxy 데이터 디렉토리 |
| `--insecure` | known_hosts TOFU 스킵 |
| SSH 플래그 | `app deploy` 와 동일 |

### 제한사항

- no-proxy 모드 사용 불가 (`rollback is not supported in no-proxy mode` 에러)
- drain 윈도우를 지난 슬롯은 롤백 불가. 이전 커밋 checkout 후 재배포.

---

## app logs

```bash
conoha app logs <서버> [flags]
```

| 플래그 | 설명 |
|---|---|
| `--app-name` | 애플리케이션명 |
| `--follow`, `-f` | 라이브 tail |
| `--tail` | 끝 라인 수 (기본: 100) |
| `--service` | 특정 compose 서비스 |
| SSH + 모드 플래그 | 동일 |

---

## app status

### 사용법

```bash
conoha app status <서버> [flags]
```

### `--format json` 스키마

```json
{
  "root": { "service": "web", "containers": [...] },
  "expose": [
    { "label": "dex", "service": "dex", "containers": [...] }
  ]
}
```

multi-host 가 아니면 `"expose": []`. `conoha.yml` 이 로컬에 없으면 `root` 만 반환되고 `expose` 필드는 생략됩니다 (v0.7.0+ graceful degrade).

---

## app stop / app restart

```bash
conoha app stop    <서버> [flags]
conoha app restart <서버> [flags]
```

`--app-name`, `--proxy` / `--no-proxy`, `--insecure`, SSH 플래그 사용 가능.

---

## app env set / get / list / unset

`/opt/conoha/<app>.env.server` 에 저장되는 서버측 환경 변수 관리.

```bash
conoha app env set   <서버> --app-name <app> KEY=VALUE [KEY=VALUE...]
conoha app env get   <서버> --app-name <app> KEY
conoha app env list  <서버> --app-name <app>
conoha app env unset <서버> --app-name <app> KEY [KEY...]
```

::: warning proxy 모드 제한
`app env` 는 두 모드에서 파일을 기록하지만 **proxy 모드 배포에는 값이 반영되지 않습니다** ([#94](https://github.com/crowdy/conoha-cli/issues/94) 에서 재설계 예정). proxy 모드에서는 compose `environment:` / `env_file:` 사용.
:::

---

## app list

```bash
conoha app list <서버> [flags]
```

---

## app destroy

앱과 데이터를 모두 삭제합니다.

### 옵션

| 플래그 | 설명 |
|---|---|
| `--app-name` | 애플리케이션명 |
| `--yes`, `-y` | 확인 프롬프트 스킵 |
| `--proxy` / `--no-proxy` | 모드 강제 |
| `--data-dir` | 서버측 proxy 데이터 디렉토리 |
| `--insecure` | TOFU 스킵 |
| SSH 플래그 | 동일 |

### 삭제되는 항목

- 컨테이너 (정지 + 삭제)
- 작업 디렉토리 (`/opt/conoha/<app>/`)
- Git 리포지토리 (`/opt/conoha/<app>.git/`)
- 환경 파일 (`/opt/conoha/<app>.env.server`)

---

## app reset

`app destroy` → `app init` → `app deploy` 를 1 명령으로 실행.

```bash
conoha app reset <서버> [flags]
```

옵션은 `app destroy` 와 동일하며 `--slot` (deploy 단계) 과 `--data-dir` 추가 가능.
