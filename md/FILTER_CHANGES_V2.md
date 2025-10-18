# Frontend Filter 변경사항 (V2)

## 개요
기존 필터 구조를 단순화하고, Frame 데이터의 실제 컬럼에 맞춰 재구성합니다.

---

## 변경 사항

### ✅ 유지되는 필터
| 필터명 | 설명 | 값 예시 |
|--------|------|---------|
| `line` | 라인 정보 | "LINE1", "LINE2", "ALL" |
| `area` | 영역 정보 | "AREAA", "AREAB", "ALL" |
| `ai_result` | AI 결과 (MODEL_RESULT_INFO) | "PASS", "FAIL", "WARNING", "ALL" |
| `period_from` | 시작 날짜 | "2025-01-01" |
| `period_to` | 종료 날짜 | "2025-01-31" |

### ❌ 삭제 예정 필터
| 필터명 | 이유 |
|--------|------|
| `sensors` | Frame 데이터에 없는 컬럼 |
| `patterns` | Frame 데이터에 없는 컬럼 |

**NOTE**: `sensors`와 `patterns`는 기존 parquet 구조에만 존재했으며, 새로운 Frame 데이터에는 해당 컬럼이 없습니다.

---

## Backend Filter 구조 (기존)

### 현재 (`api.py`)
```python
class Filters(BaseModel):
    line: str = "ALL"
    area: str = "ALL"
    sensors: str = "ALL"      # ❌ 삭제 예정
    ai_result: str = "ALL"
    patterns: str = "ALL"     # ❌ 삭제 예정
    period_from: Optional[str] = None
    period_to: Optional[str] = None
```

### V2 (수정 예정)
```python
class Filters(BaseModel):
    line: str = "ALL"
    area: str = "ALL"
    ai_result: str = "ALL"    # MODEL_RESULT_INFO에 매핑
    period_from: Optional[str] = None
    period_to: Optional[str] = None
```

---

## Frontend Filter UI (변경 예정)

### 기존 구조
```tsx
<FilterPanel>
  <Select name="line" />
  <Select name="area" />
  <Select name="sensors" />    {/* ❌ 삭제 */}
  <Select name="patterns" />   {/* ❌ 삭제 */}
  <Select name="ai_result" />
  <DatePicker name="period_from" />
  <DatePicker name="period_to" />
</FilterPanel>
```

### V2 구조 (단순화)
```tsx
<FilterPanel>
  <Select name="line" />
  <Select name="area" />
  <Select name="ai_result" label="Model Result" />
  <DatePicker name="period_from" />
  <DatePicker name="period_to" />
</FilterPanel>
```

---

## Filter Options API

### 기존 응답 (`/filters/options`)
```json
{
  "line": ["LINE1", "LINE2", "LINE3"],
  "area": ["AREAA", "AREAB", "AREAC"],
  "sensors": ["SENSOR1", "SENSOR2"],    // ❌ 삭제
  "patterns": ["PATTERN1", "PATTERN2"], // ❌ 삭제
  "ai_result": ["PASS", "FAIL", "WARNING"]
}
```

### V2 응답 (단순화)
```json
{
  "line": ["LINE1", "LINE2", "LINE3"],
  "area": ["AREAA", "AREAB", "AREAC"],
  "ai_result": ["PASS", "FAIL", "WARNING"]
}
```

---

## 데이터 필터링 로직

### Frame 데이터 필터링
```python
# Frame parquet 파일 읽기
df_frame = pd.read_parquet('frame_data.parquet')

# 필터 적용
if filters.line != "ALL":
    df_frame = df_frame[df_frame['LINE'] == filters.line]

if filters.area != "ALL":
    df_frame = df_frame[df_frame['AREA'] == filters.area]

if filters.ai_result != "ALL":
    df_frame = df_frame[df_frame['MODEL_RESULT_INFO'] == filters.ai_result]

# 기간 필터 (Chart 데이터에서 처리)
# Frame에는 날짜 정보가 없으므로, Chart 로드 시 적용
```

---

## Migration 체크리스트

### Backend
- [ ] `api.py`: `Filters` 모델 수정 (sensors, patterns 제거)
- [ ] `data_loader.py`: 필터 로직 수정
- [ ] `/filters/options` API 응답 수정

### Frontend
- [ ] Filter UI 컴포넌트 수정 (sensors, patterns 제거)
- [ ] Filter 타입 정의 업데이트
- [ ] Filter 옵션 fetch 로직 수정

### 테스트
- [ ] 기존 데이터로 필터 동작 확인
- [ ] 새 Frame 데이터로 필터 동작 확인
- [ ] Filter Options API 응답 확인

---

## 호환성 전략

### Phase 1: Backend 준비
- Filters에서 sensors, patterns를 optional로 변경
- 있으면 무시, 없으면 정상 동작

```python
class Filters(BaseModel):
    line: str = "ALL"
    area: str = "ALL"
    sensors: Optional[str] = "ALL"    # Optional로 변경
    ai_result: str = "ALL"
    patterns: Optional[str] = "ALL"   # Optional로 변경
    period_from: Optional[str] = None
    period_to: Optional[str] = None
```

### Phase 2: Frontend 수정
- Filter UI에서 sensors, patterns 제거
- API 요청 시 해당 필드 제외

### Phase 3: Backend 정리
- Filters에서 sensors, patterns 완전히 제거
- 관련 코드 정리

---

## 예상 영향

### 긍정적 영향
- ✅ Filter UI 단순화 (더 직관적)
- ✅ Backend 로직 단순화
- ✅ Frame 데이터 구조와 일치
- ✅ 유지보수 용이

### 주의사항
- ⚠️ 기존 사용자 익숙함 변화
- ⚠️ 기존 저장된 필터 설정 무효화
- ⚠️ 기존 데이터와 호환성 고려 필요

---

## 결론

새로운 Frame 데이터 구조에 맞춰 Filter를 단순화하면:
- **LINE**, **AREA** → Frame의 실제 컬럼
- **sensors**, **patterns** → 삭제 (데이터에 없음)
- **ai_result** → MODEL_RESULT_INFO에 매핑

더 깔끔하고 유지보수하기 쉬운 구조가 됩니다.

