# proxy

ConoHa VPS 의 [conoha-proxy](https://github.com/crowdy/conoha-proxy) 리버스 프록시를 관리하는 명령 그룹입니다. proxy 모드 `conoha app deploy` 를 사용하려면 먼저 `proxy boot` 가 필요합니다.

## 공통 SSH 플래그

모든 `proxy` 서브커맨드에 적용:

| 플래그 | 설명 |
|---|---|
| `--user`, `-l` | SSH 사용자 (기본: `root`) |
| `--port`, `-p` | SSH 포트 (기본: `22`) |
| `--identity`, `-i` | SSH 비밀키 경로 |

---

## proxy boot

서버에 conoha-proxy 컨테이너를 설치 / 기동합니다. Let's Encrypt 자동 HTTPS, UFW 80/443 개방, `net.ipv4.ip_unprivileged_port_start=0` sysctl 적용까지 수행.

### 사용법

```bash
conoha proxy boot <서버> --acme-email <email> [flags]
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--acme-email` | Let's Encrypt 등록 이메일 (**필수**) |
| `--image` | conoha-proxy Docker 이미지 (기본: `ghcr.io/crowdy/conoha-proxy:latest`) |
| `--data-dir` | 호스트 데이터 디렉토리 (기본: `/var/lib/conoha-proxy`) |
| `--container` | Docker 컨테이너명 (기본: `conoha-proxy`) |
| `--wait-timeout` | healthy 대기 상한 (기본: `30s`, `0` 은 비활성화) |

### 동작

1. Docker / docker compose 존재 확인
2. `--data-dir` 생성 + UID 65532 (nonroot) 소유로 변경
3. UFW 80/443 개방, `net.ipv4.ip_unprivileged_port_start=0` 을 `/etc/sysctl.d/99-conoha-proxy.conf` 에 기록
4. `docker run` 으로 컨테이너 기동 (Admin Unix socket: `<data-dir>/admin.sock`)
5. `--wait-timeout` 내 3 회 연속 `running` + `/healthz` 200 으로 성공 판정. 타임아웃시 직전 20 줄 컨테이너 로그를 stderr 로 출력.

---

## proxy reboot

최신 이미지를 pull 하여 컨테이너를 재생성합니다. **모든 boot 플래그를 다시 지정** 해야 합니다 (컨테이너 설정은 인계되지 않음).

```bash
conoha proxy reboot <서버> --acme-email <email> [flags]
```

옵션은 `boot` 와 동일 (`--acme-email`, `--image`, `--data-dir`, `--container`, `--wait-timeout`).

---

## proxy start / stop / restart

이미지 pull 이나 설정 재적용 없이 컨테이너 기동 / 정지 / 재시작.

```bash
conoha proxy start   <서버> [--container <name>]
conoha proxy stop    <서버> [--container <name>]
conoha proxy restart <서버> [--container <name>]
```

| 플래그 | 설명 |
|---|---|
| `--container` | 컨테이너명 (기본: `conoha-proxy`) |

---

## proxy remove

컨테이너 삭제. 기본적으로 데이터 볼륨은 보존됨 (등록 서비스 / 인증서 / 상태 유지). `--purge` 로 완전 삭제.

### 사용법

```bash
conoha proxy remove <서버> [flags]
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--container` | 컨테이너명 (기본: `conoha-proxy`) |
| `--data-dir` | 호스트 데이터 디렉토리 (기본: `/var/lib/conoha-proxy`) |
| `--purge` | 데이터 디렉토리도 삭제 (인증서 / 서비스 / 상태 모두 사라짐) |

---

## proxy logs

```bash
conoha proxy logs <서버> [flags]
```

| 플래그 | 설명 |
|---|---|
| `--container` | 컨테이너명 (기본: `conoha-proxy`) |
| `--follow`, `-f` | 라이브 tail |
| `--tail` | 끝 라인 수 (기본: `0` = 전부) |

---

## proxy details

Admin API `/version` 을 Unix socket 경유로 호출한 결과 (버전 + readiness) 를 출력.

```bash
conoha proxy details <서버> [--data-dir <path>]
```

| 플래그 | 설명 |
|---|---|
| `--data-dir` | 호스트 데이터 디렉토리 (기본: `/var/lib/conoha-proxy`) |

---

## proxy services

서버에 등록된 proxy 서비스 일람. `app init` 된 앱과 그 `expose:` 블록이 `<app-name>` / `<app-name>-<label>` 로 표시됩니다.

```bash
conoha proxy services <서버> [--data-dir <path>]
```
