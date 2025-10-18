import React from 'react';

interface InlineChartProgressProps {
  progress: number;
  loadedCharts: number;
  totalCharts: number;
  isCompleted: boolean;
  isLoading: boolean;
}

export function InlineChartProgress({
  progress,
  loadedCharts,
  totalCharts,
  isCompleted,
  isLoading
}: InlineChartProgressProps) {
  if (!isLoading && !isCompleted && progress === 0) {
    return null;
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 16px',
      backgroundColor: 'var(--bg-card)',
      borderRadius: '8px',
      border: '1px solid var(--border-color)',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
      width: '100%',
      minWidth: '200px'
    }}>
      {/* Progress Icon */}
      <div style={{
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {isCompleted ? (
          <span style={{ fontSize: '16px', color: '#10B981' }}>✅</span>
        ) : (
          <div style={{
            width: '12px',
            height: '12px',
            border: '2px solid var(--primary)',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        )}
      </div>

      {/* Progress Text */}
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        minWidth: '120px'
      }}>
        {isCompleted ? 'Chart Loading Complete!' : 'Chart Loading...'}
      </div>


      {/* Progress Bar */}
      <div style={{
        flex: 1,
        height: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        borderRadius: '10px',
        overflow: 'hidden',
        position: 'relative',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '90%',
          background: isCompleted 
            ? 'linear-gradient(90deg, #10B981, #059669)'
            : 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
          borderRadius: '8px',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative'
        }}>
          {/* Shimmer effect */}
          {!isCompleted && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'shimmer 2s infinite'
            }} />
          )}
        </div>
        
        {/* Progress Text in center of progress bar */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: progress > 50 ? 'white' : 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: '700',
          textShadow: progress > 50 ? '0 1px 2px rgba(0,0,0,0.7)' : 'none',
          zIndex: 2,
          whiteSpace: 'nowrap'
        }}>
          {progress}% ({loadedCharts}/{totalCharts})
        </div>
      </div>


      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}