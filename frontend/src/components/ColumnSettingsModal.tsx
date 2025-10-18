import React, { useState, useEffect } from 'react';
import { Column, VisibilityState, ColumnOrderState } from '@tanstack/react-table';

interface ColumnSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Column<any>[];
  columnVisibility: VisibilityState;
  columnOrder: ColumnOrderState;
  columnPinning: { left?: string[]; right?: string[] };
  onVisibilityChange: (visibility: VisibilityState) => void;
  onOrderChange: (order: ColumnOrderState) => void;
  onPinningChange: (pinning: { left?: string[]; right?: string[] }) => void;
}

export function ColumnSettingsModal({
  isOpen,
  onClose,
  columns,
  columnVisibility,
  columnOrder,
  columnPinning,
  onVisibilityChange,
  onOrderChange,
  onPinningChange
}: ColumnSettingsModalProps) {
  const [localVisibility, setLocalVisibility] = useState<VisibilityState>(columnVisibility);
  const [localOrder, setLocalOrder] = useState<ColumnOrderState>(columnOrder);
  const [localPinning, setLocalPinning] = useState<{ left?: string[]; right?: string[] }>(columnPinning);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setLocalVisibility(columnVisibility);
    setLocalOrder(columnOrder);
    setLocalPinning(columnPinning);
  }, [columnVisibility, columnOrder, columnPinning]);

  if (!isOpen) return null;

  const handleSave = () => {
    onVisibilityChange(localVisibility);
    onOrderChange(localOrder);
    onPinningChange(localPinning);
    onClose();
  };

  const handleReset = () => {
    const defaultVisibility: VisibilityState = {};
    const defaultOrder = columns.map(col => col.id);
    const defaultPinning: { left?: string[]; right?: string[] } = {};
    setLocalVisibility(defaultVisibility);
    setLocalOrder(defaultOrder);
    setLocalPinning(defaultPinning);
  };

  const toggleColumnPin = (columnId: string, side: 'left' | 'right' | 'none') => {
    const newPinning = { ...localPinning };
    
    // 기존 pin 제거
    if (newPinning.left?.includes(columnId)) {
      newPinning.left = newPinning.left.filter(id => id !== columnId);
      if (newPinning.left.length === 0) delete newPinning.left;
    }
    if (newPinning.right?.includes(columnId)) {
      newPinning.right = newPinning.right.filter(id => id !== columnId);
      if (newPinning.right.length === 0) delete newPinning.right;
    }
    
    // 새로운 pin 추가
    if (side === 'left') {
      newPinning.left = [...(newPinning.left || []), columnId];
    } else if (side === 'right') {
      newPinning.right = [...(newPinning.right || []), columnId];
    }
    
    setLocalPinning(newPinning);
    // 실시간으로 부모 컴포넌트에 반영
    onPinningChange(newPinning);
  };

  const getColumnPinStatus = (columnId: string): 'left' | 'right' | 'none' => {
    if (localPinning.left?.includes(columnId)) return 'left';
    if (localPinning.right?.includes(columnId)) return 'right';
    return 'none';
  };

  const toggleColumnVisibility = (columnId: string) => {
    const newVisibility = {
      ...localVisibility,
      [columnId]: !localVisibility[columnId]
    };
    setLocalVisibility(newVisibility);
    // 실시간으로 부모 컴포넌트에 반영
    onVisibilityChange(newVisibility);
  };

  // 부드러운 드래그 앤 드롭 핸들러들
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedItem(columnId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', columnId);
    
    // 드래그 오프셋 계산
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedItem && draggedItem !== columnId) {
      setDragOverItem(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // 자식 요소로 이동하는 경우는 무시
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverItem(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetColumnId) {
      setDraggedItem(null);
      setDragOverItem(null);
      setDragOffset(null);
      return;
    }

    const draggedIndex = localOrder.indexOf(draggedItem);
    const targetIndex = localOrder.indexOf(targetColumnId);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItem(null);
      setDragOverItem(null);
      setDragOffset(null);
      return;
    }

    const newOrder = [...localOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    
    setLocalOrder(newOrder);
    // 실시간으로 부모 컴포넌트에 반영
    onOrderChange(newOrder);
    
    setDraggedItem(null);
    setDragOverItem(null);
    setDragOffset(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    setDragOffset(null);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={handleBackdropClick}
    >
      <div 
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'auto',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            ⚙️ Column Settings
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            Column Visibility
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '8px'
          }}>
            {columns.map(column => {
              const isVisible = localVisibility[column.id] !== false;
              const pinStatus = getColumnPinStatus(column.id);
              return (
                <div key={column.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: isVisible ? 'var(--bg-secondary)' : 'transparent',
                  border: '1px solid var(--border-color)',
                  position: 'relative'
                }}>
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleColumnVisibility(column.id)}
                    style={{ margin: 0 }}
                  />
                  <span style={{
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    fontWeight: isVisible ? '500' : '400',
                    flex: 1
                  }}>
                    {column.columnDef.header as string}
                  </span>
                  
                  {/* Pin Controls */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => toggleColumnPin(column.id, pinStatus === 'left' ? 'none' : 'left')}
                      style={{
                        background: pinStatus === 'left' ? 'var(--primary)' : 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: pinStatus === 'left' ? 'white' : 'var(--text-primary)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}
                      title="Pin to left"
                    >
                      📌L
                    </button>
                    <button
                      onClick={() => toggleColumnPin(column.id, pinStatus === 'right' ? 'none' : 'right')}
                      style={{
                        background: pinStatus === 'right' ? 'var(--primary)' : 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        color: pinStatus === 'right' ? 'white' : 'var(--text-primary)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}
                      title="Pin to right"
                    >
                      📌R
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{
            margin: '0 0 12px 0',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}>
            Column Order
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '300px',
            overflow: 'auto',
            border: '2px solid var(--border-color)',
            borderRadius: '8px',
            padding: '12px',
            backgroundColor: 'var(--bg-primary)',
            position: 'relative'
          }}>
            {localOrder.map((columnId, index) => {
              const column = columns.find(col => col.id === columnId);
              if (!column) return null;
              
              const isDragging = draggedItem === columnId;
              const isDragOver = dragOverItem === columnId;
              const pinStatus = getColumnPinStatus(columnId);
              
              return (
                <div 
                  key={columnId} 
                  draggable
                  onDragStart={(e) => handleDragStart(e, columnId)}
                  onDragOver={(e) => handleDragOver(e, columnId)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, columnId)}
                  onDragEnd={handleDragEnd}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    backgroundColor: isDragging 
                      ? 'var(--primary)' 
                      : isDragOver 
                        ? 'var(--primary-light)' 
                        : pinStatus !== 'none'
                          ? 'var(--success-light)'
                          : 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: isDragOver 
                      ? '2px dashed var(--primary)' 
                      : pinStatus !== 'none'
                        ? '2px solid var(--success)'
                        : '1px solid var(--border-color)',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    opacity: isDragging ? 0.8 : 1,
                    transform: isDragging ? 'rotate(1deg) scale(1.02)' : 'none',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isDragging 
                      ? '0 8px 25px rgba(0, 0, 0, 0.15)' 
                      : isDragOver 
                        ? '0 4px 15px rgba(0, 0, 0, 0.1)'
                        : '0 2px 8px rgba(0, 0, 0, 0.05)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* 드래그 핸들 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      color: isDragging ? 'white' : 'var(--text-muted)',
                      userSelect: 'none',
                      cursor: 'grab'
                    }}>
                      <span style={{ fontSize: '12px', lineHeight: 1 }}>⋮</span>
                      <span style={{ fontSize: '12px', lineHeight: 1 }}>⋮</span>
                      <span style={{ fontSize: '12px', lineHeight: 1 }}>⋮</span>
                    </div>
                    
                    {/* 순서 번호 */}
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isDragging ? 'rgba(255,255,255,0.2)' : 'var(--primary)',
                      color: isDragging ? 'white' : 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {index + 1}
                    </div>
                    
                    {/* 컬럼 이름 */}
                    <span style={{
                      fontSize: '14px',
                      color: isDragging ? 'white' : 'var(--text-primary)',
                      fontWeight: '500',
                      flex: 1
                    }}>
                      {column.columnDef.header as string}
                    </span>
                  </div>
                  
                  {/* 우측 정보 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Pin 상태 표시 */}
                    {pinStatus !== 'none' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 8px',
                        backgroundColor: isDragging ? 'rgba(255,255,255,0.2)' : 'var(--success)',
                        color: isDragging ? 'white' : 'white',
                        borderRadius: '12px',
                        fontSize: '10px',
                        fontWeight: 'bold'
                      }}>
                        📌 {pinStatus === 'left' ? 'LEFT' : 'RIGHT'}
                      </div>
                    )}
                    
                    {/* 드래그 힌트 */}
                    <div style={{
                      fontSize: '11px',
                      color: isDragging ? 'rgba(255,255,255,0.8)' : 'var(--text-muted)',
                      fontStyle: 'italic',
                      opacity: isDragging ? 0.8 : 0.6
                    }}>
                      {isDragging ? 'Moving...' : 'Drag to reorder'}
                    </div>
                  </div>
                  
                  {/* 드래그 중 배경 효과 */}
                  {isDragging && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)',
                      animation: 'shimmer 1.5s infinite',
                      pointerEvents: 'none'
                    }} />
                  )}
                </div>
              );
            })}
          </div>
          
          {/* 드래그 앤 드롭 힌트 */}
          <div style={{
            marginTop: '8px',
            padding: '8px 12px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textAlign: 'center'
          }}>
            💡 Drag and drop items to reorder columns. Pinned columns are highlighted in green.
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '16px'
        }}>
          <button
            onClick={handleReset}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Reset
          </button>
          <button
            onClick={onClose}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: 'var(--primary)',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
