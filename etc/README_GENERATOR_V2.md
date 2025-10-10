# V2 Dataset Generator 사용 가이드

## 개요
`timeseries_dataset_generator.py`가 Schema V2에 맞춰 완전히 개선되었습니다.

---

## 주요 변경사항

### V1 (기존)
- 복잡한 line/area/sensor/pattern 조합
- 개별 파일로 저장
- 많은 수의 작은 parquet 파일 생성

### V2 (현재)
- **Frame 데이터**: 단일 parquet 파일 (뼈대)
- **Chart 데이터**: master_task_id별 개별 parquet 파일
- Schema V2 완벽 준수

---

## 생성되는 데이터

### 1. Frame 데이터 (`frame_data.parquet`)
**13개 컬럼:**
```
1.  MASTER_TASK_ID     - TASK00001, TASK00002, ...
2.  LINE               - LINE1, LINE2, LINE3, ...
3.  AREA               - AREAA, AREAB, AREAC, AREAD
4.  PROD_EQP_ID        - EQP100, EQP101, ..., EQP119
5.  PARAM_SUBITEM      - APC_ANGLE_AV, CHAMBER_PRESS_ST, ...
6.  PPID               - PPID_001, PPID_002, ..., PPID_020
7.  RECIPEID           - RECIPE_001, ..., RECIPE_010
8.  CH_STEP            - STEP_001, ..., STEP_005
9.  MODEL_RESULT_INFO  - PASS, FAIL, WARNING
10. 30D                - None (Frontend에서 채움)
11. 60D                - None (Frontend에서 채움)
12. COMMENTS           - Auto-generated comment
13. NOTES              - None (Frontend에서 채움)
```

**기본 설정:**
- 100개 task 생성 (TASK00001 ~ TASK00100)
- 각 task는 랜덤한 LINE, AREA, 설비 정보 포함

### 2. Chart 데이터 (`chart_data/*.parquet`)
**각 파일 구조:**
```
컬럼: master_task_id, act_date, value, spec_lower, spec_upper
행수: 60 (60일치 데이터)
```

**파일 구조:**
```
chart_data/
├── TASK00001.parquet  (60 rows)
├── TASK00002.parquet  (60 rows)
├── TASK00003.parquet  (60 rows)
...
└── TASK00100.parquet  (60 rows)
```

---

## 사용 방법

### 1. 스크립트 실행
```bash
cd etc
python timeseries_dataset_generator.py
```

### 2. 실행 결과
```
============================================================
V2 Dataset Generator
============================================================
Configuration:
  - Number of tasks: 100
  - Start Date: 2024-12-10 00:00:00
  - Days: 60
  - Frequency: 1D

Generating 100 tasks...
100%|████████████████████████| 100/100 [00:XX<00:00, XX.XXit/s]

============================================================
✅ Generation completed!
============================================================
📊 Frame data: frame_data.parquet
   - Shape: (100, 13)
   - Columns: ['MASTER_TASK_ID', 'LINE', 'AREA', ...]

📈 Chart data: chart_data/
   - Files: 100 parquet files
   - Each file: 60 days of data

Sample Frame row:
{'MASTER_TASK_ID': 'TASK00001', 'LINE': 'LINE2', ...}
```

### 3. 생성된 파일
```
etc/
├── frame_data.parquet      # Frame 데이터 (100 rows)
└── chart_data/             # Chart 데이터 폴더
    ├── TASK00001.parquet
    ├── TASK00002.parquet
    ...
    └── TASK00100.parquet
```

---

## 설정 변경

### 기본 설정 (100개 task)
```python
cfg = GeneratorConfig(
    start_date=datetime(2024, 12, 10, 0, 0, 0),
    days=60,
    freq="1D",
    num_tasks=100,
    random_seed=42
)
```

### 더 많은 task 생성 (1000개)
```python
cfg = GeneratorConfig(
    start_date=datetime(2024, 12, 10, 0, 0, 0),
    days=60,
    freq="1D",
    num_tasks=1000,  # ← 변경
    random_seed=42
)
```

### 더 긴 기간 (90일)
```python
cfg = GeneratorConfig(
    start_date=datetime(2024, 10, 1, 0, 0, 0),
    days=90,  # ← 변경
    freq="1D",
    num_tasks=100,
    random_seed=42
)
```

---

## 데이터 적용

### 1. 파일 이동
```bash
# Frame 데이터
mv etc/frame_data.parquet ./frame_data.parquet

# Chart 데이터
mv etc/chart_data ./chart_data
```

### 2. 환경변수 설정 (`.env`)
```bash
DATA_DIR=./frame_data.parquet
CHART_DATA_DIR=./chart_data
```

### 3. Backend 재시작
```bash
uvicorn api:app --host 115.136.116.145 --port 8050
```

### 4. API 테스트
```bash
# Chart 데이터 조회
curl http://localhost:8050/data/chart/TASK00001?days=60
```

---

## 데이터 특징

### Frame 데이터
- **랜덤 조합**: LINE, AREA, 설비 등 모두 랜덤하게 조합
- **필터 가능**: LINE, AREA로 필터링 가능
- **확장 가능**: 컬럼 추가 쉬움

### Chart 데이터
- **60일 데이터**: 각 task당 60개 데이터 포인트
- **일별 데이터**: 하루 단위 (freq="1D")
- **패턴 다양**: trend_up, trend_down, stable, drift, wave
- **스펙 포함**: spec_lower, spec_upper 자동 계산

---

## 고급 사용

### 프로그래밍 방식으로 사용
```python
from timeseries_dataset_generator import TimeSeriesDataGenerator, GeneratorConfig
from datetime import datetime

cfg = GeneratorConfig(
    start_date=datetime(2024, 12, 10),
    days=60,
    num_tasks=50,
    random_seed=123
)

gen = TimeSeriesDataGenerator(cfg)
df_frame, num_charts = gen.generate_all(
    frame_output="my_frame.parquet",
    chart_output_dir="my_charts"
)

print(f"Generated {num_charts} chart files")
print(df_frame.head())
```

### 특정 task만 생성
```python
gen = TimeSeriesDataGenerator(cfg)

# 단일 task의 chart 데이터만 생성
chart_df = gen.generate_chart_data("TASK00001")
chart_df.to_parquet("custom_chart.parquet")
```

---

## 문제 해결

### Q: tqdm이 없다는 오류
```bash
pip install tqdm
```

### Q: 생성 시간이 너무 오래 걸림
- `num_tasks` 줄이기 (100 → 50)
- `days` 줄이기 (60 → 30)

### Q: 메모리 부족
- 한번에 생성하지 말고 배치로 나눠서 생성
- `num_tasks`를 작게 설정

---

## 요약

✅ **V2 스키마 완벽 준수**
✅ **Frame + Chart 분리 구조**
✅ **master_task_id별 개별 parquet**
✅ **LINE, AREA 필터링 가능**
✅ **간단한 실행: `python timeseries_dataset_generator.py`**

**100개 task × 60일 데이터를 몇 초 안에 생성!** 🚀

