# Production 환경 마이그레이션 계획

## 📋 개요
현재 정적 Parquet 파일 기반 시스템을 Oracle DB + AWS S3 기반 동적 데이터 로딩 시스템으로 전환

---

## 🎯 시나리오

### 1️⃣ 사용자 검색 필터 입력 → Run 버튼 클릭
**현재 구현:**
- Frontend에서 `filters` 객체 생성
- Backend `/data/query` API 호출

**변경 필요 없음:**
- Frontend 로직 그대로 유지
- Backend가 filters를 받아서 처리하는 방식은 동일

---

### 2️⃣ Oracle DB 연동 - Frame Data 생성
**목표:**
- 필터 조건 기반 동적 SQL 쿼리 생성
- 쿼리 결과로 `{user_id}_frame_data.parquet` 생성
- Frontend로 데이터 전달

#### 📦 필요한 준비사항

##### A. Python 패키지 설치
```python
# requirements.txt에 추가
cx_Oracle>=8.3.0  # Oracle DB connector
# 또는
oracledb>=1.0.0   # python-oracledb (thin mode, 설치 간편)
```

##### B. 환경 변수 추가 (`.env`)
```bash
# Oracle DB 연결 정보
ORACLE_HOST=your-oracle-host
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=your-service-name
ORACLE_USER=your-username
ORACLE_PASSWORD=your-password

# 또는 Connection String
ORACLE_DSN=your-oracle-host:1521/your-service-name
```

##### C. 새로운 모듈 생성: `oracle_connector.py`
```python
import oracledb
import pandas as pd
from typing import Dict, Optional
import os
from dotenv import load_dotenv

load_dotenv()

class OracleFrameDataLoader:
    """Oracle DB에서 Frame 데이터를 조회하여 Parquet로 변환"""
    
    def __init__(self):
        self.host = os.getenv("ORACLE_HOST")
        self.port = os.getenv("ORACLE_PORT", "1521")
        self.service_name = os.getenv("ORACLE_SERVICE_NAME")
        self.user = os.getenv("ORACLE_USER")
        self.password = os.getenv("ORACLE_PASSWORD")
    
    def get_connection(self):
        """Oracle DB 연결 생성"""
        dsn = f"{self.host}:{self.port}/{self.service_name}"
        return oracledb.connect(user=self.user, password=self.password, dsn=dsn)
    
    def build_query(self, filters: Dict) -> str:
        """필터 조건 기반 SQL 쿼리 생성"""
        base_query = """
        SELECT 
            MASTER_TASK_ID,
            LINE,
            AREA,
            PROD_EQP_ID,
            PARAM_SUBITEM,
            PPID,
            RECIPEID,
            CH_STEP,
            MODEL_RESULT_INFO,
            COMMENTS
        FROM YOUR_TABLE_NAME
        WHERE 1=1
        """
        
        conditions = []
        params = {}
        
        # LINE 필터
        line = filters.get("line", "ALL")
        if line != "ALL":
            if isinstance(line, list):
                placeholders = ",".join([f":line_{i}" for i in range(len(line))])
                conditions.append(f"LINE IN ({placeholders})")
                for i, val in enumerate(line):
                    params[f"line_{i}"] = val
            else:
                conditions.append("LINE = :line")
                params["line"] = line
        
        # AREA 필터
        area = filters.get("area", "ALL")
        if area != "ALL":
            conditions.append("AREA = :area")
            params["area"] = area
        
        # AI_RESULT 필터 (MODEL_RESULT_INFO)
        ai_result = filters.get("ai_result", "ALL")
        if ai_result == "TRUE":
            conditions.append("MODEL_RESULT_INFO LIKE '%TRUE%'")
        elif ai_result == "FALSE":
            conditions.append("MODEL_RESULT_INFO NOT LIKE '%TRUE%'")
        
        # 날짜 필터 (필요시)
        if filters.get("period_from") and filters.get("period_to"):
            conditions.append("ACT_DATE BETWEEN :period_from AND :period_to")
            params["period_from"] = filters["period_from"]
            params["period_to"] = filters["period_to"]
        
        # WHERE 조건 추가
        if conditions:
            base_query += " AND " + " AND ".join(conditions)
        
        return base_query, params
    
    def load_frame_data(self, filters: Dict, user_id: str) -> pd.DataFrame:
        """
        Oracle DB에서 Frame 데이터 조회
        
        Args:
            filters: 검색 필터 조건
            user_id: 사용자 ID (캐싱용)
        
        Returns:
            DataFrame with Frame columns
        """
        query, params = self.build_query(filters)
        
        with self.get_connection() as conn:
            # pandas read_sql 사용
            df = pd.read_sql(query, conn, params=params)
        
        # V2 스키마 컬럼 추가 (빈 값)
        df['30D'] = None
        df['60D'] = None
        df['NOTES'] = None
        
        return df
    
    def save_frame_parquet(self, df: pd.DataFrame, user_id: str, 
                          output_dir: str = "./temp_frames") -> str:
        """
        DataFrame을 사용자별 Parquet 파일로 저장
        
        Args:
            df: Frame DataFrame
            user_id: 사용자 ID
            output_dir: 출력 디렉토리
        
        Returns:
            저장된 파일 경로
        """
        os.makedirs(output_dir, exist_ok=True)
        file_path = os.path.join(output_dir, f"{user_id}_frame_data.parquet")
        df.to_parquet(file_path, index=False)
        return file_path
```

##### D. `api.py` 수정 - `/data/query` 엔드포인트
```python
from oracle_connector import OracleFrameDataLoader

oracle_loader = OracleFrameDataLoader()

@app.post("/data/query", response_model=QueryResponse)
def data_query(req: QueryRequest) -> JSONResponse:
    t0 = time.perf_counter()
    
    try:
        filters_dict = req.filters.dict()
        
        # 환경 변수로 모드 선택
        USE_ORACLE = os.getenv("USE_ORACLE", "false").lower() == "true"
        
        if USE_ORACLE:
            # Production: Oracle DB에서 데이터 로드
            logger.info(f"Loading frame data from Oracle DB with filters: {filters_dict}")
            df = oracle_loader.load_frame_data(filters_dict, req.user_id or "default")
            
            # Optional: Parquet로 캐싱
            if os.getenv("CACHE_FRAME_DATA", "false").lower() == "true":
                oracle_loader.save_frame_parquet(df, req.user_id or "default")
        else:
            # Development: 기존 로직 (정적 Parquet 파일)
            df = load_parquet_files_by_filter(filters_dict, DATA_DIR)
        
        # 이후 로직은 동일
        # ...
```

---

### 3️⃣ AWS S3 연동 - Chart Data 로딩
**목표:**
- `MASTER_TASK_ID`별 chart data를 S3에서 다운로드
- 필요한 파일만 선택적으로 다운로드 (Lazy Loading)

#### 📦 필요한 준비사항

##### A. Python 패키지 설치
```python
# requirements.txt에 추가
boto3>=1.26.0  # AWS SDK for Python
```

##### B. 환경 변수 추가 (`.env`)
```bash
# AWS S3 설정
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
S3_CHART_DATA_PREFIX=chart_data/  # S3 내 chart 데이터 경로

# Optional: Local cache directory
S3_CACHE_DIR=./s3_cache
```

##### C. 새로운 모듈 생성: `s3_connector.py`
```python
import boto3
import os
import pandas as pd
from typing import Optional
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)

class S3ChartDataLoader:
    """AWS S3에서 Chart 데이터를 다운로드"""
    
    def __init__(self):
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
        )
        self.bucket = os.getenv("S3_BUCKET_NAME")
        self.prefix = os.getenv("S3_CHART_DATA_PREFIX", "chart_data/")
        self.cache_dir = os.getenv("S3_CACHE_DIR", "./s3_cache")
        os.makedirs(self.cache_dir, exist_ok=True)
    
    def get_chart_data_path(self, master_task_id: str) -> str:
        """S3 객체 키 생성"""
        return f"{self.prefix}{master_task_id}.parquet"
    
    def download_chart_data(self, master_task_id: str, use_cache: bool = True) -> Optional[pd.DataFrame]:
        """
        S3에서 chart data 다운로드
        
        Args:
            master_task_id: Task ID
            use_cache: 로컬 캐시 사용 여부
        
        Returns:
            DataFrame 또는 None (파일이 없을 경우)
        """
        cache_file = os.path.join(self.cache_dir, f"{master_task_id}.parquet")
        
        # 1. 캐시 확인
        if use_cache and os.path.exists(cache_file):
            # 캐시 유효 시간 체크 (예: 1시간)
            import time
            if time.time() - os.path.getmtime(cache_file) < 3600:
                logger.info(f"Using cached chart data for {master_task_id}")
                return pd.read_parquet(cache_file)
        
        # 2. S3에서 다운로드
        s3_key = self.get_chart_data_path(master_task_id)
        
        try:
            logger.info(f"Downloading chart data from S3: {s3_key}")
            response = self.s3_client.get_object(Bucket=self.bucket, Key=s3_key)
            
            # Parquet 파일을 메모리에서 읽기
            import io
            parquet_bytes = response['Body'].read()
            df = pd.read_parquet(io.BytesIO(parquet_bytes))
            
            # 캐시 저장
            if use_cache:
                df.to_parquet(cache_file, index=False)
            
            return df
        
        except self.s3_client.exceptions.NoSuchKey:
            logger.warning(f"Chart data not found in S3: {s3_key}")
            return None
        except Exception as e:
            logger.error(f"Error downloading from S3: {e}", exc_info=True)
            return None
    
    def download_batch(self, master_task_ids: list[str], use_cache: bool = True) -> dict:
        """
        여러 chart data를 배치로 다운로드
        
        Args:
            master_task_ids: Task ID 리스트
            use_cache: 캐시 사용 여부
        
        Returns:
            Dict[master_task_id, DataFrame]
        """
        results = {}
        for task_id in master_task_ids:
            df = self.download_chart_data(task_id, use_cache)
            if df is not None:
                results[task_id] = df
        return results
```

##### D. `data_loader.py` 수정
```python
# data_loader.py에 추가

from s3_connector import S3ChartDataLoader

# 전역 S3 loader 인스턴스
_s3_loader = None

def get_s3_loader():
    """S3 loader 싱글톤 인스턴스"""
    global _s3_loader
    if _s3_loader is None:
        _s3_loader = S3ChartDataLoader()
    return _s3_loader

def load_chart_data_single(master_task_id: str, days: int = 60):
    """
    단일 chart data 로드 (S3 또는 로컬)
    
    Args:
        master_task_id: Task ID
        days: 날짜 범위 (30 or 60)
    
    Returns:
        Chart data dict
    """
    USE_S3 = os.getenv("USE_S3", "false").lower() == "true"
    
    if USE_S3:
        # S3에서 다운로드
        s3_loader = get_s3_loader()
        df = s3_loader.download_chart_data(master_task_id)
        
        if df is None:
            return {"data": {"act_date": [], "value": [], "spec_lower": [], "spec_upper": []}}
        
        # 날짜 필터링 (30D or 60D)
        if days == 30:
            cutoff_date = pd.Timestamp.now() - pd.Timedelta(days=30)
            df = df[df['act_date'] >= cutoff_date]
        
        return {
            "data": {
                "act_date": df['act_date'].dt.strftime('%Y-%m-%d').tolist(),
                "value": df['value'].tolist(),
                "spec_lower": df['spec_lower'].tolist(),
                "spec_upper": df['spec_upper'].tolist(),
            }
        }
    else:
        # 기존 로직 (로컬 파일)
        # ... 현재 코드 유지
```

##### E. `api.py` 수정 - Chart 데이터 엔드포인트
```python
from oracle_connector import OracleFrameDataLoader
from s3_connector import S3ChartDataLoader

# 전역 인스턴스
oracle_loader = None
s3_loader = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events."""
    global oracle_loader, s3_loader
    
    # Startup
    init_db()
    init_filter_history_table()
    
    # Oracle 연결 초기화
    if os.getenv("USE_ORACLE", "false").lower() == "true":
        oracle_loader = OracleFrameDataLoader()
        logger.info("✅ Oracle DB connector initialized")
    
    # S3 연결 초기화
    if os.getenv("USE_S3", "false").lower() == "true":
        s3_loader = S3ChartDataLoader()
        logger.info("✅ AWS S3 connector initialized")
    
    yield
    
    # Shutdown
    # Connection pool cleanup if needed
```

---

## 🔄 데이터 플로우 비교

### 현재 (Development)
```
1. Run 버튼 클릭
   ↓
2. Backend: frame_data.parquet 읽기 (정적 파일)
   ↓
3. Backend: 필터링 적용
   ↓
4. Frontend: 데이터 표시
   ↓
5. Frontend: Chart 필요 시 chart_data/*.parquet 요청 (정적 파일)
```

### Production (계획)
```
1. Run 버튼 클릭
   ↓
2. Backend: Oracle DB 쿼리 실행
   ├─ SQL 동적 생성 (필터 기반)
   └─ 결과 → DataFrame → {user_id}_frame_data.parquet (Optional)
   ↓
3. Frontend: 데이터 표시
   ↓
4. Frontend: Chart 필요 시 /data/chart/{master_task_id} 요청
   ↓
5. Backend: AWS S3에서 다운로드
   ├─ s3://bucket/chart_data/{MASTER_TASK_ID}.parquet
   ├─ 로컬 캐시 확인 (있으면 캐시 사용)
   └─ 없으면 S3 다운로드 후 캐시 저장
   ↓
6. Frontend: Chart 렌더링
```

---

## 📂 파일 구조 변경

### 현재 구조
```
ts_f/
├── frame_data.parquet          # 정적 파일
├── chart_data/
│   ├── TASK00001.parquet
│   ├── TASK00002.parquet
│   └── ...
├── api.py
├── data_loader.py
└── ...
```

### Production 구조
```
ts_f/
├── oracle_connector.py         # 신규 - Oracle DB 연동
├── s3_connector.py             # 신규 - AWS S3 연동
├── temp_frames/                # 신규 - 사용자별 임시 frame 저장
│   ├── user_a_frame_data.parquet
│   └── user_b_frame_data.parquet
├── s3_cache/                   # 신규 - S3 다운로드 캐시
│   ├── TASK00001.parquet
│   ├── TASK00002.parquet
│   └── ...
├── api.py                      # 수정 - Oracle/S3 로직 추가
├── data_loader.py              # 수정 - S3 로딩 로직 추가
├── .env                        # 수정 - Oracle/S3 설정 추가
└── ...
```

---

## 🔧 환경 변수 설정 (.env)

### Development Mode (현재)
```bash
DATA_DIR=.
CHART_DATA_DIR=./chart_data
USE_ORACLE=false
USE_S3=false
```

### Production Mode
```bash
# Oracle DB
USE_ORACLE=true
ORACLE_HOST=your-oracle-host
ORACLE_PORT=1521
ORACLE_SERVICE_NAME=your-service
ORACLE_USER=your-user
ORACLE_PASSWORD=your-password

# AWS S3
USE_S3=true
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket
S3_CHART_DATA_PREFIX=chart_data/
S3_CACHE_DIR=./s3_cache

# Optional: Frame data caching
CACHE_FRAME_DATA=true
TEMP_FRAME_DIR=./temp_frames

# API Server
API_HOST=0.0.0.0
API_PORT=8050
```

---

## 🚀 마이그레이션 단계

### Phase 1: Oracle DB 연동 (Frame Data)
1. ✅ `oracle_connector.py` 모듈 작성
2. ✅ Oracle DB 연결 테스트
3. ✅ SQL 쿼리 빌더 구현 및 테스트
4. ✅ `api.py`에 Oracle 로직 추가
5. ✅ 기존 로직과 병행 운영 (`USE_ORACLE` flag)
6. ✅ 테스트 및 검증

### Phase 2: AWS S3 연동 (Chart Data)
1. ✅ `s3_connector.py` 모듈 작성
2. ✅ S3 연결 및 다운로드 테스트
3. ✅ 캐싱 로직 구현
4. ✅ `data_loader.py`에 S3 로직 추가
5. ✅ 기존 로직과 병행 운영 (`USE_S3` flag)
6. ✅ 배치 다운로드 최적화
7. ✅ 테스트 및 검증

### Phase 3: 통합 및 최적화
1. ✅ Oracle + S3 통합 테스트
2. ✅ 성능 모니터링 및 최적화
3. ✅ 캐시 전략 최적화
4. ✅ 에러 핸들링 강화
5. ✅ 로깅 및 모니터링 추가

---

## ⚠️ 주의사항

### 1. 캐싱 전략
- **Frame Data**: 사용자별 캐싱 (동일 필터 재조회 시 빠른 응답)
- **Chart Data**: MASTER_TASK_ID별 캐싱 (S3 다운로드 최소화)
- **TTL (Time To Live)**: 1시간 기본, 환경 변수로 조정 가능

### 2. 동시성 처리
- Oracle 연결 풀 설정 필요
- S3 다운로드 병렬 처리 (asyncio 또는 ThreadPoolExecutor)

### 3. 에러 핸들링
- Oracle DB 연결 실패 시 fallback 전략
- S3 다운로드 실패 시 빈 데이터 반환 또는 재시도

### 4. 보안
- 환경 변수에 민감 정보 저장 (`.env`)
- `.env` 파일을 `.gitignore`에 추가
- Production에서는 AWS Secrets Manager 또는 환경 변수 사용

### 5. 성능 최적화
- **Connection Pooling**: Oracle 연결 재사용
- **Batch Download**: 여러 chart data 동시 다운로드
- **Compression**: Parquet 압축 설정
- **Lazy Loading**: Frontend에서 필요한 chart만 요청

---

## 📊 예상 성능

### 현재 (정적 파일)
- Frame data 로딩: ~10-50ms
- Chart data 로딩: ~5-20ms/file
- Total: ~100ms (캐싱 시)

### Production (Oracle + S3)
- Oracle 쿼리: ~100-500ms (DB 성능에 따라)
- S3 다운로드: ~50-200ms/file (첫 다운로드)
- S3 캐시: ~5-20ms/file (캐시 히트)
- Total: ~500-2000ms (첫 조회), ~100-300ms (캐시 히트)

---

## 🧪 테스트 체크리스트

### Oracle DB
- [ ] 연결 테스트
- [ ] 각 필터 조건별 쿼리 테스트
- [ ] 대량 데이터 쿼리 성능 테스트
- [ ] Connection pool 설정 및 테스트
- [ ] 에러 처리 테스트

### AWS S3
- [ ] S3 연결 및 권한 테스트
- [ ] 단일 파일 다운로드 테스트
- [ ] 배치 다운로드 테스트
- [ ] 캐싱 동작 테스트
- [ ] 파일 없음 처리 테스트

### 통합
- [ ] Oracle → Frontend 데이터 전달 테스트
- [ ] S3 → Frontend chart 렌더링 테스트
- [ ] 여러 사용자 동시 접속 테스트
- [ ] 캐시 무효화 및 갱신 테스트

---

## 📝 코드 변경 요약

### 신규 파일
1. `oracle_connector.py` - Oracle DB 쿼리 및 연결 관리
2. `s3_connector.py` - AWS S3 다운로드 및 캐싱
3. `temp_frames/` - 사용자별 임시 frame 저장 디렉토리
4. `s3_cache/` - S3 다운로드 캐시 디렉토리

### 수정 파일
1. `api.py` - Oracle/S3 로직 추가, flag 기반 분기
2. `data_loader.py` - S3 로딩 함수 추가
3. `.env` - Oracle/S3 설정 추가
4. `requirements.txt` - `cx_Oracle`, `boto3` 추가

### 변경 없음 (Frontend)
- `App.tsx` - 변경 없음
- `DashboardTable.tsx` - 변경 없음
- `data.ts` - 변경 없음

---

## 🎯 장점

1. **하위 호환성**: `USE_ORACLE=false`, `USE_S3=false`로 기존 방식 유지 가능
2. **점진적 마이그레이션**: Oracle만 먼저 적용 또는 S3만 먼저 적용 가능
3. **Frontend 무변경**: Backend만 수정하므로 Frontend 안정성 보장
4. **확장성**: 다른 DB (PostgreSQL, MySQL) 또는 스토리지 (Azure Blob) 추가 용이

---

## 📅 예상 작업 시간

- **Oracle 연동**: 2-3일 (연결, 쿼리 빌더, 테스트)
- **S3 연동**: 1-2일 (다운로드, 캐싱, 테스트)
- **통합 및 테스트**: 1-2일
- **Total**: 4-7일

---

## 🔗 참고 문서

- [cx_Oracle Documentation](https://cx-oracle.readthedocs.io/)
- [python-oracledb Documentation](https://python-oracledb.readthedocs.io/)
- [Boto3 S3 Documentation](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3.html)
- [Pandas read_sql Documentation](https://pandas.pydata.org/docs/reference/api/pandas.read_sql.html)

