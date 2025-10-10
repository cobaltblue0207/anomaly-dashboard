# Backend 시작 가이드

## ✅ V2 Schema 테스트를 위한 Backend 시작

### 환경 확인
```powershell
# 현재 위치 확인
cd d:\2025\coding\ts_f

# 데이터 파일 확인
dir frame_data.parquet      # ✅ (100 rows, 13 columns)
dir chart_data              # ✅ (100 parquet files)
```

### Backend 시작 방법

**옵션 1: 직접 실행**
```powershell
cd d:\2025\coding\ts_f

# 환경 변수 설정
$env:DATA_DIR="."
$env:CHART_DATA_DIR="./chart_data"

# API 서버 시작
python api.py
```

**옵션 2: uvicorn 사용**
```powershell
cd d:\2025\coding\ts_f

# 환경 변수 설정
$env:DATA_DIR="."
$env:CHART_DATA_DIR="./chart_data"

# uvicorn으로 시작
uvicorn api:app --host 115.136.116.145 --port 8050 --reload
```

### 실행 확인

Backend가 정상 시작되면 다음과 같이 표시됩니다:
```
INFO:     Started server process [xxxxx]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://115.136.116.145:8050 (Press CTRL+C to quit)
```

### Frontend 접속

Backend가 시작된 후:
```
http://localhost:5175
```

### 예상되는 V2 UI

**Filter (상단)**:
- Line: 11, 12, 13, 15, 16, 17, P1, P2, P3, P4, ALL
- Area: CLN, CMP, CVD, DIFF, ETCH, IMP, METAL, PHOTO, ALL
- ❌ ~~Sensor~~ (제거됨)
- ❌ ~~Pattern~~ (제거됨)
- AI Result: ALL, TRUE, FALSE
- From/To: 날짜 선택

**Table Columns**:
1. Task ID (MASTER_TASK_ID)
2. LINE
3. AREA
4. Equipment (PROD_EQP_ID)
5. Parameter (PARAM_SUBITEM)
6. **30D Chart** (Lazy loading)
7. **60D Chart** (Lazy loading)
8. PPID
9. Recipe (RECIPEID)
10. Step (CH_STEP)
11. Model Result (MODEL_RESULT_INFO)
12. Comments (COMMENTS)
13. Notes (사용자 입력)

### 데이터 흐름

```
1. Filter 선택 (예: LINE=11, AREA=ALL)
   ↓
2. Backend: frame_data.parquet 로드 및 필터링
   ↓
3. Frontend: 6개 rows 표시 (LINE=11에 해당하는 tasks)
   ↓
4. 30D/60D Chart 컬럼:
   - LazyChart 컴포넌트가 각 row의 MASTER_TASK_ID로
   - /data/chart/{task_id}?days=30|60 API 호출
   - chart_data/{task_id}.parquet 로드
   - Chart 렌더링
```

### 검증 완료 항목

✅ **데이터 생성**: frame_data.parquet (100 tasks), chart_data/ (100 files)
✅ **Backend 코드**: V2 스키마 완전 지원
✅ **Frontend 코드**: V2 UI, Lazy loading, Excel export
✅ **직접 테스트**: data_loader.py 정상 작동 (6 rows for LINE=11)


