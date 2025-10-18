# Data Architecture V2 - 완료 ✅

## 📋 완료된 작업

### 1. ✅ Backend API
- **Chart Data 로딩 함수** (`data_loader.py`)
  - `load_chart_data_single()` - 단일 task 차트 데이터 로드
  - `load_chart_data_batch()` - 여러 task 배치 로드
  - 개별 파일 방식과 단일 파일 방식 모두 지원

- **API 엔드포인트** (`api.py`)
  - `GET /data/chart/{master_task_id}?days=60` - 단일 조회
  - `POST /data/chart/batch` - 배치 조회
  - 환경변수 `CHART_DATA_DIR` 추가

### 2. ✅ Frontend Services
- **타입 정의** (`frontend/src/types/schema.ts`)
  - 새로운 컬럼 구조 타입 정의
  - ChartData 인터페이스
  - Legacy 컬럼 지원

- **API 서비스** (`frontend/src/services/data.ts`)
  - `loadChartDataSingle()` - 단일 차트 로드
  - `loadChartDataBatch()` - 배치 차트 로드

### 3. ✅ 문서화
- **ARCHITECTURE_V2.md** - 상세 아키텍처 설명
- **SCHEMA_V2.md** - 새로운 스키마 정의
- **MIGRATION_GUIDE.md** - 마이그레이션 가이드
- **README_V2.md** - 이 문서

### 4. ✅ 예제 코드
- **prepare_data_v2_example.py** - 데이터 준비 예제

---

## 🗂️ 데이터 구조

### 1. Frame Data (뼈대)
```
frame_data.parquet (단일 파일)
```

**컬럼:**
- `MASTER_TASK_ID` - 유니크 키
- `PROD_EQP_ID` - 설비호기
- `PARAM_SUBITEM` - 파라미터명
- `PPID`, `RECIPEID`, `CH_STEP` - 프로세스 정보
- `MODEL_RESULT_INFO` - 모델 결과
- `COMMENTS` - 코멘트
- `30D`, `60D`, `NOTES` - Frontend에서 채울 필드 (null)

### 2. Chart Data (시계열)
```
chart_data/
├── TASK00001.parquet
├── TASK00002.parquet
└── ...
```

**컬럼:**
- `master_task_id` - FK
- `act_date` - 날짜
- `value` - 측정값
- `spec_lower` - 하한
- `spec_upper` - 상한

---

## 🚀 사용 방법

### 1. 데이터 준비

#### 예제 스크립트 실행:
```bash
python prepare_data_v2_example.py
```

#### 또는 직접 준비:
```python
import pandas as pd

# 1. Frame 데이터
df_frame = pd.DataFrame({
    'MASTER_TASK_ID': ['TASK001', ...],
    'PROD_EQP_ID': ['EQP100', ...],
    'PARAM_SUBITEM': ['APC_ANGLE_AV', ...],
    'PPID': ['PPID_001', ...],
    'RECIPEID': ['RECIPE_001', ...],
    'CH_STEP': ['STEP_001', ...],
    'MODEL_RESULT_INFO': ['PASS', ...],
    'COMMENTS': ['...', ...],
    '30D': [None, ...],
    '60D': [None, ...],
    'NOTES': [None, ...]
})
df_frame.to_parquet('frame_data.parquet')

# 2. Chart 데이터 (각 task별)
df_chart = pd.DataFrame({
    'master_task_id': ['TASK001'] * 60,
    'act_date': pd.date_range('2024-12-10', periods=60),
    'value': [100.5, 102.3, ...],
    'spec_lower': [95.0] * 60,
    'spec_upper': [105.0] * 60
})
df_chart.to_parquet('chart_data/TASK001.parquet')
```

### 2. 환경 설정

`.env` 파일:
```bash
DATA_DIR=./all_groups_parquet
CHART_DATA_DIR=./chart_data
API_HOST=115.136.116.145
API_PORT=8050
```

### 3. Backend 시작

```bash
uvicorn api:app --host 115.136.116.145 --port 8050
```

### 4. API 테스트

#### Frame 데이터 조회 (기존):
```bash
curl -X POST http://115.136.116.145:8050/data/query \
  -H "Content-Type: application/json" \
  -d '{
    "filters": {"line": "ALL", ...},
    "page": 1,
    "page_size": 10
  }'
```

#### 단일 차트 조회 (신규):
```bash
curl http://115.136.116.145:8050/data/chart/TASK001?days=60
```

**응답:**
```json
{
  "master_task_id": "TASK001",
  "data": {
    "act_date": ["2024-12-10", ...],
    "value": [100.5, ...],
    "spec_lower": [95.0, ...],
    "spec_upper": [105.0, ...]
  },
  "days": 60,
  "count": 60
}
```

#### 배치 차트 조회 (신규):
```bash
curl -X POST http://115.136.116.145:8050/data/chart/batch \
  -H "Content-Type: application/json" \
  -d '{
    "master_task_ids": ["TASK001", "TASK002"],
    "days": 60
  }'
```

**응답:**
```json
{
  "TASK001": {"act_date": [...], "value": [...], ...},
  "TASK002": {"act_date": [...], "value": [...], ...}
}
```

---

## 📊 Frontend 사용 예시

### 1. Frame 데이터 로드 (기존)
```typescript
const { data } = useQuery(['data', filters], () => 
  queryData({ filters, page: 1, page_size: 10 })
);
// data.rows에 frame 데이터 (30D, 60D는 null)
```

### 2. Chart 데이터 배치 로드 (신규)
```typescript
import { loadChartDataBatch } from './services/data';

// Frame 로드 후
useEffect(() => {
  if (data?.rows) {
    const ids = data.rows.map(r => r.MASTER_TASK_ID);
    
    // 60일 차트 데이터 배치 로드
    loadChartDataBatch({ master_task_ids: ids, days: 60 })
      .then(chartData => {
        // chartData = { "TASK001": {...}, "TASK002": {...} }
        // 각 row에 차트 데이터 병합
      });
  }
}, [data]);
```

### 3. 30D vs 60D 차트 분리
```typescript
// 60일 데이터에서 30일 추출
const chart30D = {
  act_date: chart60D.act_date.slice(-30),
  value: chart60D.value.slice(-30),
  spec_lower: chart60D.spec_lower.slice(-30),
  spec_upper: chart60D.spec_upper.slice(-30),
};
```

---

## 🎯 장점

### 1. 성능 최적화
- **초기 로딩 속도**: Frame만 먼저 로드 (빠름)
- **필요시 로딩**: 차트는 on-demand로 로드
- **배치 처리**: 여러 차트를 한번에 로드

### 2. 확장성
- **파일 분리**: Frame과 Chart 독립 관리
- **유연성**: 차트 데이터만 업데이트 가능
- **캐싱**: 차트 데이터 개별 캐싱 가능

### 3. 유지보수
- **명확한 구조**: Frame vs Chart 분리
- **개별 파일**: 각 task별 차트 파일
- **디버깅 용이**: 문제 발생 시 특정 파일만 확인

---

## ⚠️ 주의사항

### 1. Parquet vs Pickle
- **추천: Parquet** ✅
- Pickle은 Python 전용이라 JSON 변환 필요
- Parquet가 범용적이고 압축률 좋음
- Backend에서 Parquet → JSON 변환 (pandas `to_dict()`)

### 2. 파일 구조
- **추천: 개별 파일** (`chart_data/TASK*.parquet`)
- 빠른 개별 조회
- 파일 크기 관리 용이
- 병렬 처리 가능

### 3. 데이터 일관성
- Frame의 `MASTER_TASK_ID`와 Chart의 `master_task_id` 일치 필요
- Chart 파일명도 `MASTER_TASK_ID.parquet`로 통일

---

## 📁 프로젝트 구조

```
프로젝트/
├── frame_data.parquet          # Frame 데이터 (뼈대)
├── chart_data/                 # Chart 데이터 폴더
│   ├── TASK00001.parquet
│   ├── TASK00002.parquet
│   └── ...
├── api.py                      # Backend API (수정됨)
├── data_loader.py              # 데이터 로더 (수정됨)
├── env.example                 # 환경변수 예제 (수정됨)
├── prepare_data_v2_example.py  # 데이터 준비 예제 (신규)
├── ARCHITECTURE_V2.md          # 아키텍처 문서 (신규)
├── SCHEMA_V2.md                # 스키마 문서 (신규)
├── MIGRATION_GUIDE.md          # 마이그레이션 가이드 (신규)
├── README_V2.md                # 이 문서 (신규)
└── frontend/
    └── src/
        ├── types/schema.ts     # 타입 정의 (신규)
        └── services/data.ts    # API 서비스 (수정됨)
```

---

## ✅ 체크리스트

### 데이터 준비
- [ ] Frame 데이터 생성 (`frame_data.parquet`)
- [ ] Chart 데이터 생성 (`chart_data/*.parquet`)
- [ ] 데이터 검증 (컬럼명, 타입 확인)
- [ ] 파일 위치 이동 (`DATA_DIR`, `CHART_DATA_DIR`)

### Backend
- [x] Chart 데이터 로딩 함수 구현
- [x] API 엔드포인트 추가
- [x] 환경변수 설정
- [ ] Backend 재시작 및 테스트

### Frontend
- [x] 타입 정의 추가
- [x] API 서비스 추가
- [ ] 테이블 컬럼 업데이트 (TODO)
- [ ] 차트 lazy loading 구현 (TODO)
- [ ] Excel Export 업데이트 (TODO)

---

## 🔄 다음 단계

1. **데이터 준비 완료 대기** ⏳
2. **Backend 재시작 및 API 테스트**
3. **Frontend 테이블 컬럼 재구성**
4. **2개 차트 (30D, 60D) 렌더링**
5. **Excel Export 업데이트**
6. **성능 테스트 및 최적화**

---

## 📞 문의

구현 중 문제 발생 시:
1. API 테스트: `curl http://localhost:8050/data/chart/TASK001`
2. 로그 확인: Backend 콘솔 로그
3. 데이터 검증: Parquet 파일 구조 확인

**모든 준비 완료!** 🎉

