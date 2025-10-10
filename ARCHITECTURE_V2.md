# Architecture V2: 분리된 데이터 구조

## 개요

데이터를 2개의 레이어로 분리하여 성능 최적화:
1. **Frame Dataset** - 메타데이터 (빠른 로딩)
2. **Chart Dataset** - 시계열 데이터 (on-demand 로딩)

---

## 1. Frame Dataset (뼈대)

### 파일 형태
```
frame_data.parquet (단일 파일)
```

### 컬럼 구조
| 컬럼명 | 타입 | 설명 | 값 |
|--------|------|------|-----|
| `MASTER_TASK_ID` | string(30) | 유니크 키 | 실제 값 |
| `LINE` | string(50) | 라인 정보 (검색 필터용) | 실제 값 |
| `AREA` | string(50) | 영역 정보 (검색 필터용) | 실제 값 |
| `PROD_EQP_ID` | string(30) | 설비호기 | 실제 값 |
| `PARAM_SUBITEM` | string(200) | 파라미터명 | 실제 값 |
| `PPID` | string(50) | 프로세스 플랜 ID | 실제 값 |
| `RECIPEID` | string(50) | 레시피 ID | 실제 값 |
| `CH_STEP` | string(50) | 챔버 스텝 | 실제 값 |
| `MODEL_RESULT_INFO` | string(200) | 모델 결과 | 실제 값 |
| `COMMENTS` | string(300) | 인터락 코멘트 | 실제 값 |
| `30D` | null | (Frontend에서 채움) | null/empty |
| `60D` | null | (Frontend에서 채움) | null/empty |
| `NOTES` | null | (Frontend에서 채움) | null/empty |

### Python 생성 예시
```python
import pandas as pd

df_frame = pd.DataFrame({
    'MASTER_TASK_ID': ['TASK001', 'TASK002', ...],
    'LINE': ['LINE1', 'LINE2', ...],            # 검색 필터용
    'AREA': ['AREAA', 'AREAB', ...],            # 검색 필터용
    'PROD_EQP_ID': ['EQP100', 'EQP101', ...],
    'PARAM_SUBITEM': ['APC_ANGLE_AV', 'CHAMBER_PRESS_ST', ...],
    'PPID': ['PPID_001', 'PPID_002', ...],
    'RECIPEID': ['RECIPE_001', 'RECIPE_002', ...],
    'CH_STEP': ['STEP_001', 'STEP_002', ...],
    'MODEL_RESULT_INFO': ['PASS', 'FAIL', ...],
    'COMMENTS': ['Comment here', 'Another comment', ...],
    '30D': [None] * len(df),  # Frontend에서 채움
    '60D': [None] * len(df),  # Frontend에서 채움
    'NOTES': [None] * len(df) # Frontend에서 채움
})

df_frame.to_parquet('frame_data.parquet', index=False)
```

---

## 2. Chart Dataset (시계열)

### 파일 형태
```
chart_data/
├── TASK001.parquet
├── TASK002.parquet
├── TASK003.parquet
└── ...
```

**또는 단일 파일:**
```
chart_data_all.parquet (master_task_id로 파티셔닝)
```

### 컬럼 구조
| 컬럼명 | 타입 | 설명 |
|--------|------|------|
| `master_task_id` | string | FK to Frame.MASTER_TASK_ID |
| `act_date` | datetime/string | 측정 날짜 (ISO 8601) |
| `value` | float | 측정 값 |
| `spec_lower` | float | 하한 스펙 |
| `spec_upper` | float | 상한 스펙 |

### Python 생성 예시

**방법 1: master_task_id별 개별 파일**
```python
import pandas as pd

# TASK001의 60일치 데이터
df_task001 = pd.DataFrame({
    'master_task_id': ['TASK001'] * 60,
    'act_date': pd.date_range('2024-12-10', periods=60, freq='D'),
    'value': [100.5, 102.3, 99.8, ...],  # 60개
    'spec_lower': [95.0] * 60,
    'spec_upper': [105.0] * 60
})

df_task001.to_parquet('chart_data/TASK001.parquet', index=False)
```

**방법 2: 단일 파일 (추천)**
```python
# 모든 task의 데이터를 하나의 파일에
df_all = pd.concat([df_task001, df_task002, ...])
df_all.to_parquet(
    'chart_data_all.parquet', 
    index=False,
    partition_cols=['master_task_id']  # 선택사항
)
```

---

## 3. Backend API 구조

### API 엔드포인트

#### 3.1 Frame Data API (기존)
```
POST /api/data/query
```

**요청:**
```json
{
  "filters": { ... },
  "page": 1,
  "page_size": 10,
  "user_id": "user_a",
  "pattern": "pattern_1"
}
```

**응답:**
```json
{
  "rows": [
    {
      "MASTER_TASK_ID": "TASK001",
      "PROD_EQP_ID": "EQP100",
      "PARAM_SUBITEM": "APC_ANGLE_AV",
      "PPID": "PPID_001",
      "RECIPEID": "RECIPE_001",
      "CH_STEP": "STEP_001",
      "MODEL_RESULT_INFO": "PASS",
      "COMMENTS": "Comment here",
      "30D": null,  // Frontend에서 채움
      "60D": null,  // Frontend에서 채움
      "NOTES": null // Frontend에서 채움
    }
  ],
  "page": 1,
  "total": 100,
  "total_pages": 10,
  "notes": { ... }
}
```

#### 3.2 Chart Data API (신규)
```
GET /api/data/chart/{master_task_id}?days=60
POST /api/data/chart/batch
```

**단일 조회:**
```bash
GET /api/data/chart/TASK001?days=60
```

**응답:**
```json
{
  "master_task_id": "TASK001",
  "data": {
    "act_date": ["2024-12-10", "2024-12-11", ...],
    "value": [100.5, 102.3, 99.8, ...],
    "spec_lower": [95.0, 95.0, 95.0, ...],
    "spec_upper": [105.0, 105.0, 105.0, ...]
  },
  "count": 60
}
```

**배치 조회 (여러 task 한번에):**
```bash
POST /api/data/chart/batch
```

**요청:**
```json
{
  "master_task_ids": ["TASK001", "TASK002", "TASK003"],
  "days": 60
}
```

**응답:**
```json
{
  "TASK001": { "act_date": [...], "value": [...], ... },
  "TASK002": { "act_date": [...], "value": [...], ... },
  "TASK003": { "act_date": [...], "value": [...], ... }
}
```

---

## 4. Frontend 전략

### 4.1 초기 로딩
```typescript
// 1. Frame 데이터만 먼저 로드 (빠름)
const { data } = useQuery(['data', filters], () => 
  fetchFrameData(filters)
);

// rows는 차트 없이 표시됨
// 30D, 60D 컬럼은 "Loading..." 또는 스켈레톤
```

### 4.2 차트 Lazy Loading

**방법 1: 스크롤 시 로드 (Intersection Observer)**
```typescript
// 화면에 보이는 row만 차트 로드
const ChartCell = ({ master_task_id, days }) => {
  const [isVisible, setIsVisible] = useState(false);
  const { data: chartData } = useQuery(
    ['chart', master_task_id, days],
    () => fetchChartData(master_task_id, days),
    { enabled: isVisible } // 보일 때만 로드
  );
  
  return (
    <IntersectionObserver onChange={setIsVisible}>
      {chartData ? <EChart data={chartData} /> : <Skeleton />}
    </IntersectionObserver>
  );
};
```

**방법 2: 페이지 로드 후 배치 로드**
```typescript
// Frame 로드 완료 후, 현재 페이지의 모든 차트 한번에 로드
useEffect(() => {
  if (frameData?.rows) {
    const ids = frameData.rows.map(r => r.MASTER_TASK_ID);
    fetchChartDataBatch(ids, 60);
  }
}, [frameData]);
```

**추천: 방법 2 (배치 로드)**
- 네트워크 요청 최소화
- 사용자 경험 좋음 (빠른 초기 표시 → 차트 일괄 업데이트)

### 4.3 30D vs 60D

```typescript
// 60일 데이터 받아서 30일은 슬라이스
const chart60DData = fetchChartData(id, 60);
const chart30DData = {
  ...chart60DData,
  act_date: chart60DData.act_date.slice(-30),
  value: chart60DData.value.slice(-30),
  spec_lower: chart60DData.spec_lower.slice(-30),
  spec_upper: chart60DData.spec_upper.slice(-30),
};
```

---

## 5. 성능 최적화

### 5.1 캐싱 전략
```typescript
// React Query로 차트 데이터 캐싱
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분간 fresh
      cacheTime: 30 * 60 * 1000, // 30분간 캐시 유지
    }
  }
});
```

### 5.2 Backend 캐싱
```python
from functools import lru_cache

@lru_cache(maxsize=1000)
def load_chart_data(master_task_id: str, days: int):
    # Parquet 파일 읽기
    df = pd.read_parquet(f'chart_data/{master_task_id}.parquet')
    # 또는 단일 파일에서 필터링
    # df = pd.read_parquet('chart_data_all.parquet')
    # df = df[df['master_task_id'] == master_task_id]
    
    # 최근 N일만
    df = df.tail(days)
    return df.to_dict('list')
```

### 5.3 압축
- Parquet 자체가 압축됨 (Snappy, GZIP 등)
- API 응답 GZIP 압축 (FastAPI GZipMiddleware 이미 적용됨)

---

## 6. 구현 우선순위

### Phase 1: Backend API 준비
1. ✅ Frame 데이터 로드 엔드포인트 수정
2. ⏳ Chart 데이터 로드 엔드포인트 신규 생성
   - `GET /api/data/chart/{id}`
   - `POST /api/data/chart/batch`

### Phase 2: Frontend 수정
1. ⏳ Frame 데이터만 먼저 표시
2. ⏳ Chart 데이터 배치 로드
3. ⏳ 30D/60D 차트 렌더링

### Phase 3: 최적화
1. ⏳ 차트 lazy loading (Intersection Observer)
2. ⏳ 캐싱 전략 적용
3. ⏳ Excel Export 업데이트

---

## 7. 데이터 파일 권장 구조

```
data/
├── frame_data.parquet          # 뼈대 (1개 파일)
└── chart_data/
    ├── TASK001.parquet         # 각 task별 차트 데이터
    ├── TASK002.parquet
    └── ...
    
# 또는
data/
├── frame_data.parquet          # 뼈대
└── chart_data_all.parquet      # 모든 차트 데이터 (master_task_id로 필터)
```

**추천: 개별 파일**
- 빠른 개별 조회
- 파일 크기 관리 용이
- 병렬 처리 가능

**단일 파일 장점:**
- 관리 간단
- 배치 조회 빠름

