# Timeseries Dashboard

React + FastAPI + SQLite 기반 시계열 데이터 대시보드

## 📋 프로젝트 구조

```
ts_f/
├── api.py                      # FastAPI 백엔드 서버
├── data_loader.py              # Parquet 데이터 로딩 및 필터링
├── db.py                       # SQLite Notes CRUD
├── requirements.txt            # Python 의존성
├── notes.db                    # SQLite 데이터베이스
├── all_groups_parquet/         # Parquet 데이터 파일 (2900개)
├── frontend/                   # React 프론트엔드
│   ├── src/
│   │   ├── components/
│   │   │   ├── DashboardTable.tsx
│   │   │   └── UserIdModal.tsx
│   │   ├── pages/
│   │   │   └── App.tsx
│   │   ├── services/
│   │   │   └── data.ts
│   │   ├── styles/
│   │   │   └── modal.css
│   │   ├── styles.css
│   │   └── main.tsx
│   ├── package.json
│   └── tsconfig.json
└── etc/                        # 구버전 Streamlit 관련 파일들
```

## 🚀 시작하기

### 1. 백엔드 실행

```bash
# Python 의존성 설치
pip install -r requirements.txt

# FastAPI 서버 실행
uvicorn api:app --host 115.136.116.145 --port 8050
```

### 2. 프론트엔드 실행

```bash
cd frontend

# Node.js 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

## 🔧 주요 기능

### 데이터 조회
- **LINE**: 다중 선택 가능
- **AREA, SENSORS, PATTERNS**: 단일 선택
- **AI_RESULT**: TRUE/FALSE 필터링
- **PERIOD**: 날짜 범위 지정

### 데이터 시각화
- **ECharts** 기반 인터랙티브 차트
- 8방향 Pan & Zoom (마우스 휠)
- Spec Band (연두색 영역)
- Interlock Points (빨강/파랑)

### Notes 관리
- **User ID 기반 권한**: 세션 User ID 필수 입력
- **복합 키**: `(user_id, variant_id)` 기반 CRUD
- **Auto-save**: Input box에서 나갈 때 자동 저장
- **Manual save**: Save 버튼으로 수동 저장
- **작성자/수정자 추적**: `created_by`, `updated_by` 기록

### 테이블 기능 (TanStack Table)
- Column 정렬 (Sorting)
- Column 필터링 (Filtering)
- Column 순서 변경 (Drag & Drop)
- Column 표시/숨김 (Visibility Toggle)
- Column Auto-fit (헤더 더블클릭)

## 📊 성능 최적화

### 백엔드
- **선택적 파일 로딩**: 필터 조건에 맞는 Parquet 파일만 로드
- **서버 측 다운샘플링**: 4000개 포인트로 제한
- **GZip 압축**: 응답 데이터 압축 전송
- **성능 메트릭**: `load_ms`, `filter_ms`, `aggregate_ms`, `paginate_ms` 제공

### 프론트엔드
- **React Query**: 데이터 캐싱 및 자동 갱신
- **ECharts Canvas 렌더링**: WebGL 대비 안정적
- **Uncontrolled Components**: Notes 입력 시 포커스 유지

## 🗄️ 데이터베이스 스키마

### Notes 테이블
```sql
CREATE TABLE notes (
    user_id TEXT NOT NULL,
    variant_id TEXT NOT NULL,
    note TEXT,
    created_at TEXT,
    created_by TEXT,
    updated_at TEXT,
    updated_by TEXT,
    PRIMARY KEY (user_id, variant_id)
);
```

## 📝 API 엔드포인트

### `GET /health`
서버 상태 확인

### `GET /filters/options`
사용가능한 필터 옵션 반환

### `POST /data/query`
데이터 조회 및 필터링
```json
{
  "filters": {
    "line": "11",
    "area": "CLN",
    "sensors": "Sensor1",
    "patterns": "ALL",
    "ai_result": "ALL",
    "period_from": "2025-01-01",
    "period_to": "2025-01-31"
  },
  "page": 1,
  "page_size": 10
}
```

### `POST /notes/load`
Notes 조회
```json
{
  "user_id": "user_a",
  "variant_ids": ["11/CMP/Sensor1/swing/0", "..."]
}
```

### `POST /notes/save`
Notes 저장
```json
{
  "user_id": "user_a",
  "variant_id": "11/CMP/Sensor1/swing/0",
  "note": "Test note",
  "current_session_user": "user_a"
}
```

## 🛠️ 기술 스택

### 백엔드
- **FastAPI**: 고성능 Python 웹 프레임워크
- **Pandas**: 데이터 처리
- **SQLite**: 경량 데이터베이스
- **Pydantic**: 데이터 검증

### 프론트엔드
- **React 18**: UI 라이브러리
- **TypeScript**: 타입 안정성
- **Vite**: 빌드 도구
- **TanStack Table**: 고급 테이블 기능
- **TanStack Query**: 데이터 페칭 및 캐싱
- **ECharts**: 차트 라이브러리
- **Axios**: HTTP 클라이언트

## 📂 etc/ 폴더

구버전 Streamlit 기반 구현 및 관련 문서:
- `app.py`: Streamlit 메인 앱
- `chart_utils.py`: Plotly 차트 유틸리티
- `ui_components.py`: Streamlit UI 컴포넌트
- `utils.py`: 기타 유틸리티
- `timeseries_dataset_generator.py`: 데이터 생성 스크립트
- `test.ipynb`: 테스트 노트북
- 각종 마크다운 문서

## 🐛 트러블슈팅

### Notes 입력 시 포커스가 빠지는 문제
**원인**: `useMemo` dependency에 `drafts` state가 포함되어 매 입력마다 columns 재생성

**해결**: 
- `useRef`로 `draftsRef` 생성
- Uncontrolled textarea (`defaultValue`) 사용
- `useMemo` dependency에서 `drafts` 제거

### Chart 렌더링 성능 문제
**원인**: 너무 많은 데이터 포인트

**해결**:
- 서버 측에서 4000개로 다운샘플링
- ECharts `progressive` 렌더링 활성화

## 📄 라이선스

MIT License

