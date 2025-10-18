# 30D, 60D 차트 구현 문서

## 개요

이 문서는 대시보드에서 사용되는 30일(30D) 및 60일(60D) 차트의 구현 방식과 아키텍처에 대해 설명합니다.

## 아키텍처 개요

### 데이터 구조
- **V2 스키마**: 각 행(ROW)마다 2개의 차트 (30D + 60D)
- **데이터 포인트**: 각 차트당 최소 10,000 ~ 50,000개 데이터 포인트
- **데이터 형식**: Parquet 파일로 저장된 시계열 데이터

### 차트 구성
```
Row 1: [30D Chart] [60D Chart]
Row 2: [30D Chart] [60D Chart]
...
Row N: [30D Chart] [60D Chart]
```

## 핵심 컴포넌트

### 1. LazyChart.tsx
**위치**: `frontend/src/components/charts/LazyChart.tsx`

**주요 기능**:
- 개별 차트 렌더링 관리
- Static/Interactive 모드 전환
- 성능 최적화된 차트 로딩

**핵심 Props**:
```typescript
interface LazyChartProps {
  variantId: string;           // 차트 식별자 (예: TASK00001-30d, TASK00001-60d)
  isActive: boolean;          // 활성화 상태
  onLoadingStart?: (chartId: string) => void;
  onLoadingFinish?: (chartId: string) => void;
}
```

**Static/Interactive 모드**:
- **Static 모드**: 초기 렌더링 시 사용, 애니메이션 없음, 빠른 로딩
- **Interactive 모드**: 사용자 클릭 시 활성화, 줌/팬 기능 활성화

### 2. chartOptions.tsx
**위치**: `frontend/src/components/charts/chartOptions.tsx`

**주요 기능**:
- ECharts 옵션 구성
- 성능 최적화 설정
- 데이터 샘플링 로직

**핵심 함수**:
```typescript
function buildChartOption(
  chartData: any,
  isInteractive: boolean,
  chartId: string
): EChartsOption
```

**성능 최적화**:
- **데이터 샘플링**: Static 모드에서 1000개 이상 데이터 포인트 시 샘플링
- **애니메이션 비활성화**: Static 모드에서 애니메이션 제거
- **Lazy Update**: `lazyUpdate: true` 설정

### 3. TableColumns.tsx
**위치**: `frontend/src/components/table/TableColumns.tsx`

**차트 컬럼 정의**:
```typescript
// 30D 차트 컬럼
columnHelper.accessor("30D", {
  id: "30D",
  header: "30D",
  size: 600,
  cell: (info) => (
    <LazyChart
      variantId={`${info.row.original.MASTER_TASK_ID}-30d`}
      isActive={activeChartId === `${info.row.original.MASTER_TASK_ID}-30d`}
      onLoadingStart={onLoadingStart}
      onLoadingFinish={onLoadingFinish}
    />
  )
});

// 60D 차트 컬럼
columnHelper.accessor("60D", {
  id: "60D", 
  header: "60D",
  size: 600,
  cell: (info) => (
    <LazyChart
      variantId={`${info.row.original.MASTER_TASK_ID}-60d`}
      isActive={activeChartId === `${info.row.original.MASTER_TASK_ID}-60d`}
      onLoadingStart={onLoadingStart}
      onLoadingFinish={onLoadingFinish}
    />
  )
});
```

## 데이터 플로우

### 1. 데이터 로딩
```
API Request → Backend → Parquet File → Chart Data → Frontend Rendering
```

### 2. 차트 식별자 규칙
- **30D 차트**: `{MASTER_TASK_ID}-30d` (예: TASK00001-30d)
- **60D 차트**: `{MASTER_TASK_ID}-60d` (예: TASK00001-60d)

### 3. 캐싱 전략
- **React Query**: 차트 데이터 캐싱
- **조건부 로딩**: 이미 로드된 차트는 재로딩하지 않음
- **페이지별 캐싱**: 페이지 이동 시 캐시된 데이터 활용

## 성능 최적화

### 1. Static 모드 최적화
```typescript
// 데이터 샘플링
const sampledData = isInteractive 
  ? chartData 
  : chartData.length > 1000 
    ? sampleData(chartData, 1000) 
    : chartData;

// 애니메이션 비활성화
const chartOption = {
  animation: isInteractive,
  // ... 기타 옵션
};
```

### 2. Interactive 모드 최적화
```typescript
// DataZoom 설정
const dataZoom = isInteractive ? {
  type: 'inside',
  start: 0,
  end: 100,
  moveOnMouseWheel: true,
  preventDefaultMouseMove: true
} : undefined;
```

### 3. 메모리 관리
- **React.memo**: LazyChart 컴포넌트 메모이제이션
- **useMemo**: 차트 옵션 메모이제이션
- **useCallback**: 이벤트 핸들러 메모이제이션

## 사용자 인터랙션

### 1. 차트 활성화
- **Static → Interactive**: "STATIC" 라벨 클릭
- **시각적 피드백**: 활성화된 차트는 파란색 테두리
- **커서 변경**: Interactive 모드에서 `grab` 커서

### 2. 줌/팬 기능
- **마우스 휠**: 줌 인/아웃
- **드래그**: 차트 이동
- **키보드**: 방향키로 이동

### 3. 이벤트 처리
```typescript
// 마우스 이벤트 처리
const handleWheel = (e: WheelEvent) => {
  if (isInteractive) {
    e.preventDefault();
    e.stopPropagation();
  }
};

const handleMouseDown = (e: MouseEvent) => {
  if (isInteractive) {
    e.preventDefault();
    e.stopPropagation();
  }
};
```

## 로딩 상태 관리

### 1. 진행률 추적
```typescript
// useChartLoadingProgress.ts
const {
  progress,
  isLoading,
  isCompleted,
  loadedCharts,
  totalCharts
} = useChartLoadingProgress();
```

### 2. 로딩 시퀀스
1. **차트 등록**: `startChartLoading(chartId)`
2. **데이터 로딩**: API 호출 및 데이터 처리
3. **렌더링 완료**: `finishChartLoading(chartId)`
4. **진행률 업데이트**: 실시간 진행률 표시

### 3. 캐시 처리
```typescript
// 캐시된 차트 즉시 완료 처리
if (isChartCached(chartId)) {
  setHasCachedCharts(true);
  if (allChartsCached) {
    setIsCompleted(true);
  }
}
```

## API 통합

### 1. 데이터 엔드포인트
```typescript
// 단일 차트 데이터 로딩
const { data: chartData } = useOptimizedChartQuery(
  variantId,
  { days: 30 }, // 30D 또는 60D
  { enabled: !!variantId }
);
```

### 2. 백엔드 API
```python
# api.py
@router.post("/load_chart_data_single")
async def load_chart_data_single(request: ChartDataRequest):
    # Parquet 파일에서 데이터 로딩
    # 날짜 필터링 (최근 N일)
    # 데이터 반환
```

## 파일 구조

```
frontend/src/
├── components/
│   ├── charts/
│   │   ├── LazyChart.tsx          # 개별 차트 컴포넌트
│   │   └── chartOptions.tsx       # ECharts 옵션 구성
│   ├── table/
│   │   └── TableColumns.tsx       # 테이블 컬럼 정의
│   └── DashboardTable.tsx         # 메인 테이블 컴포넌트
├── hooks/
│   └── useChartLoadingProgress.ts # 로딩 진행률 관리
└── utils/
    └── cacheStrategy.ts           # 캐싱 전략

backend/
├── api.py                         # FastAPI 엔드포인트
└── data_loader.py                # 데이터 로딩 로직

chart_data/                        # Parquet 데이터 파일
├── TASK00001.parquet
├── TASK00002.parquet
└── ...
```

## 설정 및 환경

### 1. 데이터 생성
```python
# timeseries_dataset_generator.py
config = GeneratorConfig(
    points_per_day=834,  # 50,000 포인트/60일
    num_tasks=100,       # 100개 태스크
    days=60             # 60일 데이터
)
```

### 2. 성능 설정
```typescript
// ECharts 성능 설정
const chartOptions = {
  animation: false,           // Static 모드에서 애니메이션 비활성화
  notMerge: true,            // 차트 업데이트 시 병합하지 않음
  lazyUpdate: true,          // 지연 업데이트
  useDirtyRect: false        // 더티 렉트 비활성화
};
```

## 문제 해결

### 1. 성능 이슈
- **문제**: 많은 차트 동시 렌더링으로 인한 성능 저하
- **해결**: Static 모드 + 사용자 활성화 방식

### 2. 메모리 누수
- **문제**: 차트 인스턴스가 제대로 정리되지 않음
- **해결**: useEffect cleanup 함수 구현

### 3. 한글 입력 이슈
- **문제**: Notes 입력 시 focus 잃어버림
- **해결**: Uncontrolled component + debouncing

## 향후 개선사항

### 1. 가상화 (Virtualization)
- 화면에 보이는 차트만 렌더링
- Intersection Observer API 활용

### 2. 웹 워커 (Web Workers)
- 데이터 처리 작업을 백그라운드에서 실행
- 메인 스레드 블로킹 방지

### 3. 서버 사이드 렌더링 (SSR)
- 초기 로딩 시간 단축
- SEO 최적화

## 참고 자료

- [ECharts 공식 문서](https://echarts.apache.org/)
- [React Query 문서](https://tanstack.com/query/latest)
- [TanStack Table 문서](https://tanstack.com/table/latest)
- [Parquet 파일 형식](https://parquet.apache.org/)
