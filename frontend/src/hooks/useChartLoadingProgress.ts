import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface ChartLoadingState {
  [chartId: string]: boolean;
}

export function useChartLoadingProgress(totalCharts: number) {
  const [loadingStates, setLoadingStates] = useState<ChartLoadingState>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [previousTotalCharts, setPreviousTotalCharts] = useState(totalCharts);
  const [hasCachedCharts, setHasCachedCharts] = useState(false);
  const queryClient = useQueryClient();

  // totalCharts가 변경되면 progress 리셋 (새로운 페이지/페이지 크기)
  useEffect(() => {
    if (totalCharts !== previousTotalCharts) {
      // 완전히 새로운 데이터셋이므로 모든 상태 리셋
      setLoadingStates({});
      // isLoading은 App.tsx에서 관리하므로 여기서 리셋하지 않음
      setIsCompleted(false);
      setPreviousTotalCharts(totalCharts);
    }
  }, [totalCharts, previousTotalCharts]);

  // 차트 캐시 상태 확인
  const isChartCached = useCallback((chartId: string) => {
    const [taskId, daysStr] = chartId.split('-');
    const days = parseInt(daysStr.replace('d', ''));
    const chartKey = ["chartData", taskId, days];
    const cacheData = queryClient.getQueryData(chartKey);
    return !!(cacheData && typeof cacheData === 'object' && 'data' in cacheData);
  }, [queryClient]);

  // 차트 로딩 시작
  const startChartLoading = useCallback((chartId: string) => {
    setLoadingStates(prev => {
      // 이미 등록된 차트인지 확인
      if (prev.hasOwnProperty(chartId)) {
        setHasCachedCharts(true); // 캐시된 차트가 있음을 표시
        return prev; // 이미 등록된 차트는 무시
      }
      
      // 캐시된 데이터인지 확인
      if (isChartCached(chartId)) {
        setHasCachedCharts(true); // 캐시된 차트가 있음을 표시
        const newState = {
          ...prev,
          [chartId]: false // 캐시된 데이터는 즉시 완료로 처리
        };
        
        // 캐시된 차트가 즉시 완료되므로 완료 상태 확인
        const loadedCount = Object.values(newState).filter(loaded => !loaded).length;
        const registeredCount = Object.keys(newState).length;
        
        // 모든 차트가 캐시되어 즉시 완료된 경우
        if (registeredCount >= totalCharts && loadedCount === registeredCount) {
          setIsCompleted(true);
        }
        
        return newState;
      }
      
      return {
        ...prev,
        [chartId]: true
      };
    });
    
    // isLoading은 App.tsx에서 관리하므로 여기서 설정하지 않음
  }, [isChartCached, totalCharts]);

  // 차트 로딩 완료
  const finishChartLoading = useCallback((chartId: string) => {
    setLoadingStates(prev => {
      // 이미 완료된 차트인지 확인
      if (prev[chartId] === false) {
        return prev; // 이미 완료된 차트는 무시
      }
      
      const newState = {
        ...prev,
        [chartId]: false
      };
      
      const loadedCount = Object.values(newState).filter(loaded => !loaded).length;
      const registeredCount = Object.keys(newState).length;
      
      
      // 모든 차트가 로딩 완료되었는지 확인
      // 등록된 차트가 있고, 모든 등록된 차트가 완료되었으며, 
      // 등록된 차트 수가 예상 총 차트 수와 같거나 더 많을 때
      const allLoaded = registeredCount > 0 && 
                       loadedCount === registeredCount && 
                       registeredCount >= totalCharts;
             if (allLoaded && totalCharts > 0) {
               setIsCompleted(true);
               
               // App.tsx에서 isLoading을 관리하므로 여기서는 완료 상태만 설정
               // 2초 후 자동으로 모달 닫기는 App.tsx에서 처리
             }
      
      return newState;
    });
  }, [totalCharts]);

  // 진행률 계산 (0-100)
  const progress = totalCharts > 0 
    ? Math.round((Object.values(loadingStates).filter(loading => !loading).length / totalCharts) * 100)
    : 0;

  // 로딩된 차트 수
  const loadedCharts = Object.values(loadingStates).filter(loading => !loading).length;


  // 초기화 (새 페이지 로드 시)
  const resetProgress = useCallback(() => {
    setLoadingStates({});
    setIsLoading(false);
    setIsCompleted(false);
    setHasCachedCharts(false);
  }, []);

  return {
    progress,
    isLoading,
    isCompleted,
    loadedCharts,
    totalCharts,
    hasCachedCharts,
    startChartLoading,
    finishChartLoading,
    resetProgress
  };
}
