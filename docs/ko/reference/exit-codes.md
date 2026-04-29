# 종료 코드

`internal/errors/exitcodes.go` 에서 정의됨. 스크립트 / CI 의 에러 핸들링에 사용.

| 코드 | 이름 | 의미 |
|------|------|------|
| `0` | OK | 성공 |
| `1` | General | 일반 에러 (분류에 해당하지 않는 경우) |
| `2` | Auth | 인증 실패 (로그인 미완료, 토큰 만료, 인가 에러) |
| `3` | NotFound | 리소스 미검출 (서버 / 이미지 / 볼륨 ID 또는 이름) |
| `4` | Validation | 검증 에러 (플래그 값 형식, `conoha.yml` 스키마 등) |
| `5` | API | API 에러 (5xx 등) |
| `6` | Network | 네트워크 에러 (DNS, 거부, 타임아웃) |
| `7` | ModeConflict | `app` 명령에서 `--proxy` / `--no-proxy` 가 서버측 마커와 불일치 |
| `8` | NotInitialized | `app` 명령에서 서버측 마커 없음 (`app init` 미실행) |
| `10` | Cancelled | 사용자 취소 (확인 프롬프트 N, Ctrl-C) |

`7` 과 `8` 은 v0.6.1 이후 추가됨 ([#111](https://github.com/crowdy/conoha-cli/issues/111)). 이전 버전에서는 `1` 반환.

## Bash 예

```bash
conoha app deploy my-server
case $? in
  0)  echo "OK" ;;
  3)  echo "서버 미검출 — server create 확인" ;;
  7)  echo "모드 불일치 — --proxy/--no-proxy 또는 마커 확인" ;;
  8)  echo "미초기화 — app init 먼저 실행" ;;
  10) echo "사용자가 취소" ;;
  *)  echo "기타 에러 (code: $?)" ;;
esac
```

## 관련 페이지

- [글로벌 플래그 / 환경 변수](/ko/reference/global-flags) — `--no-input` / `--yes` 로 비대화 실행
- [`app` 레퍼런스](/ko/reference/app) — 모드 관련 동작
