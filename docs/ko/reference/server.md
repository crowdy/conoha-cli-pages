# server

서버 (VM) 관리 명령 그룹.

## 서버 식별자

대부분의 server 명령은 `<서버명-또는-ID>` 를 인자로 받습니다.

| 형식 | 예 | 비고 |
|---|---|---|
| UUID | `1a2b3c4d-...-1e2f3a4b5c6d` | 서버 ID (정확히 일치) |
| VM 이름 | `vps-1234567` | ConoHa 가 자동 부여 |
| 네임 태그 | `my-web-server` | 사용자 설정 이름 (`instance_name_tag`) |

VM 이름과 네임 태그가 동일 문자열인 경우 VM 이름이 우선. 동일 네임 태그를 가진 서버가 복수면 에러 → UUID 사용.

---

## server list

```bash
conoha server list
```

예:

```bash
conoha server list --format json
conoha server list --filter status=ACTIVE
```

---

## server show

```bash
conoha server show <서버>
```

---

## server create

### 사용법

```bash
conoha server create [flags]
```

### 옵션

| 플래그 | 설명 | 필수 |
|---|---|---|
| `--name` | 서버명 | ○ |
| `--flavor` | 플레이버 ID 또는 이름 (예: `g2l-t-c2m1d100`; 미지정시 대화 선택) |  |
| `--image` | 이미지명 또는 ID (미지정시 대화 선택) |  |
| `--key-name` | SSH 키페어명 (미지정시 대화 선택) |  |
| `--volume` | 기존 부트 볼륨 ID |  |
| `--security-group` | 보안 그룹명 (반복 가능; 미지정시 대화 선택) |  |
| `--for` | 프리셋명 (flavor / image / security-group 일괄 지정; 후술) |  |
| `--admin-pass` | 관리자 패스워드 |  |
| `--user-data` / `--user-data-raw` / `--user-data-url` | 기동 스크립트 (파일 / 인라인 / URL `#include`) — 동시 1개만, 최대 16 KiB |  |
| `--wait` / `--wait-timeout` | ACTIVE 까지 대기 |  |

::: tip 비대화 모드
TTY 가 없는 환경 (CI / 스크립트) 에서는 `--flavor` / `--image` / `--key-name` / `--security-group` 을 명시. 부트 볼륨은 `<서버명>-boot` 로 자동 생성 (사이즈는 플레이버에서 결정; `g2l-t-c2m1d100` → 100 GB). `--yes` 로 확인 스킵.
:::

### 프리셋 (`--for`) {#preset-for}

`--for <preset>` 으로 flavor / image / security-group 을 일괄 지정. 명시 플래그가 항상 우선 — 명시 `--security-group` 은 프리셋 리스트를 **치환** (추가가 아님).

| 프리셋 | 용도 | flavor | image | security-group |
|---|---|---|---|---|
| `proxy` | conoha-proxy 호스트 VPS | `g2l-t-c3m2` | 최신 active `vmi-docker-*-ubuntu-*-amd64` | `default,IPv4v6-SSH,IPv4v6-Web,IPv4v6-ICMP` |

이미지는 프리셋 적용 시점에 `ListImages` 로 동적 해석 (사전식 내림차순). CLI 바이너리에 오래된 ID 가 박히지 않도록 한 구조입니다.

```bash
conoha server create --no-input --yes --wait \
  --name myproxy --key-name my-key --for proxy
```

---

## server delete

서버 삭제 (확인 프롬프트 있음).

### 사용법

```bash
conoha server delete <서버> [flags]
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--delete-boot-volume` | 서버 삭제 후 부트 볼륨도 삭제 (`-y` 와 병용 권장) |

::: tip 부트 볼륨 고아 방지
비대화 모드로 자동 생성된 부트 볼륨은 서버 삭제 후 남습니다. 같은 이름으로 재생성시 볼륨 중복명 경고에 부딪힙니다. `--delete-boot-volume` 으로 동시 삭제하세요.
:::

---

## server start / stop / reboot

```bash
conoha server start  <서버>
conoha server stop   <서버>
conoha server reboot <서버> [--hard]
```

| 플래그 | 설명 |
|---|---|
| `--hard` | 하드 리부트 |

---

## server resize / rebuild / rename

```bash
conoha server resize  <서버> --flavor <id-or-name>
conoha server rebuild <서버> --image <id-or-name>
conoha server rename  <서버> --name <new-name>
```

---

## server ssh

서버에 SSH 접속.

### 사용법

```bash
conoha server ssh <서버> [-- command...]
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--identity`, `-i` | 비밀키 경로 (미지정시 `~/.ssh/conoha_<KeyName>` 자동 검출) |
| `--user`, `-l` | 사용자 (기본: `root`) |
| `--port`, `-p` | SSH 포트 (기본: `22`) |

### known_hosts / TOFU

SSH 를 사용하는 모든 명령 (`server ssh`, `app init`, `app deploy` 등) 은 v0.6.1+ 부터 `~/.ssh/known_hosts` 로 호스트 키를 검증합니다. 첫 접속에서 키를 저장하는 TOFU 방식. 글로벌 `--insecure` 플래그로 검증을 스킵 가능 (권장 안 됨; 검증 / 일회성 VPS 한정).

---

## server deploy

SSH 경유로 서버에서 스크립트 실행.

```bash
conoha server deploy <서버> --script <local-script>
```

---

## server console / ips / metadata

```bash
conoha server console  <서버>
conoha server ips      <서버>
conoha server metadata <서버>
```

---

## server add-security-group / remove-security-group

별칭: `add-sg` / `remove-sg`. v0.5.3 이후 Neutron port API 경유로 반영. `server show` 로 결과 확인.

```bash
conoha server add-security-group    <서버> --name <sg>
conoha server remove-security-group <서버> --name <sg>
```

| 플래그 | 설명 | 필수 |
|---|---|---|
| `--name` | 보안 그룹명 | ○ |

---

## server open-port

서버에 부착된 커스텀 보안 그룹에 ingress 규칙을 추가하여 포트 개방. 커스텀 SG 가 없으면 `<서버명>-sg` 라는 이름으로 자동 생성하여 부착.

### 사용법

```bash
conoha server open-port <서버> <ports> [flags]
```

`<ports>` 는 단일 포트 또는 범위의 콤마 구분 리스트:

```
7860
7860,8080
7860,8080,9000-9010
```

### 옵션

| 플래그 | 설명 |
|---|---|
| `--sg` | SG 이름 (기본: `<서버명>-sg`, 없으면 자동 생성) |
| `--remote-ip` | 허용 CIDR (기본: `0.0.0.0/0`, IPv6 가능) |
| `--protocol` | `tcp` 또는 `udp` (기본: `tcp`, `icmp` 미지원) |

### 예

```bash
conoha server open-port my-server 80,443
conoha server open-port my-dev 8080-8090 --remote-ip 10.0.0.0/8
conoha server open-port my-vpn 51820 --protocol udp
```

---

## server attach-volume / detach-volume

```bash
conoha server attach-volume <server-id> <volume-id>
conoha server detach-volume <server-id> <volume-id>
```
