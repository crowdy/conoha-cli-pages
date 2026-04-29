# 시작하기

ConoHa CLI 는 ConoHa VPS3 를 터미널에서 조작하는 명령줄 도구입니다.

## 설치

### macOS (Homebrew)

```bash
brew install crowdy/tap/conoha-cli
```

### Scoop (Windows)

```powershell
scoop bucket add crowdy https://github.com/crowdy/crowdy-bucket
scoop install conoha
```

### Linux / macOS (수동)

[GitHub Releases](https://github.com/crowdy/conoha-cli/releases) 에서 OS / 아키텍처에 맞는 바이너리를 다운로드하세요.

```bash
# 예: Linux amd64
VERSION=$(curl -s https://api.github.com/repos/crowdy/conoha-cli/releases/latest | grep tag_name | cut -d '"' -f4)
curl -Lo conoha.tar.gz "https://github.com/crowdy/conoha-cli/releases/download/${VERSION}/conoha-cli_${VERSION#v}_linux_amd64.tar.gz"
tar xzf conoha.tar.gz conoha
sudo mv conoha /usr/local/bin/
rm conoha.tar.gz
```

### Windows (수동)

```powershell
$version = (Invoke-RestMethod https://api.github.com/repos/crowdy/conoha-cli/releases/latest).tag_name
$v = $version -replace '^v', ''
Invoke-WebRequest -Uri "https://github.com/crowdy/conoha-cli/releases/download/$version/conoha-cli_${v}_windows_amd64.zip" -OutFile conoha.zip
Expand-Archive conoha.zip -DestinationPath .
Remove-Item conoha.zip
```

## 설치 확인

```bash
conoha version
```

## 로그인

ConoHa API 사용자명 / 패스워드 / 테넌트 ID 를 사용합니다. 값은 [ConoHa 컨트롤 패널](https://manage.conoha.jp/) 의 "API" 페이지에서 확인할 수 있습니다.

```bash
conoha auth login
```

대화식으로 다음 항목을 입력합니다.

- **API User**: API 사용자명
- **Password**: API 패스워드
- **Tenant ID**: 테넌트 ID
- **Region**: `tyo3` (도쿄)

실행 예:

```
$ conoha auth login
Tenant ID: a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
API Username: gncu12345678
API Password: *********************
Authenticating as gncu12345678...
Logged in to profile "default" (token expires 2026-03-31T02:16:10Z / 2026-03-31 11:16 JST)
```

::: tip
`--profile` 로 여러 계정을 관리할 수 있습니다.

```bash
conoha auth login --profile work
conoha auth login --profile personal
conoha auth switch work
```
:::

## 로그인 확인

```bash
conoha auth status
```

## 기본 사용

```bash
# 서버 목록
conoha server list

# JSON 출력
conoha server list --format json

# 도움말
conoha --help
conoha server --help
conoha server create --help
```

`conoha server list` 출력 예:

```
ID                                    NAME            STATUS   FLAVOR         TAG
1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d  my-web-server   ACTIVE   g2l-t-c3m2     production
2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e  my-api-server   ACTIVE   g2l-t-c2m1     staging
3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f  test-server     SHUTOFF  g2l-t-c2m1     test
```

## 출력 포맷

모든 명령에서 `--format` 을 사용할 수 있습니다.

| 포맷 | 설명 |
|------|------|
| `table` | 테이블 (기본값) |
| `json` | JSON |
| `yaml` | YAML |
| `csv` | CSV |

## 다음 단계

- [앱 배포](/ko/guide/app-deploy) — proxy / no-proxy 모드별 도커 앱 배포
- [`server` 레퍼런스](/ko/reference/server) — 서버 명령
- [`app` 레퍼런스](/ko/reference/app) — 앱 명령
- [`proxy` 레퍼런스](/ko/reference/proxy) — conoha-proxy 명령

일본어 버전 문서에는 더 많은 컨텐츠가 있습니다 (퀵스타트, 서버 / 앱 관리 가이드, 추가 레퍼런스, 예제). 언어 스위처에서 전환할 수 있습니다.
