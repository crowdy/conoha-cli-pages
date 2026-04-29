# 글로벌 플래그 / 환경 변수

모든 명령에서 사용 가능한 영구 플래그와 환경 변수.

## 글로벌 플래그

`cmd/root.go` 의 `PersistentFlags()` 에서 정의됨.

| 플래그 | 설명 |
|---|---|
| `--profile` | 프로파일 이름 |
| `--format` | 출력 포맷: `table` / `json` / `yaml` / `csv` |
| `--no-input` | 대화 프롬프트 비활성화 (CI / 스크립트) |
| `--yes`, `-y` | 확인 프롬프트 자동 승인 |
| `--quiet` | 비필수 출력 억제 |
| `--verbose`, `-v` | 상세 출력 |
| `--no-color` | 컬러 출력 비활성화 |
| `--no-headers` | 테이블 / CSV 헤더 숨김 |
| `--filter` | 행 필터 (반복 가능; 연산자 후술) |
| `--sort-by` | 필드명 기준 정렬 |
| `--insecure` | SSH 호스트 키 검증 비활성화 (권장 안 됨; 검증 / 일회성 VPS 한정) |

### 대기 플래그

`cmdutil.AddWaitFlags()` 를 호출하는 명령에는 다음이 추가됨:

| 플래그 | 설명 |
|---|---|
| `--wait` | 작업 완료까지 대기 |
| `--wait-timeout` | 대기 상한 (기본: `5m`) |

---

## `--filter` 연산자

`--filter` 는 `key<op>value` 형식이며 반복 지정 가능 (AND 결합).

| 연산자 | 의미 | 예 |
|---|---|---|
| `=` | 완전 일치 | `--filter status=ACTIVE` |
| `~` | 부분 일치 (포함) | `--filter name~web` |
| `~=` | 정규식 일치 | `--filter name~=^prod-` |

`~` 와 `~=` 는 v0.6.1+ 부터 사용 가능.

```bash
conoha server list --filter status=ACTIVE
conoha server list --filter name~web
conoha server list --filter 'name~=^prod-'
conoha server list --filter status=ACTIVE --filter name~web
```

---

## 환경 변수

| 변수 | 설명 |
|---|---|
| `CONOHA_PROFILE` | 프로파일 이름 |
| `CONOHA_TENANT_ID` | 테넌트 ID |
| `CONOHA_USERNAME` | API 사용자명 |
| `CONOHA_PASSWORD` | API 패스워드 |
| `CONOHA_TOKEN` | 발급된 인증 토큰 |
| `CONOHA_FORMAT` | 출력 포맷 |
| `CONOHA_CONFIG_DIR` | 설정 디렉토리 |
| `CONOHA_NO_INPUT` | 비대화 모드 (`1` / `true`) |
| `CONOHA_YES` | 확인 자동 승인 (`1` / `true`) |
| `CONOHA_NO_COLOR` | 컬러 비활성화 (`1` / `true`; `NO_COLOR` 도 인식) |
| `CONOHA_ENDPOINT` | API 엔드포인트 덮어쓰기 |
| `CONOHA_ENDPOINT_MODE` | `int` 로 내부 API 모드 (서비스명을 패스에 추가) |
| `CONOHA_DEBUG` | 디버그 로그 (`1` / `api`) |
| `CONOHA_SSH_INSECURE` | SSH 호스트 키 검증 비활성화 (`1` / `true`) |

### 우선 순위

```
환경 변수 > 플래그 > 프로파일 > 기본값
```

---

## 관련 페이지

- [종료 코드](/ko/reference/exit-codes)
- `config` 레퍼런스 (일본어판) — 프로파일 관리는 [`config`](/reference/config) 참조
