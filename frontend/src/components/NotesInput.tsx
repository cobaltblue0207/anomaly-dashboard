import React, { useState, useEffect, useRef, memo, useCallback } from 'react';

interface NotesInputProps {
  rowId: string;
  initialValue: string;
  onUpdate?: (rowId: string, value: string) => void;
  noteInfo?: {
    created_at?: string;
    updated_at?: string;
    created_by?: string;
    updated_by?: string;
  };
}

const NotesInput = memo(function NotesInput({ rowId, initialValue, onUpdate, noteInfo }: NotesInputProps) {
  const [value, setValue] = useState(initialValue);
  const [isComposing, setIsComposing] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<string>('');

  // 초기값 설정 (한 번만)
  useEffect(() => {
    if (initialValue !== value) {
      setValue(initialValue);
      lastUpdateRef.current = initialValue;
    }
  }, [initialValue]);


  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // 타이핑 중에는 저장하지 않음 (blur 이벤트에서만 저장)
    // 기존 타이머 클리어
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
  }, []);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
  }, []);

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    setIsComposing(false);
    const newValue = e.currentTarget.value;
    setValue(newValue);
    
    // 조합 완료 시에도 저장하지 않음 (blur 이벤트에서만 저장)
  }, []);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--border-color)';
    const newValue = e.target.value;
    
    // 포커스 해제 시에만 저장 (값이 변경되었을 때)
    if (onUpdate && newValue !== lastUpdateRef.current) {
      lastUpdateRef.current = newValue;
      onUpdate(rowId, newValue);
    }
  }, [rowId, onUpdate]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLTextAreaElement>) => {
    e.target.style.borderColor = 'var(--primary)';
  }, []);

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div style={{ width: '100%' }}>
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder="Add notes..."
        rows={3}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid var(--border-color)',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          outline: 'none',
          transition: 'border-color 0.2s ease',
          resize: 'vertical',
          minHeight: '80px',
          maxHeight: '200px',
          fontFamily: 'inherit',
          lineHeight: '1.4',
          overflow: 'auto'
        }}
      />
      {noteInfo && (noteInfo.created_at || noteInfo.updated_at) && (
        <div style={{
          fontSize: '10px',
          color: 'var(--text-secondary)',
          marginTop: '4px',
          lineHeight: '1.2',
          padding: '2px 4px',
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: '2px',
          border: '1px solid var(--border-color)'
        }}>
          {noteInfo.updated_at && (
            <div>📝 Updated: {new Date(noteInfo.updated_at).toLocaleString()}</div>
          )}
          {noteInfo.created_at && noteInfo.created_at !== noteInfo.updated_at && (
            <div>✨ Created: {new Date(noteInfo.created_at).toLocaleString()}</div>
          )}
          {noteInfo.updated_by && (
            <div>👤 By: {noteInfo.updated_by}</div>
          )}
        </div>
      )}
    </div>
  );
});

export default NotesInput;
