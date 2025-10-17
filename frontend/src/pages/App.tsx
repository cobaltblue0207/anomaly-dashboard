import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { fetchOptions, queryData } from "../services/data";
import { DashboardTable } from "../components/DashboardTable";
import { UserIdModal } from "../components/UserIdModal";

export function App() {
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
  const [pageSize, setPageSize] = useState(30);

  const canQuery = !!options && !!submitted && !!sessionUserId;
  
  // V2 Schema: Use "ALL" as default pattern for notes loading
  const currentPattern = "ALL";
  
  const { data, isFetching, isError } = useQuery({
    queryKey: ["rows", submitted, page, pageSize, sessionUserId, submitted?.user_id],
    queryFn: () =>
      queryData({
        filters: { ...submitted!, line: submitted!.line.join(",") },
        page,
        page_size: pageSize,
        user_id: submitted?.user_id || sessionUserId || undefined,
        pattern: currentPattern,
      }),
    enabled: canQuery,
    refetchOnWindowFocus: false,
  });

  const updateLines = (values: string[]) => {
    setForm((f) => ({ ...f, line: values }));
  };

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
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('dashboard_theme') || '봄';
  });

  const themes = {
    '봄': {
      primary: '#ec4899',      // Pink
      secondary: '#f472b6',
      accent: '#fbbf24',       // Yellow
      bgMain: '#fdf2f8',
      bgCard: '#ffffff',
      textPrimary: '#831843',
    },
    '여름': {
      primary: '#06b6d4',      // Cyan
      secondary: '#0ea5e9',
      accent: '#fbbf24',
      bgMain: '#ecfeff',
      bgCard: '#ffffff',
      textPrimary: '#164e63',
    },
    '가을': {
      primary: '#f97316',      // Orange
      secondary: '#fb923c',
      accent: '#facc15',
      bgMain: '#fff7ed',
      bgCard: '#ffffff',
      textPrimary: '#7c2d12',
    },
    '겨울': {
      primary: '#3b82f6',      // Blue (default)
      secondary: '#8b5cf6',
      accent: '#f59e0b',
      bgMain: '#f8fafc',
      bgCard: '#ffffff',
      textPrimary: '#0f172a',
    },
    '블랙': {
      primary: '#a78bfa',
      secondary: '#c084fc',
      accent: '#fbbf24',
      bgMain: '#0f172a',
      bgCard: '#1e293b',
      textPrimary: '#f1f5f9',
    },
    'Nord': {
      primary: '#88c0d0',      // Nord Frost
      secondary: '#81a1c1',
      accent: '#ebcb8b',       // Nord Yellow
      bgMain: '#2e3440',       // Nord Polar Night
      bgCard: '#3b4252',
      textPrimary: '#eceff4',  // Nord Snow Storm
    },
    'Dracula': {
      primary: '#bd93f9',      // Purple
      secondary: '#ff79c6',    // Pink
      accent: '#f1fa8c',       // Yellow
      bgMain: '#282a36',
      bgCard: '#44475a',
      textPrimary: '#f8f8f2',
    },
    'Monokai': {
      primary: '#66d9ef',      // Cyan
      secondary: '#a6e22e',    // Green
      accent: '#fd971f',       // Orange
      bgMain: '#272822',
      bgCard: '#3e3d32',
      textPrimary: '#f8f8f2',
    },
    'Solarized': {
      primary: '#268bd2',      // Blue
      secondary: '#2aa198',    // Cyan
      accent: '#b58900',       // Yellow
      bgMain: '#fdf6e3',       // Light background
      bgCard: '#eee8d5',
      textPrimary: '#073642',
    },
    'GitHub': {
      primary: '#0969da',      // GitHub Blue
      secondary: '#8250df',    // Purple
      accent: '#bf8700',       // Yellow
      bgMain: '#ffffff',
      bgCard: '#f6f8fa',
      textPrimary: '#1f2328',
    },
    'Ocean': {
      primary: '#1e40af',      // Deep Blue
      secondary: '#0891b2',    // Teal
      accent: '#06b6d4',       // Cyan
      bgMain: '#f0f9ff',
      bgCard: '#ffffff',
      textPrimary: '#0c4a6e',
    },
  };

  const applyTheme = (themeName: string) => {
    const theme = themes[themeName as keyof typeof themes];
    if (theme) {
      document.documentElement.style.setProperty('--primary', theme.primary);
      document.documentElement.style.setProperty('--secondary', theme.secondary);
      document.documentElement.style.setProperty('--accent', theme.accent);
      document.documentElement.style.setProperty('--bg-main', theme.bgMain);
      document.documentElement.style.setProperty('--bg-card', theme.bgCard);
      document.documentElement.style.setProperty('--text-primary', theme.textPrimary);
      
      // 다크 테마들 추가 스타일 조정
      const darkThemes = ['블랙', 'Nord', 'Dracula', 'Monokai'];
      if (darkThemes.includes(themeName)) {
        document.documentElement.style.setProperty('--bg-input', '#334155');
        document.documentElement.style.setProperty('--bg-secondary', '#334155');
        document.documentElement.style.setProperty('--bg-hover', '#475569');
        document.documentElement.style.setProperty('--border-color', '#475569');
        document.documentElement.style.setProperty('--text-secondary', '#cbd5e1');
        document.documentElement.style.setProperty('--text-muted', '#94a3b8');
        document.documentElement.style.setProperty('--success-color', '#10b981');
        document.documentElement.style.setProperty('--error-color', '#ef4444');
        // 테이블 셀 배경을 다크 테마로
        document.body.style.setProperty('--cell-bg', theme.bgCard);
      } else {
        document.documentElement.style.setProperty('--bg-input', '#f1f5f9');
        document.documentElement.style.setProperty('--bg-secondary', '#f1f5f9');
        document.documentElement.style.setProperty('--bg-hover', '#f0f9ff');
        document.documentElement.style.setProperty('--border-color', '#e2e8f0');
        document.documentElement.style.setProperty('--text-secondary', '#64748b');
        document.documentElement.style.setProperty('--text-muted', '#94a3b8');
        document.documentElement.style.setProperty('--success-color', '#10b981');
        document.documentElement.style.setProperty('--error-color', '#ef4444');
        document.body.style.setProperty('--cell-bg', '#ffffff');
      }
      
      setCurrentTheme(themeName);
      localStorage.setItem('dashboard_theme', themeName);
    }
  };

  useEffect(() => {
    applyTheme(currentTheme);
  }, []);

  return (
    <>
      {showUserIdModal && <UserIdModal onSubmit={handleUserIdSubmit} />}
      
      {/* Chart Activation Guide */}
      <div style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        background: "var(--bg-card)",
        color: "var(--text-secondary)",
        padding: "8px 16px",
        borderRadius: "6px",
        fontSize: 12,
        border: "1px solid var(--border-color)",
        zIndex: 1000,
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
      }}>
        💡 Click on any chart to activate zoom/pan controls
      </div>
      
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
            onChange={(e) => applyTheme(e.target.value)}
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
          <select value={pageSize} onChange={(e) => setPageSize(parseInt(e.target.value))}>
            {[30, 40, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="run-btn-wrapper">
          <button className="run-btn" onClick={() => { setSubmitted(form); setPage(1); }}>
            Run
          </button>
        </div>
      </div>

      <div style={{ margin: "14px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
          <div style={{ color: "var(--text-secondary)", fontSize: 14, marginLeft: 8 }}>
            Showing {data?.metrics?.rows_page ?? 0} of {data?.metrics?.rows_total ?? 0}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            className="primary-btn"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            style={{ background: "rgba(37,99,235,0.12)", color: "var(--accent)" }}
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
            style={{ background: "rgba(37,99,235,0.12)", color: "var(--accent)" }}
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
            filterUserId={submitted?.user_id || ""}
            notesData={data?.notes}
          />
        </div>
      )}
    </div>
    </>
  );
}
