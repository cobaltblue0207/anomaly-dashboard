"""
Example script for preparing V2 data structure.

This script demonstrates how to create:
1. Frame data (metadata only)
2. Chart data (time series for each master_task_id)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

# ============================================
# 1. Frame Data 준비 예시
# ============================================

def create_frame_data(num_tasks=100):
    """
    뼈대 데이터 생성 예시
    
    Args:
        num_tasks: 생성할 task 개수
    """
    print("Creating frame data...")
    
    # Sample data
    data = {
        'MASTER_TASK_ID': [f'TASK{str(i).zfill(5)}' for i in range(1, num_tasks + 1)],
        # Filter fields (검색 필터용)
        'LINE': [f'LINE{np.random.randint(1, 6)}' for _ in range(num_tasks)],
        'AREA': [f'AREA{np.random.choice(["A", "B", "C", "D"])}' for _ in range(num_tasks)],
        # Equipment & Parameter info
        'PROD_EQP_ID': [f'EQP{np.random.randint(100, 200)}' for _ in range(num_tasks)],
        'PARAM_SUBITEM': [
            np.random.choice([
                'APC_ANGLE_AV', 'CHAMBER_PRESS_ST', 'C_TICL4_MAX_MX',
                'TEMP_CONTROLLER_AV', 'FLOW_RATE_ST'
            ]) for _ in range(num_tasks)
        ],
        # Process info
        'PPID': [f'PPID_{str(i % 20).zfill(3)}' for i in range(num_tasks)],
        'RECIPEID': [f'RECIPE_{str(i % 10).zfill(3)}' for i in range(num_tasks)],
        'CH_STEP': [f'STEP_{str(i % 5).zfill(3)}' for i in range(num_tasks)],
        # Model result & Comments
        'MODEL_RESULT_INFO': [np.random.choice(['PASS', 'FAIL', 'WARNING']) for _ in range(num_tasks)],
        'COMMENTS': [f'Comment for task {i}' if np.random.random() > 0.5 else '' for i in range(num_tasks)],
        # Frontend에서 채울 필드들 (빈 값)
        '30D': [None] * num_tasks,
        '60D': [None] * num_tasks,
        'NOTES': [None] * num_tasks,
    }
    
    df_frame = pd.DataFrame(data)
    
    # Save to parquet
    output_file = 'frame_data.parquet'
    df_frame.to_parquet(output_file, index=False)
    print(f"✓ Frame data saved to: {output_file}")
    print(f"  - Shape: {df_frame.shape}")
    print(f"  - Columns: {list(df_frame.columns)}")
    print(f"\nSample row:")
    print(df_frame.iloc[0].to_dict())
    
    return df_frame


# ============================================
# 2. Chart Data 준비 예시
# ============================================

def create_chart_data_for_task(master_task_id, days=60):
    """
    단일 task의 차트 데이터 생성
    
    Args:
        master_task_id: Task ID
        days: 생성할 일수 (기본 60일)
    """
    # 60일간의 날짜 생성
    end_date = datetime.now()
    dates = [end_date - timedelta(days=i) for i in range(days-1, -1, -1)]
    
    # 랜덤 시계열 데이터 생성
    base_value = 100.0
    noise = np.random.normal(0, 5, days)
    trend = np.linspace(0, 2, days)  # 약간의 상승 트렌드
    
    values = base_value + trend + noise
    spec_lower = [95.0] * days
    spec_upper = [105.0] * days
    
    df = pd.DataFrame({
        'master_task_id': [master_task_id] * days,
        'act_date': dates,
        'value': values,
        'spec_lower': spec_lower,
        'spec_upper': spec_upper
    })
    
    return df


def create_chart_data_individual_files(master_task_ids, output_dir='chart_data'):
    """
    각 task별로 개별 parquet 파일 생성 (추천)
    
    Args:
        master_task_ids: Task ID 리스트
        output_dir: 출력 디렉토리
    """
    print(f"\nCreating individual chart data files in: {output_dir}/")
    os.makedirs(output_dir, exist_ok=True)
    
    for i, task_id in enumerate(master_task_ids):
        df_chart = create_chart_data_for_task(task_id, days=60)
        output_file = os.path.join(output_dir, f'{task_id}.parquet')
        df_chart.to_parquet(output_file, index=False)
        
        if (i + 1) % 10 == 0:
            print(f"  Progress: {i + 1}/{len(master_task_ids)} files created")
    
    print(f"✓ Created {len(master_task_ids)} chart data files")
    print(f"\nSample file: {output_dir}/{master_task_ids[0]}.parquet")
    
    # Show sample
    sample_df = pd.read_parquet(os.path.join(output_dir, f'{master_task_ids[0]}.parquet'))
    print(f"  - Shape: {sample_df.shape}")
    print(f"  - Columns: {list(sample_df.columns)}")
    print(f"  - Date range: {sample_df['act_date'].min()} to {sample_df['act_date'].max()}")


def create_chart_data_single_file(master_task_ids, output_file='chart_data_all.parquet'):
    """
    모든 task를 하나의 parquet 파일로 생성 (대안)
    
    Args:
        master_task_ids: Task ID 리스트
        output_file: 출력 파일명
    """
    print(f"\nCreating combined chart data file: {output_file}")
    
    all_dfs = []
    for i, task_id in enumerate(master_task_ids):
        df_chart = create_chart_data_for_task(task_id, days=60)
        all_dfs.append(df_chart)
        
        if (i + 1) % 10 == 0:
            print(f"  Progress: {i + 1}/{len(master_task_ids)} tasks processed")
    
    # Combine all
    df_combined = pd.concat(all_dfs, ignore_index=True)
    df_combined.to_parquet(output_file, index=False)
    
    print(f"✓ Combined chart data saved")
    print(f"  - Shape: {df_combined.shape}")
    print(f"  - Unique tasks: {df_combined['master_task_id'].nunique()}")
    print(f"  - Total rows: {len(df_combined)}")


# ============================================
# Main
# ============================================

if __name__ == "__main__":
    print("=" * 60)
    print("Data V2 Preparation Example")
    print("=" * 60)
    
    # 1. Frame 데이터 생성
    df_frame = create_frame_data(num_tasks=100)
    
    # 2. Chart 데이터 생성 (개별 파일 방식 - 추천)
    master_task_ids = df_frame['MASTER_TASK_ID'].tolist()
    create_chart_data_individual_files(master_task_ids[:10])  # 예시로 처음 10개만
    
    # 또는 단일 파일 방식
    # create_chart_data_single_file(master_task_ids[:10])
    
    print("\n" + "=" * 60)
    print("✓ Data preparation completed!")
    print("=" * 60)
    print("\nGenerated files:")
    print("  - frame_data.parquet         (뼈대 데이터)")
    print("  - chart_data/TASK*.parquet   (개별 차트 데이터)")
    print("\nNext steps:")
    print("  1. frame_data.parquet를 DATA_DIR로 이동")
    print("  2. chart_data/ 폴더를 CHART_DATA_DIR로 이동")
    print("  3. Backend 재시작")
    print("  4. Frontend에서 테스트")

