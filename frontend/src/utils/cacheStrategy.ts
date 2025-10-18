import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryData } from "../services/data";

interface CacheStrategyOptions {
  filters: any;
  pageSize: number;
  sessionUserId: string;
  user_id?: string;
  pattern: string;
}

// 캐싱 전략 설정
const CACHE_CONFIG = {
  // 전체 데이터 캐시 시간 (30분)
  allDataStaleTime: 30 * 60 * 1000,
  // 페이지별 데이터 캐시 시간 (5분)
  pageDataStaleTime: 5 * 60 * 1000,
  // 차트 데이터 캐시 시간 (1시간)
  chartDataStaleTime: 60 * 60 * 1000,
};

export function useOptimizedDataQuery(options: CacheStrategyOptions) {
  const queryClient = useQueryClient();
  const { filters, pageSize, sessionUserId, user_id, pattern } = options;

  // 전체 데이터 캐시 키
  const allDataKey = ["allRows", filters, pageSize, sessionUserId, user_id, pattern];
  
  // 전체 데이터 로드 (캐시 우선)
  const { data: allData, isLoading: isLoadingAll, isError: isErrorAll } = useQuery({
    queryKey: allDataKey,
    queryFn: async () => {
      // 전체 데이터를 한 번에 로드 (pageSize를 크게 설정)
      const result = await queryData({
        filters: { ...filters, line: filters.line.join(",") },
        page: 1,
        page_size: 10000, // 큰 값으로 설정하여 모든 데이터 로드
        user_id: user_id || sessionUserId || undefined,
        pattern,
      });
      
      
      return {
        ...result,
        allRows: result.rows,
        totalRows: result.total, // API 응답에서 'total' 필드 사용
        notes: result.notes || {}, // Notes 데이터 포함
      };
    },
    enabled: !!filters && !!sessionUserId,
    staleTime: CACHE_CONFIG.allDataStaleTime,
    refetchOnWindowFocus: false,
  });

  // 페이지별 데이터 추출 함수
  const getPageData = (page: number, actualPageSize?: number) => {
    if (!allData?.allRows) return null;
    
    // 실제 UI 페이지 크기 사용 (없으면 기본값 사용)
    const currentPageSize = actualPageSize || pageSize;
    const startIndex = (page - 1) * currentPageSize;
    const endIndex = startIndex + currentPageSize;
    const pageRows = allData.allRows.slice(startIndex, endIndex);
    
    return {
      rows: pageRows,
      page,
      page_size: currentPageSize,
      total_count: allData.totalRows,
      total_pages: Math.ceil(allData.totalRows / currentPageSize),
      notes: allData.notes || {}, // Notes 데이터 포함
    };
  };

  // 캐시 상태 확인
  const getCacheStatus = () => {
    const cacheData = queryClient.getQueryData(allDataKey);
    return {
      isCached: !!cacheData,
      cacheSize: cacheData ? JSON.stringify(cacheData).length : 0,
      totalPages: cacheData ? Math.ceil((cacheData as any).totalRows / pageSize) : 0,
    };
  };

  // 캐시 무효화
  const invalidateCache = () => {
    queryClient.invalidateQueries({ queryKey: allDataKey });
  };

  // 특정 페이지 데이터 가져오기 (캐시 우선)
  const getCachedPageData = (page: number, actualPageSize?: number) => {
    const pageData = getPageData(page, actualPageSize);
    if (pageData) {
      // 페이지별 캐시도 업데이트
      const currentPageSize = actualPageSize || pageSize;
      const pageKey = ["rows", filters, page, currentPageSize, sessionUserId, user_id, pattern];
      queryClient.setQueryData(pageKey, pageData);
    }
    return pageData;
  };

  return {
    allData,
    isLoadingAll,
    isErrorAll,
    getPageData,
    getCachedPageData,
    getCacheStatus,
    invalidateCache,
    cacheConfig: CACHE_CONFIG,
  };
}

// 차트 데이터 캐싱 최적화 (개별 차트)
export function useOptimizedChartQuery(taskId: string, days: number) {
  return useQuery({
    queryKey: ["chartData", taskId, days],
    queryFn: () => import("../services/data").then(module => module.loadChartDataSingle(taskId, days)),
    enabled: !!taskId,
    staleTime: CACHE_CONFIG.chartDataStaleTime,
    refetchOnWindowFocus: false,
    // 차트 데이터는 거의 변경되지 않으므로 더 긴 캐시 시간
    gcTime: 2 * 60 * 60 * 1000, // 2시간
  });
}


// 캐시 성능 모니터링
export function useCachePerformance() {
  const queryClient = useQueryClient();
  
  const getCacheStats = () => {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const stats = {
      totalQueries: queries.length,
      totalSize: 0,
      chartQueries: 0,
      tableQueries: 0,
      oldestQuery: null as Date | null,
      newestQuery: null as Date | null,
    };
    
    queries.forEach(query => {
      const key = query.queryKey.join(',');
      const data = query.state.data;
      
      if (data) {
        const size = JSON.stringify(data).length;
        stats.totalSize += size;
        
        if (key.includes('chartData')) {
          stats.chartQueries++;
        } else if (key.includes('rows') || key.includes('allRows')) {
          stats.tableQueries++;
        }
        
        const queryTime = query.state.dataUpdatedAt;
        if (!stats.oldestQuery || queryTime < stats.oldestQuery.getTime()) {
          stats.oldestQuery = new Date(queryTime);
        }
        if (!stats.newestQuery || queryTime > stats.newestQuery.getTime()) {
          stats.newestQuery = new Date(queryTime);
        }
      }
    });
    
    return stats;
  };
  
  return { getCacheStats };
}
