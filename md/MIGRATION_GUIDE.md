# Migration Guide: Schema V1 → V2

## 개요
기존 단일 차트에서 30일/60일 이중 차트로 확장하고, 추가 메타데이터 컬럼을 포함합니다.

## Parquet 파일 준비사항

### 필수 컬럼 (11개)

```
1. MASTER_TASK_ID    - string(30)   - 필수, 유니크 키
2. PROD_EQP_ID       - string(30)   - 필수, 설비호기
3. PARAM_SUBITEM     - string(200)  - 필수, 파라미터명
4. PPID              - string(50)   - 필수, 프로세스 플랜 ID
5. RECIPEID          - string(50)   - 필수, 레시피 ID
6. CH_STEP           - string(50)   - 필수, 챔버 스텝
7. MODEL_RESULT_INFO - string(200)  - 필수, 모델 결과
8. 30D               - struct       - 필수, 30일 차트 데이터
9. 60D               - struct       - 필수, 60일 차트 데이터
10. COMMENTS         - string(300)  - 선택, 코멘트
11. NOTES            - string(300)  - 선택, 노트 (reserved for future)
```

### 차트 데이터 구조 (30D, 60D)

각 차트 컬럼은 다음 구조를 가져야 합니다:

```python
# Parquet schema
{
    "value": [float],        # 값 리스트
    "spec_lower": [float],   # 하한 스펙 리스트
    "spec_upper": [float],   # 상한 스펙 리스트
    "act_date": [string]     # 날짜 리스트 (ISO 8601 format)
}
```

예시:
```python
{
    "value": [100.5, 102.3, 99.8, ...],
    "spec_lower": [95.0, 95.0, 95.0, ...],
    "spec_upper": [105.0, 105.0, 105.0, ...],
    "act_date": ["2025-01-01T00:00:00", "2025-01-02T00:00:00", ...]
}
```

## Backend 수정 필요사항

### 1. data_loader.py

기존 컬럼명을 새 컬럼명으로 매핑:

```python
# 기존
df['variant_id']  # → df['MASTER_TASK_ID']
df['plot_data']   # → df['30D'] 또는 df['60D']
df['model_result']# → df['MODEL_RESULT_INFO']

# 신규 컬럼 추가
df['PROD_EQP_ID']
df['PARAM_SUBITEM']
df['PPID']
df['RECIPEID']
df['CH_STEP']
df['COMMENTS']
```

### 2. db.py

Notes 테이블은 그대로 유지하되, `variant_id` 컬럼에 `MASTER_TASK_ID` 값을 저장:

```sql
-- 기존 테이블 구조 유지
CREATE TABLE notes (
    user_id TEXT,
    pattern TEXT,
    variant_id TEXT,  -- MASTER_TASK_ID 값 저장
    note TEXT,
    created_at TEXT,
    created_by TEXT,
    updated_at TEXT,
    updated_by TEXT,
    PRIMARY KEY (user_id, pattern, variant_id)
);
```

### 3. api.py

응답 JSON에 새 컬럼 포함:

```python
# 각 row에 포함될 필드
{
    "MASTER_TASK_ID": "...",
    "PROD_EQP_ID": "...",
    "PARAM_SUBITEM": "...",
    "PPID": "...",
    "RECIPEID": "...",
    "CH_STEP": "...",
    "MODEL_RESULT_INFO": "...",
    "30D": { ... },  # ChartData
    "60D": { ... },  # ChartData
    "COMMENTS": "...",
    "NOTES": "..."
}
```

## Frontend 수정 필요사항

### 1. DashboardTable.tsx

테이블 컬럼 재구성:

```typescript
const columns = [
  { id: 'MASTER_TASK_ID', header: 'Task ID', ... },
  { id: 'PROD_EQP_ID', header: 'Equipment', ... },
  { id: 'PARAM_SUBITEM', header: 'Parameter', ... },
  { id: 'PPID', header: 'PPID', ... },
  { id: 'RECIPEID', header: 'Recipe', ... },
  { id: 'CH_STEP', header: 'Step', ... },
  { id: 'MODEL_RESULT_INFO', header: 'Model Result', ... },
  { id: '30D', header: '30D Chart', cell: renderChart30D, ... },
  { id: '60D', header: '60D Chart', cell: renderChart60D, ... },
  { id: 'COMMENTS', header: 'Comments', ... },
  { id: 'NOTES', header: 'Notes', ... },
];
```

### 2. excelExport.ts

Excel 내보내기 컬럼 업데이트:

```typescript
worksheet.columns = [
  { header: 'Task ID', key: 'MASTER_TASK_ID', width: 35 },
  { header: 'Equipment', key: 'PROD_EQP_ID', width: 15 },
  { header: 'Parameter', key: 'PARAM_SUBITEM', width: 40 },
  { header: '30D Chart', key: '30D', width: 60 },
  { header: '60D Chart', key: '60D', width: 60 },
  { header: 'PPID', key: 'PPID', width: 20 },
  { header: 'Recipe', key: 'RECIPEID', width: 20 },
  { header: 'Step', key: 'CH_STEP', width: 20 },
  { header: 'Model Result', key: 'MODEL_RESULT_INFO', width: 30 },
  { header: 'Comments', key: 'COMMENTS', width: 40 },
  { header: 'Notes', key: 'NOTES', width: 50 },
];
```

## 호환성 전략

### 단계별 전환

**Phase 1: 준비 (현재)**
- 타입 정의 추가 (`frontend/src/types/schema.ts`)
- 마이그레이션 문서 작성

**Phase 2: Backend 업데이트**
- Parquet 파일 새 스키마 지원
- 기존 컬럼명도 fallback으로 지원
- API 응답에 새 컬럼 추가

**Phase 3: Frontend 업데이트**
- 테이블 컬럼 재구성
- 2개 차트 동시 표시
- Excel Export 업데이트

**Phase 4: 데이터 전환**
- 새 Parquet 파일로 교체
- 기존 Notes 데이터 마이그레이션 확인
- 테스트 및 검증

## 테스트 체크리스트

- [ ] Parquet 파일에 모든 필수 컬럼 존재
- [ ] 30D, 60D 차트 데이터 구조 확인
- [ ] Backend API 응답에 새 컬럼 포함
- [ ] Frontend 테이블에 모든 컬럼 표시
- [ ] 2개 차트 정상 렌더링 (30D, 60D)
- [ ] Notes 자동 저장 기능 정상 작동
- [ ] Excel Export에 모든 컬럼 포함
- [ ] 기존 Notes 데이터 마이그레이션 확인

## 롤백 계획

문제 발생 시 기존 Parquet 파일로 되돌리면 자동으로 기존 스키마 지원 (fallback 로직)

