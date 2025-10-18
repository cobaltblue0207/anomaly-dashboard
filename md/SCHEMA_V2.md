# Data Schema V2

## 새로운 Parquet 파일 스키마

### 컬럼 정의

| # | 컬럼명 | 타입 | 최대길이 | 설명 | 기존 매핑 |
|---|--------|------|----------|------|-----------|
| 1 | `MASTER_TASK_ID` | string | 30 | 마스터 태스크 ID | `variant_id` → 변경 |
| 2 | `LINE` | string | 50 | 라인 정보 (검색 필터용) | 기존 유지 |
| 3 | `AREA` | string | 50 | 영역 정보 (검색 필터용) | 기존 유지 |
| 4 | `PROD_EQP_ID` | string | 30 | 설비호기 (예: EQP100) | 신규 |
| 5 | `PARAM_SUBITEM` | string | 200 | 파라미터명+서브아이템 (예: APC_ANGLE_AV) | 신규 |
| 6 | `PPID` | string | 50 | 프로세스 플랜 ID (예: PPID_001) | 신규 |
| 7 | `RECIPEID` | string | 50 | 레시피 ID (예: RECIPEID_001) | 신규 |
| 8 | `CH_STEP` | string | 50 | 챔버 스텝 (예: CH_STEP_001) | 신규 |
| 9 | `MODEL_RESULT_INFO` | string | 200 | 모델 결과 정보 | `model_result` → 변경 |
| 10 | `30D` | object | - | 30일 스캐터 차트 데이터 (ECharts) | `plot_data` → 확장 |
| 11 | `60D` | object | - | 60일 스캐터 차트 데이터 (ECharts) | `plot_data` → 확장 |
| 12 | `COMMENTS` | string | 300 | 인터락 풀 코멘트 | 신규 |
| 13 | `NOTES` | string | 300 | 사용자 노트 | 기존 유지 |

### 검색 필터 변경사항
- ✅ **추가**: `LINE`, `AREA` (Frame 데이터의 필수 컬럼)
- ❌ **삭제 예정**: `Sensor`, `Pattern` (Frontend UI에서 제거)

### 차트 데이터 구조 (30D, 60D)

기존 `plot_data` 구조와 동일하게 유지:
```javascript
{
  "value": [number, ...],       // 값 배열
  "spec_lower": [number, ...],  // 하한 스펙 배열
  "spec_upper": [number, ...],  // 상한 스펙 배열
  "act_date": [string, ...]     // 날짜 배열 (ISO 형식)
}
```

### 마이그레이션 가이드

#### Backend (api.py, data_loader.py)
- Parquet 파일에서 새 컬럼명으로 읽기
- `variant_id` → `MASTER_TASK_ID` 매핑
- `plot_data` → `30D`, `60D` 두 개 차트 지원

#### Database (db.py)
- `notes` 테이블의 `variant_id` 컬럼은 `MASTER_TASK_ID` 값 저장
- 기존 데이터 호환성 유지

#### Frontend
- 테이블 컬럼 재구성:
  - `variant_id` → `MASTER_TASK_ID`
  - `chart` → `30D Chart`, `60D Chart` (2개 컬럼)
  - 신규 컬럼 추가: `PROD_EQP_ID`, `PARAM_SUBITEM`, `PPID`, `RECIPEID`, `CH_STEP`, `COMMENTS`
- Excel Export 업데이트

### 구현 단계

1. ✅ 스키마 문서화 (현재)
2. ⏳ Backend: Parquet 파일 새 컬럼 지원
3. ⏳ Frontend: 테이블 컬럼 업데이트
4. ⏳ Frontend: 2개 차트 표시 (30D, 60D)
5. ⏳ Excel Export: 새 컬럼 포함
6. ⏳ 테스트 및 검증

