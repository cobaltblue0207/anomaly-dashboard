# Notes 저장/로드 문제 해결 기록

## 문제 요약

V2 스키마로 전환 후, Notes가 DB에는 정상적으로 저장되지만 페이지 새로고침 시 표시되지 않는 문제 발생.
단, **다른 Note를 수정/저장하면 갑자기 모든 Notes가 정상적으로 표시**되는 이상한 현상.

## 근본 원인

### 1. DB 스키마 문제
- **기존**: `notes` 테이블 - `(user_id, pattern, variant_id)` composite key
- **V2 요구사항**: pattern 없이 `(user_id, task_id)` 조합으로 CRUD

**해결**: `new_notes` 테이블 신규 생성
```sql
CREATE TABLE new_notes (
    user_id TEXT NOT NULL,
    task_id TEXT NOT NULL,      -- MASTER_TASK_ID
    note TEXT,
    created_at TEXT NOT NULL,
    created_by TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL,
    PRIMARY KEY (user_id, task_id)
)
```

### 2. Backend API 문제
- V2 스키마 감지 로직 추가 필요
- `pattern == "ALL"` → V2 → `new_notes` 테이블 사용
- `pattern != "ALL"` → Legacy → `notes` 테이블 사용

**해결**: 
- `load_notes_v2()`, `save_note_v2()` 함수 추가 (`db.py`)
- `/data/query`와 `/notes/save` 엔드포인트에서 스키마 감지 로직 구현 (`api.py`)

### 3. Frontend 렌더링 문제 (핵심 원인)

**문제**: 
```typescript
const notesMapRef = useRef<Record<string, any>>({});

useEffect(() => {
  if (notesData) {
    notesMapRef.current = notesData;  // ref 업데이트
  }
}, [notesData]);

const columns = useMemo(() => {
  // ... 컬럼 정의에서 notesMapRef.current 사용
}, [mSave, isV2, rows]);  // ❌ notesData 변경 시 컬럼 재생성 안됨
```

**실행 순서 문제**:
1. `rows` prop 변경 → `useMemo` 실행 → 컬럼 생성 (이때 `notesMapRef.current`는 `{}`)
2. `notesData` prop 변경 → `useEffect` 실행 → `notesMapRef.current` 업데이트
3. **하지만 컬럼은 이미 생성되었고, ref만 업데이트되어 렌더링에 반영 안됨**

**왜 저장 후에는 보였는가?**:
- `onSuccess`에서 `notesMapRef.current`를 업데이트하면서 다른 로직이 trigger되어 우연히 재렌더링됨

**해결**:
```typescript
// ref 대신 state 사용
const [notesMap, setNotesMap] = useState<Record<string, any>>({});

useEffect(() => {
  if (notesData) {
    setNotesMap(notesData);  // state 업데이트 → 자동 재렌더링
  }
}, [notesData]);

const columns = useMemo(() => {
  // ... notesMap 사용
}, [mSave, isV2, rows, notesMap]);  // ✅ notesMap 변경 시 컬럼 재생성
```

## 핵심 교훈

1. **React의 ref vs state**:
   - `useRef`: 값이 변경되어도 재렌더링 안됨 (성능 최적화용)
   - `useState`: 값이 변경되면 자동 재렌더링
   - 렌더링에 영향을 주어야 하는 데이터는 **반드시 state 사용**

2. **useMemo 의존성 배열**:
   - memo 내부에서 사용하는 모든 외부 변수는 의존성 배열에 포함해야 함
   - ref는 의존성 배열에 넣어도 효과 없음 (ref 객체 자체는 불변)

3. **비동기 데이터 로딩**:
   - Props가 여러 번 업데이트될 수 있음을 고려
   - 초기 렌더링 시 데이터가 없을 수 있음을 항상 대비

## 변경 파일 목록

### Backend
- `db.py`: `new_notes` 테이블 및 V2 CRUD 함수 추가
- `api.py`: V2 스키마 감지 및 분기 로직 추가

### Frontend
- `DashboardTable.tsx`: `notesMapRef` → `notesMap` state로 변경

## 테스트 체크리스트

- [x] Notes 저장 → DB의 `new_notes` 테이블에 저장됨
- [x] 페이지 새로고침 → Notes 즉시 표시됨
- [x] 다른 Task의 Note 수정 → 모든 Notes 정상 표시 유지
- [x] Focus 문제 없음 (입력 중 focus 유지)

## 날짜
2025-10-10

