import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect, useCallback } from "react";
import { fetchOptions, queryData } from "../services/data";
import { DashboardTable } from "../components/DashboardTable";
import { UserIdModal } from "../components/UserIdModal";
import { themes, applyTheme, getInitialTheme } from "../utils/themes";
import { useOptimizedDataQuery, useCachePerformance } from "../utils/cacheStrategy";

export function DashboardModule() {
  // Session User ID management
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [showUserIdModal, setShowUserIdModal] = useState(false);

  useEffect(() => {
    const storedUserId = sessionStorage.getItem("dashboard_user_id");
    if (storedUserId) {
      setSessionUserId(storedUserId);
    } else {
      setShowUserIdModal(true);
    }
  }, []);

  const handleUserIdSubmit = (userId: string) => {
    sessionStorage.setItem("dashboard_user_id", userId);
    setSessionUserId(userId);
    setShowUserIdModal(false);
  };

  const { data: options } = useQuery({
    queryKey: ["options"],
    queryFn: fetchOptions,
  });
  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const plus30ISO = useMemo(
    () =>
      new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    []
  );
  
  // Set default form values based on available options
  const defaultLine = options?.lines?.[0] || "ALL";
  const defaultArea = options?.areas?.[0] || "ALL";
  
  const [form, setForm] = useState({
    line: [defaultLine],
    area: defaultArea,
    ai_result: "ALL",
    period_from: todayISO,
    period_to: plus30ISO,
    user_id: "", // 필터용 user_id (다른 사용자 조회용)
  });
  
  // Don't auto-submit on initial load - user must click Run button
  const [submitted, setSubmitted] = useState<typeof form | null>(null);
  
  // Update form defaults when options are loaded
  useEffect(() => {
    if (options) {
      setForm(prev => ({
        ...prev,
        line: [options.lines?.[0] || "ALL"],
        area: options.areas?.[0] || "ALL",
      }));
    }
  }, [options]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  // Chart progress state
  const [chartProgress, setChartProgress] = useState({
    isLoading: false,
    progress: 0,
    loadedCharts: 0,
    totalCharts: 0,
    isCompleted: false,
    hasCachedCharts: false
  });
  

  // onProgressChange 핸들러
  const handleProgressChange = useCallback((progress: {
    isLoading: boolean;
    progress: number;
    loadedCharts: number;
    totalCharts: number;
    isCompleted: boolean;
    hasCachedCharts: boolean;
  }) => {
    setChartProgress(prev => ({
      ...prev,
      progress: progress.progress,
      loadedCharts: progress.loadedCharts,
      totalCharts: progress.totalCharts,
      isCompleted: progress.isCompleted,
      hasCachedCharts: progress.hasCachedCharts
    }));
  }, []);

  const canQuery = !!options && !!submitted && !!sessionUserId;
  
  // V2 Schema: Use "ALL" as default pattern for notes loading
  const currentPattern = "ALL";
  
  // 최적화된 캐싱 사용
  const { 
    allData, 
    isLoadingAll, 
    isErrorAll, 
    getCachedPageData, 
    getCacheStatus 
  } = useOptimizedDataQuery({
    filters: submitted || form,
    pageSize,
    sessionUserId: sessionUserId || "",
    user_id: sessionUserId || "", // sessionUserId를 user_id로 사용
    pattern: currentPattern,
  });

  // 현재 페이지 데이터 (캐시 우선)
  const data = useMemo(() => {
    if (!submitted) return null;
    const pageData = getCachedPageData(page, pageSize);
    if (!pageData) return null;
    
    
    // metrics와 notes 속성 추가 (기존 API 응답 구조 유지)
    const startRow = (page - 1) * pageSize + 1;
    const endRow = Math.min(page * pageSize, pageData.total_count);
    
    return {
      ...pageData,
      metrics: {
        rows_total: pageData.total_count,
        rows_page: endRow, // 현재 페이지의 마지막 행 번호
        rows_start: startRow, // 현재 페이지의 시작 행 번호
        total_ms: 0, // 캐시된 데이터이므로 0
      },
      notes: pageData.notes || {}, // 캐시된 notes 데이터 사용
    };
  }, [submitted, page, pageSize, getCachedPageData]);


  // 데이터가 로드되면 즉시 차트 로딩 시작
  useEffect(() => {
    if (data?.rows && data.rows.length > 0) {
      setChartProgress(prev => {
        // 이미 로딩 중이면 상태 변경하지 않음
        if (prev.isLoading) {
          return prev;
        }
        // V2 스키마 (메인 스키마)
        const expectedCharts = data.rows.length * 2; // 30D + 60D 차트
        
        return {
          ...prev,
          isLoading: true,
          totalCharts: expectedCharts
        };
      });
    }
  }, [data?.rows]);

  const isFetching = isLoadingAll;
  const isError = isErrorAll;

  const updateLines = (values: string[]) => {
    setForm((f) => ({ ...f, line: values }));
  };

  // 캐시 성능 모니터링
  const { getCacheStats } = useCachePerformance();
  const cacheStatus = getCacheStatus();

  // Scroll to top handler
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Theme management
  const [currentTheme, setCurrentTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  return (
    <>
      {showUserIdModal && <UserIdModal onSubmit={handleUserIdSubmit} />}
      
      
      
      
      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: "fixed",
            right: "24px",
            bottom: "24px",
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            border: "none",
            backgroundColor: "var(--accent)",
            color: "white",
            fontSize: "24px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-4px)";
            e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.25)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
          }}
          title="맨 위로"
        >
          ↑
        </button>
      )}
      
      <div className="app-shell">
      <div className="app-header">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h1>Anomaly Review Dashboard</h1>
          {sessionUserId && (
            <span style={{ fontSize: 18, color: "var(--text-secondary)", fontWeight: 400 }}>
              {sessionUserId}님 환영합니다.
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
            Total: {data?.metrics?.rows_total ?? 0} | Latency: {Math.round(data?.metrics?.total_ms ?? 0)} ms
          </div>
          <button
            className="primary-btn"
            onClick={() => {
              setShowUserIdModal(true);
            }}
            style={{ 
              padding: "10px 18px",
              fontSize: 14,
              background: "linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)",
              color: "white",
              fontWeight: 600
            }}
          >
            사용자 변경
          </button>
          <select
            value={currentTheme}
            onChange={(e) => {
              const newTheme = e.target.value;
              setCurrentTheme(newTheme);
              applyTheme(newTheme);
            }}
            style={{
              padding: "10px 14px",
              fontSize: 14,
              fontWeight: 600,
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              cursor: "pointer",
              boxShadow: "var(--shadow-sm)",
              transition: "all 0.2s ease"
            }}
          >
            <optgroup label="계절 테마">
              <option value="봄">🌸 봄</option>
              <option value="여름">🌊 여름</option>
              <option value="가을">🍂 가을</option>
              <option value="겨울">❄️ 겨울</option>
            </optgroup>
            <optgroup label="개발자 테마">
              <option value="Nord">🎨 Nord</option>
              <option value="Dracula">🧛 Dracula</option>
              <option value="Monokai">🖤 Monokai</option>
              <option value="Solarized">☀️ Solarized</option>
              <option value="GitHub">🐙 GitHub</option>
              <option value="Ocean">🌊 Ocean</option>
            </optgroup>
            <optgroup label="기본 테마">
              <option value="블랙">🌙 다크</option>
            </optgroup>
          </select>
        </div>
      </div>

      <div className="card filters-card">
        <label>
          User ID
          <input
            type="text"
            defaultValue={form.user_id}
            onChange={(e) => {
              // Store value but don't trigger re-render
              form.user_id = e.target.value;
            }}
            onBlur={(e) => {
              // Update state only on blur to minimize re-renders
              setForm((f) => ({ ...f, user_id: e.target.value }));
            }}
            placeholder={`Current: ${sessionUserId || "None"}`}
            title="Leave empty to view your own notes, or enter another user's ID"
          />
          <small style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4 }}>
            Empty = your notes, Enter user ID to view others' notes
          </small>
        </label>
        <label>
          Line
          <select
            multiple
            value={form.line}
            onChange={(e) =>
              updateLines(Array.from(e.target.selectedOptions, (o) => o.value))
            }
            style={{ minHeight: 120 }}
          >
            {(options?.lines ?? ["ALL"]).map((v: string) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          Area
          <select value={form.area} onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}>
            {(options?.areas ?? ["ALL"]).map((v: string) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          AI Result
          <select value={form.ai_result} onChange={(e) => setForm((f) => ({ ...f, ai_result: e.target.value }))}>
            <option value="ALL">ALL</option>
            <option value="TRUE">TRUE</option>
            <option value="FALSE">FALSE</option>
          </select>
        </label>
        <label>
          From
          <input
            type="date"
            value={form.period_from}
            onChange={(e) => setForm((f) => ({ ...f, period_from: e.target.value }))}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={form.period_to}
            onChange={(e) => setForm((f) => ({ ...f, period_to: e.target.value }))}
          />
        </label>
        <label>
          Page Size
          <select 
            value={pageSize} 
            onChange={(e) => {
              setPageSize(parseInt(e.target.value));
              setPage(1); // 페이지 크기 변경 시 첫 페이지로 이동
            }}
          >
            {[10, 20, 30, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="run-btn-wrapper">
          <button 
            className="run-btn" 
            onClick={() => { setSubmitted(form); setPage(1); }}
          >
            Run
          </button>
        </div>
      </div>

      <div style={{ margin: "14px 0", display: "flex", alignItems: "center", gap: "16px" }}>
        {/* Left side - Control buttons */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
          <button
            className="control-btn"
            onClick={() => {
              // Trigger column settings modal in DashboardTable
              const event = new CustomEvent('openColumnSettings');
              window.dispatchEvent(event);
            }}
          >
            ⚙️ Column Settings
          </button>
          <button
            className="control-btn"
            onClick={() => {
              // Trigger export in DashboardTable
              console.log('Export to Excel button clicked');
              const event = new CustomEvent('exportToExcel');
              window.dispatchEvent(event);
            }}
            disabled={!data || data.rows.length === 0}
            style={{ 
              opacity: !data || data.rows.length === 0 ? 0.6 : 1,
              cursor: !data || data.rows.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            📊 Export to Excel
          </button>
          <div style={{ color: "var(--text-secondary)", fontSize: 14, whiteSpace: "nowrap" }}>
            Showing {data?.metrics?.rows_start ?? 0}-{data?.metrics?.rows_page ?? 0} of {data?.metrics?.rows_total ?? 0}
          </div>
        </div>

        {/* Center - Empty space (progress bar removed) */}
        <div style={{ flex: 1, minWidth: 0 }}></div>

        {/* Right side - Pagination buttons */}
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            className="primary-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{ 
              background: "rgba(37,99,235,0.12)", 
              color: "var(--accent)",
              opacity: page <= 1 ? 0.6 : 1,
              cursor: page <= 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Prev
          </button>
          <div style={{ color: "var(--text-secondary)", alignSelf: "center", fontSize: 14, fontWeight: 500 }}>
            Page {data?.page ?? page} / {data?.total_pages ?? 1}
          </div>
          <button
            className="primary-btn"
            disabled={(data?.page ?? 1) >= (data?.total_pages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
            style={{ 
              background: "rgba(37,99,235,0.12)", 
              color: "var(--accent)",
              opacity: (data?.page ?? 1) >= (data?.total_pages ?? 1) ? 0.6 : 1,
              cursor: (data?.page ?? 1) >= (data?.total_pages ?? 1) ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Loading Spinner */}
      {isFetching && (
        <>
          {/* Overlay */}
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.3)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            {/* Spinner */}
            <div style={{
              width: "60px",
              height: "60px",
              border: "6px solid rgba(255, 255, 255, 0.3)",
              borderTop: "6px solid white",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite"
            }} />
          </div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </>
      )}

      {/* Show message when no query submitted yet */}
      {!submitted && !isFetching && (
        <div style={{ 
          padding: "40px 24px", 
          textAlign: "center",
          color: "var(--text-secondary)",
          fontSize: 14
        }}>
          검색 조건을 선택하고 Run 버튼을 클릭하세요
        </div>
      )}
      
      {/* Show error or no results when query failed or returned empty */}
      {submitted && !isFetching && ((data?.rows?.length ?? 0) === 0 || isError) && (
        <div style={{ 
          padding: "60px 24px", 
          textAlign: "center",
        }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
          <div style={{ 
            fontSize: 16, 
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: 8
          }}>
            조회 결과 없음
          </div>
          <div style={{ 
            fontSize: 14,
            color: "var(--text-secondary)"
          }}>
            LINE: {submitted.line.join(", ")}, AREA: {submitted.area}
          </div>
        </div>
      )}

      {/* Show table when data exists */}
      {(data?.rows?.length ?? 0) > 0 && (
        <div className="table-card">
          <DashboardTable 
            rows={data?.rows ?? []} 
            sessionUserId={sessionUserId || ""}
            filterUserId={sessionUserId || ""}
            notesData={data?.notes}
            onProgressChange={handleProgressChange}
          />
        </div>
      )}

    </div>
    </>
  );
}
