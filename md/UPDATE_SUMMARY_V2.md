# V2 업데이트 요약

## ✅ 완료된 변경사항

### 1. Frame 데이터 컬럼 추가 (13개 → 15개로 확장)

**추가된 컬럼:**
- `LINE` (string, 50자) - 라인 정보 (검색 필터용)
- `AREA` (string, 50자) - 영역 정보 (검색 필터용)

**최종 컬럼 순서:**
```
1.  MASTER_TASK_ID     (PK, 유니크 키)
2.  LINE               ✨ 신규 (검색 필터)
3.  AREA               ✨ 신규 (검색 필터)
4.  PROD_EQP_ID        (설비호기)
5.  PARAM_SUBITEM      (파라미터명)
6.  PPID               (프로세스 플랜 ID)
7.  RECIPEID           (레시피 ID)
8.  CH_STEP            (챔버 스텝)
9.  MODEL_RESULT_INFO  (모델 결과)
10. 30D                (Frontend 차트 - null)
11. 60D                (Frontend 차트 - null)
12. COMMENTS           (코멘트)
13. NOTES              (사용자 노트 - null)
```

### 2. 검색 필터 변경

**유지:**
- ✅ `line` - LINE 컬럼에 매핑
- ✅ `area` - AREA 컬럼에 매핑
- ✅ `ai_result` - MODEL_RESULT_INFO에 매핑
- ✅ `period_from`, `period_to` - 날짜 필터

**삭제 예정:**
- ❌ `sensors` - Frame 데이터에 해당 컬럼 없음
- ❌ `patterns` - Frame 데이터에 해당 컬럼 없음

### 3. 업데이트된 파일

#### 문서
- ✅ `SCHEMA_V2.md` - LINE, AREA 추가, 13개 → 15개 컬럼
- ✅ `ARCHITECTURE_V2.md` - Frame 데이터 예시 업데이트
- ✅ `FILTER_CHANGES_V2.md` - 필터 변경사항 상세 설명 (신규)

#### 코드
- ✅ `frontend/src/types/schema.ts` - RowData에 LINE, AREA 추가
- ✅ `prepare_data_v2_example.py` - 예제 스크립트에 LINE, AREA 추가

---

## 📊 데이터 준비 예시

### Frame 데이터 생성 (Python)
```python
import pandas as pd
import numpy as np

df_frame = pd.DataFrame({
    'MASTER_TASK_ID': ['TASK00001', 'TASK00002', ...],
    
    # 검색 필터용 컬럼
    'LINE': ['LINE1', 'LINE2', 'LINE3', ...],
    'AREA': ['AREAA', 'AREAB', 'AREAC', ...],
    
    # 설비/파라미터 정보
    'PROD_EQP_ID': ['EQP100', 'EQP101', ...],
    'PARAM_SUBITEM': ['APC_ANGLE_AV', 'CHAMBER_PRESS_ST', ...],
    
    # 프로세스 정보
    'PPID': ['PPID_001', 'PPID_002', ...],
    'RECIPEID': ['RECIPE_001', 'RECIPE_002', ...],
    'CH_STEP': ['STEP_001', 'STEP_002', ...],
    
    # 모델 결과 & 코멘트
    'MODEL_RESULT_INFO': ['PASS', 'FAIL', 'WARNING', ...],
    'COMMENTS': ['Comment 1', 'Comment 2', ...],
    
    # Frontend에서 채울 필드
    '30D': [None] * len(df),
    '60D': [None] * len(df),
    'NOTES': [None] * len(df)
})

df_frame.to_parquet('frame_data.parquet', index=False)
```

### 예제 스크립트 실행
```bash
python prepare_data_v2_example.py
```

---

## 🔄 다음 단계 (Todo)

### Backend
- [ ] `api.py`: Filters 모델 수정 (sensors, patterns optional로)
- [ ] `data_loader.py`: Frame 데이터 필터링 로직 수정
- [ ] `/filters/options`: LINE, AREA 옵션 반환

### Frontend
- [ ] Filter UI: sensors, patterns 제거
- [ ] Filter 타입: sensors, patterns optional로
- [ ] Table: LINE, AREA 컬럼 추가 표시

### 데이터
- [ ] Frame 데이터 준비 (LINE, AREA 포함)
- [ ] Chart 데이터 준비 (기존과 동일)

---

## 📁 최종 파일 구조

```
프로젝트/
├── frame_data.parquet              # LINE, AREA 포함 (13개 컬럼)
├── chart_data/
│   ├── TASK00001.parquet          # 시계열 데이터
│   └── ...
├── SCHEMA_V2.md                    # ✅ 업데이트됨
├── ARCHITECTURE_V2.md              # ✅ 업데이트됨
├── FILTER_CHANGES_V2.md            # ✨ 신규 (필터 변경 가이드)
├── UPDATE_SUMMARY_V2.md            # ✨ 신규 (이 문서)
├── prepare_data_v2_example.py      # ✅ 업데이트됨
└── frontend/src/types/schema.ts    # ✅ 업데이트됨
```

---

## 🎯 핵심 변경사항 요약

1. **Frame 데이터 확장**
   - 13개 → **15개 컬럼** (LINE, AREA 추가)
   - LINE, AREA는 검색 필터로 사용

2. **필터 단순화**
   - sensors, patterns 제거 예정
   - LINE, AREA, ai_result만 유지

3. **문서 완성도**
   - 모든 변경사항 문서화
   - 예제 코드 업데이트
   - 마이그레이션 가이드 제공

---

## ✅ 준비 완료

모든 문서와 예제 코드가 업데이트되었습니다!

**다음:**
1. `prepare_data_v2_example.py` 실행하여 샘플 데이터 생성
2. Backend Filter 로직 수정 (optional)
3. Frontend UI 업데이트 (optional)
4. 실제 Parquet 파일 준비되면 테스트

**LINE, AREA 컬럼이 추가된 Frame 데이터 준비만 하시면 됩니다!** 🚀

