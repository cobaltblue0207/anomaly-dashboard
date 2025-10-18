export const themes = {
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

export function applyTheme(themeName: string) {
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
    
    localStorage.setItem('dashboard_theme', themeName);
  }
}

export function getInitialTheme(): string {
  return localStorage.getItem('dashboard_theme') || '봄';
}
