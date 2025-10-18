# timeseries_dataset_generator.py
# V2: Schema V2에 맞춰 chart_data 폴더에 master_task_id별 parquet 파일 생성

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
import numpy as np
import pandas as pd
import random
import os
from tqdm import tqdm

# -----------------------------
# 설정값 (V2)
# -----------------------------
LINE_LIST  = ["ALL", "11", "12", "13", "15", "16", "17", "P1", "P2", "P3", "P4"]
AREA_LIST  = ["CLN", "CMP", "CVD", "DIFF", "ETCH", "IMP", "METAL", "PHOTO"]
PROD_EQP_LIST = [f"EQP{i}" for i in range(100, 120)]
PARAM_SUBITEM_LIST = ["APC_ANGLE_AV", "CHAMBER_PRESS_ST", "C_TICL4_MAX_MX", 
                      "TEMP_CONTROLLER_AV", "FLOW_RATE_ST"]
PPID_LIST = [f"PPID_{str(i).zfill(3)}" for i in range(1, 21)]
RECIPEID_LIST = [f"RECIPE_{str(i).zfill(3)}" for i in range(1, 11)]
CH_STEP_LIST = [f"STEP_{str(i).zfill(3)}" for i in range(1, 6)]
MODEL_RESULT_LIST = ["TRUE", "FALSE"]

VALUE_MIN, VALUE_MAX = -100.0, 1000.0

# -----------------------------
# 데이터 생성 설정
# -----------------------------
@dataclass
class GeneratorConfig:
    start_date: datetime
    days: int = 60                    # 60일 데이터 (V2)
    freq: str = "1D"                  # 일별 데이터 (V2) - "30T"로 변경하면 30분마다
    points_per_day: Optional[int] = 834  # 하루당 타점 개수 (50,000 / 60 = 833.33, 834로 반올림)
    num_tasks: int = 100              # 생성할 task 개수
    random_seed: Optional[int] = 42

    def __post_init__(self):
        if self.random_seed is not None:
            random.seed(self.random_seed)
            np.random.seed(self.random_seed)

# -----------------------------
# 유틸 함수
# -----------------------------
def make_timeline(start: datetime, days: int, freq: str, points_per_day: Optional[int] = None) -> pd.DatetimeIndex:
    """
    타임라인 생성
    
    Args:
        start: 시작 날짜
        days: 총 일수
        freq: 주기 (예: "1D", "30T", "1H")
        points_per_day: 하루당 타점 개수 (지정 시 freq 무시)
    """
    if points_per_day:
        # 하루당 타점 개수로 계산
        total_points = days * points_per_day
        # 균등한 시간 간격으로 분할
        minutes_per_day = 24 * 60
        interval_minutes = minutes_per_day / points_per_day
        
        timeline = []
        current = start
        for _ in range(total_points):
            timeline.append(current)
            current += timedelta(minutes=interval_minutes)
        return pd.DatetimeIndex(timeline)
    else:
        # freq 사용
        end = start + timedelta(days=days)
        return pd.date_range(start=start, end=end, freq=freq, inclusive="left")

def clamp_scale(arr: np.ndarray, vmin: float, vmax: float) -> np.ndarray:
    """0..1 정규화 후 지정 범위로 스케일링 + 클램프."""
    a_min, a_max = float(np.min(arr)), float(np.max(arr))
    if abs(a_max - a_min) < 1e-12:
        return np.clip(np.full_like(arr, (vmin + vmax)/2.0, dtype=float), vmin, vmax)
    norm = (arr - a_min) / (a_max - a_min)
    return np.clip(vmin + norm * (vmax - vmin), vmin, vmax)

def spec_n_sequence(n_points: int) -> np.ndarray:
    """
    시간 가변 n(t) ∈ {1..5}. 구간 길이를 랜덤 분할.
    """
    n = np.empty(n_points, dtype=int)
    i = 0
    while i < n_points:
        seg_points = random.randint(5, 15)  # 5~15일 구간
        n_val = random.randint(1, 5)
        j = min(n_points, i + seg_points)
        n[i:j] = n_val
        i = j
    return n

# -----------------------------
# 시계열 합성기 (V2)
# -----------------------------
def synth_series(n: int, base_value: float = 100.0) -> np.ndarray:
    """
    60일 시계열 데이터 생성 (간단한 추세 + 노이즈)
    """
    t = np.arange(n, dtype=float)
    
    # 랜덤 패턴 선택
    pattern_type = random.choice(['trend_up', 'trend_down', 'stable', 'drift', 'wave'])
    
    if pattern_type == 'trend_up':
        base = base_value + 0.1 * t + np.random.normal(0, 2, n)
    elif pattern_type == 'trend_down':
        base = base_value - 0.1 * t + np.random.normal(0, 2, n)
    elif pattern_type == 'stable':
        base = base_value + np.random.normal(0, 1.5, n)
    elif pattern_type == 'drift':
        base = base_value + np.cumsum(np.random.normal(0, 0.3, n))
    elif pattern_type == 'wave':
        period = random.choice([10, 15, 20])  # 일 단위
        base = base_value + 5 * np.sin(2*np.pi*t/period) + np.random.normal(0, 1, n)
    else:
        base = base_value + np.random.normal(0, 2, n)
    
    return base

# -----------------------------
# 생성기 클래스 (V2)
# -----------------------------
class TimeSeriesDataGenerator:
    """
    V2 스키마에 맞춰 Frame 데이터와 Chart 데이터를 생성하는 클래스
    """
    def __init__(self, cfg: GeneratorConfig):
        self.cfg = cfg
        self.timeline = make_timeline(cfg.start_date, cfg.days, cfg.freq, cfg.points_per_day)
        self.frame_data = []
        self.task_counter = 0

    def _apply_spec(self, values: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """스펙 하한/상한 계산"""
        med = float(np.median(values))
        std = float(np.std(values, ddof=0))
        if std < 1e-8:
            std = max(1e-3, abs(med)*1e-3)
        
        n_seq = spec_n_sequence(len(values))
        lower = med - n_seq * std
        upper = med + n_seq * std
        return lower, upper

    def generate_chart_data(self, master_task_id: str) -> pd.DataFrame:
        """
        단일 master_task_id에 대한 차트 데이터 생성 (60일)
        
        Returns:
            DataFrame with columns: master_task_id, act_date, value, spec_lower, spec_upper
        """
        n = len(self.timeline)
        base_value = random.uniform(80, 2000)
        
        # 시계열 데이터 생성
        values = synth_series(n, base_value)
        values = clamp_scale(values, VALUE_MIN, VALUE_MAX)
        
        # 스펙 계산
        spec_lower, spec_upper = self._apply_spec(values)
        
        df = pd.DataFrame({
            "master_task_id": [master_task_id] * n,
            "act_date": self.timeline,
            "value": values.astype(float),
            "spec_lower": spec_lower.astype(float),
            "spec_upper": spec_upper.astype(float)
        })
        
        return df

    def generate_frame_row(self, task_id: int) -> dict:
        """
        단일 Frame 데이터 행 생성
        
        Returns:
            Dict with Frame columns
        """
        master_task_id = f"TASK{str(task_id).zfill(5)}"
        
        return {
            'MASTER_TASK_ID': master_task_id,
            'LINE': random.choice(LINE_LIST),
            'AREA': random.choice(AREA_LIST),
            'PROD_EQP_ID': random.choice(PROD_EQP_LIST),
            'PARAM_SUBITEM': random.choice(PARAM_SUBITEM_LIST),
            'PPID': random.choice(PPID_LIST),
            'RECIPEID': random.choice(RECIPEID_LIST),
            'CH_STEP': random.choice(CH_STEP_LIST),
            'MODEL_RESULT_INFO': random.choice(MODEL_RESULT_LIST),
            'COMMENTS': f'Auto-generated comment for {master_task_id}' if random.random() > 0.5 else '',
            '30D': None,  # Frontend에서 채움
            '60D': None,  # Frontend에서 채움
            'NOTES': None  # Frontend에서 채움
        }

    def generate_all(self, frame_output: str = "frame_data.parquet", 
                    chart_output_dir: str = "chart_data"):
        """
        전체 데이터 생성: Frame + Chart
        
        Args:
            frame_output: Frame 데이터 출력 파일명
            chart_output_dir: Chart 데이터 출력 디렉토리
        """
        print("=" * 60)
        print("V2 Dataset Generator")
        print("=" * 60)
        print(f"Configuration:")
        print(f"  - Number of tasks: {self.cfg.num_tasks}")
        print(f"  - Start Date: {self.cfg.start_date}")
        print(f"  - Days: {self.cfg.days}")
        print(f"  - Frequency: {self.cfg.freq}")
        print()
        
        # Chart 데이터 출력 디렉토리 생성
        os.makedirs(chart_output_dir, exist_ok=True)
        
        # Frame 데이터와 Chart 데이터 생성
        frame_rows = []
        
        print(f"Generating {self.cfg.num_tasks} tasks...")
        for task_id in tqdm(range(1, self.cfg.num_tasks + 1), desc="Generating data", unit="task"):
            master_task_id = f"TASK{str(task_id).zfill(5)}"
            
            # 1. Frame 데이터 생성
            frame_row = self.generate_frame_row(task_id)
            frame_rows.append(frame_row)
            
            # 2. Chart 데이터 생성 및 저장 (기존 파일이 없을 때만)
            chart_file = os.path.join(chart_output_dir, f"{master_task_id}.parquet")
            if not os.path.exists(chart_file):
                chart_df = self.generate_chart_data(master_task_id)
                chart_df.to_parquet(chart_file, index=False)
                print(f"Generated: {master_task_id}.parquet")
            else:
                print(f"Skipped (exists): {master_task_id}.parquet")
        
        # Frame 데이터를 DataFrame으로 변환 및 저장
        df_frame = pd.DataFrame(frame_rows)
        df_frame.to_parquet(frame_output, index=False)
        
        print()
        print("=" * 60)
        print("✅ Generation completed!")
        print("=" * 60)
        print(f"📊 Frame data: {frame_output}")
        print(f"   - Shape: {df_frame.shape}")
        print(f"   - Columns: {list(df_frame.columns)}")
        print()
        print(f"📈 Chart data: {chart_output_dir}/")
        print(f"   - Files: {self.cfg.num_tasks} parquet files")
        print(f"   - Each file: {len(self.timeline)} days of data")
        print()
        print("Sample Frame row:")
        print(df_frame.iloc[0].to_dict())
        print()
        print("Sample Chart file: " + os.path.join(chart_output_dir, "TASK00001.parquet"))
        
        return df_frame, self.cfg.num_tasks

# -----------------------------
# 스탠드얼론 실행 예시 (V2)
# -----------------------------
if __name__ == "__main__":
    # 설정: 1000개 task, 60일 데이터
    # Option 1: 일별 1개 타점 (기본)
    # cfg = GeneratorConfig(
    #     start_date=datetime(2024, 12, 10, 0, 0, 0),
    #     days=60,
    #     freq="1D",
    #     num_tasks=1000,
    #     random_seed=42
    # )
    
    # Option 2: 일별 833개 타점 (50,000 / 60 = 833)
    cfg = GeneratorConfig(
        start_date=datetime(2024, 12, 10, 0, 0, 0),
        days=60,
        freq="1D",  # points_per_day 사용 시 무시됨
        points_per_day=834,  # 하루당 타점 개수 (50,000 / 60 = 833.33, 834로 반올림)
        num_tasks=100,  # 테스트용 100개
        random_seed=42
    )
    
    print(f"📊 Points per day: {cfg.points_per_day}")
    print(f"📊 Total points per task: {60 * cfg.points_per_day}")
    
    gen = TimeSeriesDataGenerator(cfg)
    
    # 데이터 생성
    df_frame, num_charts = gen.generate_all(
        frame_output="frame_data.parquet",
        chart_output_dir="chart_data"
    )
    
    print("=" * 60)
    print("🎉 V2 Dataset Generation Complete!")
    print("=" * 60)
    print()
    print("Next steps:")
    print("  1. Move frame_data.parquet to your DATA_DIR")
    print("  2. Move chart_data/ folder to your CHART_DATA_DIR")
    print("  3. Update .env with correct paths")
    print("  4. Restart backend and test!")
