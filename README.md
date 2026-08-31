# DLMO Prediction API

> 활동량·백색광·수면 데이터를 분석해 사용자별 DLMO 시간을 예측하는 Node.js API입니다.

![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Data-4169E1?logo=postgresql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES_Modules-F7DF1E?logo=javascript&logoColor=black)

## 프로젝트 소개

웹 브라우저에서 실행되던 오픈소스 생체리듬 계산 코드를 분석해 API로 재구성한 프로젝트입니다. PostgreSQL에 저장된 사용자별 센서 데이터를 조회하고, 빛·활동량·수면 상태를 전처리한 뒤 생체리듬 모델을 계산해 DLMO(Dim Light Melatonin Onset) 예측 시간을 반환합니다.

## 주요 기능

- 사용자 ID 기준 전체 측정 데이터 조회
- 시작·종료 시간 범위에 포함된 데이터 조회
- 불규칙한 센서 데이터를 1분 간격으로 보간
- 백색광·활동량·수면 상태를 생체리듬 모델 입력으로 변환
- Runge-Kutta 4차 방법을 이용한 생체리듬 모델 계산
- 24시간 기준 DLMO 예측 시간 반환

## 처리 흐름

```text
PostgreSQL labdata
        │
        ▼
Sensor Data Preprocessing
        │
        ▼
Minute-level Resampling
        │
        ▼
Circadian Model + RK4
        │
        ▼
DLMO Prediction
```

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| Runtime | Node.js, ES Modules |
| API | Express |
| Database | PostgreSQL, node-postgres |
| Configuration | dotenv |
| Model | JavaScript, RK4 numerical integration |

## 데이터 형식

API는 PostgreSQL의 `labdata` 테이블에서 다음 컬럼을 사용합니다.

| 컬럼 | 설명 |
| --- | --- |
| `id` | 사용자 식별자 |
| `time` | 측정 시간 |
| `activity` | 활동량 |
| `white_light` | 백색광 측정값 |
| `sleep` | 수면 여부 |

측정 데이터는 시간 오름차순으로 처리됩니다.

## API

### 사용자 전체 데이터로 예측

```http
GET /predicting_dlmo?ID=user@example.com
```

### 특정 기간 데이터로 예측

```http
GET /?ID=user@example.com&Start_time=START&End_time=END
```

정상 응답은 24시간 기준의 예측 시간을 소수 형태의 문자열로 반환합니다.

```text
21.75
```

## 실행 방법

### 1. 요구 사항

- Node.js 18 이상
- PostgreSQL

### 2. 의존성 설치

이 저장소는 로컬 `package.json`을 Git에서 제외합니다. 처음 실행할 때 다음과 같이 ES Module 프로젝트를 준비합니다.

```bash
npm init -y
npm pkg set type=module
npm install express pg dotenv
```

### 3. 환경변수

프로젝트 루트에 `.env` 파일을 생성합니다.

```env
PSQL_USER=postgres
PSQL_HOST=localhost
PSQL_DATABASE=nodelab
PSQL_PASSWORD=your-password
PSQL_PORT=5432
```

실제 데이터베이스 인증 정보는 저장소에 커밋하지 마세요.

### 4. 데이터베이스 연결 확인

```bash
node psql.js
```

현재 시간이 출력되면 PostgreSQL 연결이 정상입니다.

### 5. API 실행

```bash
node app.js
```

서버는 `http://localhost:8000`에서 실행됩니다.

호출 예시:

```bash
curl 'http://localhost:8000/predicting_dlmo?ID=test%40email.com'
```

## 샘플 데이터 적재

`insertdata.js`는 CSV 데이터를 읽어 `labdata` 테이블에 넣는 초기 적재 스크립트입니다. 실행 전 다음 항목을 현재 환경에 맞게 수정해야 합니다.

- CSV 파일 경로
- 사용자 ID
- CSV 컬럼 순서와 데이터 형식

```bash
node insertdata.js
```

## 프로젝트 구조

```text
.
├─ app.js                  # Express API
├─ psql.js                 # PostgreSQL 연결 확인
├─ insertdata.js           # CSV 데이터 적재
└─ js/
   ├─ prep_data.js         # 데이터 전처리와 DLMO 계산
   ├─ models.js            # 생체리듬 모델과 RK4
   ├─ sample.csv           # 샘플 센서 데이터
   ├─ read_file.js         # 브라우저 파일 입력 코드
   └─ date.js              # 날짜 처리 라이브러리
```

## 참고

- 현재 코드는 연구·학습 목적의 프로토타입입니다.
- 운영 환경에서는 입력값 검증, 파라미터 바인딩 쿼리, 연결 풀과 공통 오류 처리를 추가해야 합니다.
- 예측 결과를 의료적 판단에 사용해서는 안 됩니다.

