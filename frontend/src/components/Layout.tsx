import React, { useState } from 'react';
import { DashboardModule } from '../modules/DashboardModule';

export type ModuleType = 'dashboard' | 'analytics' | 'reports' | 'settings';

interface LayoutProps {}

export function Layout({}: LayoutProps) {
  const [activeModule, setActiveModule] = useState<ModuleType>('dashboard');

  const modules = [
    { id: 'dashboard' as ModuleType, name: '대시보드', icon: '📊' },
    { id: 'analytics' as ModuleType, name: '분석', icon: '📈' },
    { id: 'reports' as ModuleType, name: '리포트', icon: '📋' },
    { id: 'settings' as ModuleType, name: '설정', icon: '⚙️' },
  ];

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardModule />;
      case 'analytics':
        return (
          <div className="app-shell">
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: 'var(--text-secondary)',
              fontSize: '18px'
            }}>
              📈 분석 모듈 (준비 중)
            </div>
          </div>
        );
      case 'reports':
        return (
          <div className="app-shell">
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: 'var(--text-secondary)',
              fontSize: '18px'
            }}>
              📋 리포트 모듈 (준비 중)
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="app-shell">
            <div style={{ 
              padding: '40px', 
              textAlign: 'center', 
              color: 'var(--text-secondary)',
              fontSize: '18px'
            }}>
              ⚙️ 설정 모듈 (준비 중)
            </div>
          </div>
        );
      default:
        return <DashboardModule />;
    }
  };

  return (
    <div className="layout-container">
      {/* Header */}
      <header className="layout-header">
        <div className="header-content">
          <div className="header-left">
            <h1 className="header-title">TS Dashboard</h1>
          </div>
          <nav className="header-nav">
            {modules.map((module) => (
              <button
                key={module.id}
                className={`nav-button ${activeModule === module.id ? 'active' : ''}`}
                onClick={() => setActiveModule(module.id)}
                title={module.name}
              >
                <span className="nav-icon">{module.icon}</span>
                <span className="nav-label">{module.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Body */}
      <main className="layout-body">
        {renderModule()}
      </main>
    </div>
  );
}
