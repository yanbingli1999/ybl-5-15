import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, Bookmark, Trash2, Play, Edit3, X, Check, Plus, Thermometer } from 'lucide-react';
import useSimulationStore from '../store/useSimulationStore';
import useSimulation from '../hooks/useSimulation';
import api from '../services/api';
import ConfirmDialog from './ConfirmDialog';
import type { KeyTemperaturePoint } from '@shared/types';

export const Timeline: React.FC = () => {
  const {
    currentStep,
    totalSteps,
    temperatureHistory,
    snapshots,
    removeSnapshot,
    updateSnapshot,
    minTemp,
    maxTemp,
  } = useSimulationStore();

  const { goToStep, isRunning } = useSimulation();
  const [activeSnapshotId, setActiveSnapshotId] = useState<string | null>(null);
  const [editingSnapshot, setEditingSnapshot] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editKeyTemps, setEditKeyTemps] = useState<KeyTemperaturePoint[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; snapshotId: string; snapshotName: string }>({
    isOpen: false,
    snapshotId: '',
    snapshotName: '',
  });
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const delayedHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = setTimeout(() => {
      if (!editingSnapshot) {
        setActiveSnapshotId(null);
      }
    }, 150);
  }, [clearHideTimeout, editingSnapshot]);

  const handleMouseEnter = (snapshotId: string) => {
    clearHideTimeout();
    if (!editingSnapshot) {
      setActiveSnapshotId(snapshotId);
    }
  };

  const handleMouseLeave = () => {
    if (!editingSnapshot) {
      delayedHide();
    }
  };

  const handlePopoverMouseEnter = () => {
    clearHideTimeout();
  };

  const handlePopoverMouseLeave = () => {
    if (!editingSnapshot) {
      delayedHide();
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        if (editingSnapshot) {
          handleCancelEdit();
        }
        setActiveSnapshotId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearHideTimeout();
    };
  }, [editingSnapshot, clearHideTimeout]);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isRunning) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const targetStep = Math.floor(ratio * totalSteps);
    if (targetStep >= 0 && targetStep < temperatureHistory.length) {
      goToStep(targetStep);
    }
  };

  const handleSnapshotClick = (snapshot: typeof snapshots[0]) => {
    if (isRunning || editingSnapshot) return;
    if (snapshot.step < temperatureHistory.length) {
      goToStep(snapshot.step);
    }
  };

  const handleStartEdit = (snapshot: typeof snapshots[0], e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingSnapshot(snapshot.id);
    setActiveSnapshotId(snapshot.id);
    setEditName(snapshot.name || `第 ${snapshot.step} 步`);
    setEditNotes(snapshot.notes || '');
    setEditKeyTemps(snapshot.keyTemperatures ? [...snapshot.keyTemperatures] : []);
  };

  const handleCancelEdit = () => {
    setEditingSnapshot(null);
    setEditName('');
    setEditNotes('');
    setEditKeyTemps([]);
    setActiveSnapshotId(null);
  };

  const handleSaveEdit = async (snapshotId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updates = {
        name: editName.trim(),
        notes: editNotes.trim(),
        keyTemperatures: editKeyTemps,
      };
      await api.snapshots.update(snapshotId, updates);
      updateSnapshot(snapshotId, updates);
      setEditingSnapshot(null);
      setActiveSnapshotId(null);
    } catch (error) {
      console.error('更新快照失败:', error);
    }
  };

  const handleAddKeyTemp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditKeyTemps([...editKeyTemps, { label: '', value: 0 }]);
  };

  const handleRemoveKeyTemp = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditKeyTemps(editKeyTemps.filter((_, i) => i !== index));
  };

  const handleKeyTempChange = (index: number, field: 'label' | 'value', value: string | number) => {
    setEditKeyTemps(editKeyTemps.map((kt, i) =>
      i === index ? { ...kt, [field]: value } : kt
    ));
  };

  const handleDeleteClick = (snapshot: typeof snapshots[0], e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({
      isOpen: true,
      snapshotId: snapshot.id,
      snapshotName: snapshot.name || `第 ${snapshot.step} 步`,
    });
  };

  const handleConfirmDelete = async () => {
    try {
      await api.snapshots.delete(deleteConfirm.snapshotId);
      removeSnapshot(deleteConfirm.snapshotId);
      setDeleteConfirm({ isOpen: false, snapshotId: '', snapshotName: '' });
      setActiveSnapshotId(null);
    } catch (error) {
      console.error('删除快照失败:', error);
    }
  };

  const formatTime = (step: number) => {
    return `${(step * 0.1).toFixed(1)}s`;
  };

  const getSnapshotColor = (step: number) => {
    const temp = temperatureHistory[step]?.[Math.floor(useSimulationStore.getState().grid.height / 2)]?.[
      Math.floor(useSimulationStore.getState().grid.width / 2)
    ] ?? 25;
    const ratio = Math.max(0, Math.min(1, (temp - minTemp) / (maxTemp - minTemp)));

    if (ratio < 0.25) return 'bg-blue-600';
    if (ratio < 0.5) return 'bg-cyan-500';
    if (ratio < 0.75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const marks = Array.from({ length: 11 }, (_, i) => ({
    step: Math.floor((i / 10) * totalSteps),
    label: `${(i * 10)}%`,
  }));

  const renderSnapshotPopover = (snapshot: typeof snapshots[0]) => {
    const isEditing = editingSnapshot === snapshot.id;

    if (isEditing) {
      return (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-80 z-30 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handlePopoverMouseEnter}
          onMouseLeave={handlePopoverMouseLeave}
        >
          <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">编辑快照</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => handleSaveEdit(snapshot.id, e)}
                  className="p-1.5 rounded-lg text-green-400 hover:bg-green-500/20 transition-colors"
                  title="保存"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleCancelEdit(); }}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-600 transition-colors"
                  title="取消"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">名称</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="输入快照名称"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">观察结论</label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                placeholder="记录实验观察结论..."
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-400">关键温度点</label>
                <button
                  onClick={handleAddKeyTemp}
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  添加
                </button>
              </div>
              <div className="space-y-2">
                {editKeyTemps.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-3 bg-slate-900/50 rounded-lg border border-dashed border-slate-600">
                    暂无关键温度点
                  </div>
                ) : (
                  editKeyTemps.map((kt, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={kt.label}
                        onChange={(e) => handleKeyTempChange(index, 'label', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        placeholder="标签"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="relative">
                        <input
                          type="number"
                          value={kt.value}
                          onChange={(e) => handleKeyTempChange(index, 'value', parseFloat(e.target.value) || 0)}
                          className="w-20 px-2.5 py-1.5 pr-6 bg-slate-900 border border-slate-600 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          placeholder="温度"
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">°C</span>
                      </div>
                      <button
                        onClick={(e) => handleRemoveKeyTemp(index, e)}
                        className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        ref={popoverRef}
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-72 z-20 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={handlePopoverMouseEnter}
        onMouseLeave={handlePopoverMouseLeave}
      >
        <div className="px-4 py-3 bg-slate-700/50 border-b border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">{snapshot.name}</div>
              <div className="text-xs text-slate-400">
                第 {snapshot.step} 步 · {formatTime(snapshot.step)}
              </div>
            </div>
            <button
              onClick={(e) => handleStartEdit(snapshot, e)}
              className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-colors"
              title="编辑"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
          {snapshot.notes && (
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1">观察结论</div>
              <div className="text-sm text-slate-300 whitespace-pre-wrap">{snapshot.notes}</div>
            </div>
          )}

          {snapshot.keyTemperatures && snapshot.keyTemperatures.length > 0 && (
            <div>
              <div className="text-xs font-medium text-slate-400 mb-1.5">关键温度点</div>
              <div className="space-y-1.5">
                {snapshot.keyTemperatures.map((kt, index) => (
                  <div key={index} className="flex items-center justify-between px-2.5 py-1.5 bg-slate-900/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-xs text-slate-300">{kt.label}</span>
                    </div>
                    <span className="text-xs font-mono text-orange-400">{kt.value.toFixed(1)}°C</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!snapshot.notes && (!snapshot.keyTemperatures || snapshot.keyTemperatures.length === 0) && (
            <div className="text-xs text-slate-500 text-center py-2">
              点击编辑按钮添加备注
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-slate-700/30 border-t border-slate-600">
          <button
            onClick={(e) => handleDeleteClick(snapshot, e)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            删除快照
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="h-28 bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 px-6 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-300">
            <Clock className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">时间轴</span>
          </div>
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-slate-400">{snapshots.length} 个快照</span>
          </div>
        </div>

        <div
          className="relative h-8 bg-slate-800 rounded-lg cursor-pointer group"
          onClick={handleTimelineClick}
        >
          <div
            className="absolute h-full bg-gradient-to-r from-blue-600/30 to-green-600/30 rounded-lg transition-all"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />

          {marks.map((mark) => (
            <div
              key={mark.step}
              className="absolute top-0 h-full w-px bg-slate-600/50"
              style={{ left: `${(mark.step / totalSteps) * 100}%` }}
            >
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-slate-500">
                {mark.label}
              </span>
            </div>
          ))}

          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className={`absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-slate-900 cursor-pointer transition-all hover:scale-125 flex items-center justify-center ${
                activeSnapshotId === snapshot.id ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-10' : ''
              } ${getSnapshotColor(snapshot.step)}`}
              style={{ left: `calc(${(snapshot.step / totalSteps) * 100}% - 10px)` }}
              onClick={(e) => {
                e.stopPropagation();
                handleSnapshotClick(snapshot);
              }}
              onMouseEnter={() => handleMouseEnter(snapshot.id)}
              onMouseLeave={handleMouseLeave}
            >
              <Play className="w-2.5 h-2.5 text-white" fill="white" />

              {activeSnapshotId === snapshot.id && (
                renderSnapshotPopover(snapshot)
              )}
            </div>
          ))}

          <div
            className="absolute top-0 w-1 h-full bg-white rounded-full shadow-lg shadow-white/50 transition-all z-10"
            style={{ left: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-slate-500">
          <span>第 0 步</span>
          <span className="text-blue-400 font-medium">
            当前: 第 {currentStep} 步 ({formatTime(currentStep)})
          </span>
          <span>第 {totalSteps} 步</span>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="删除快照"
        message={`确定要删除快照"${deleteConfirm.snapshotName}"吗？此操作无法撤销，重要的实验节点将被永久删除。`}
        confirmText="删除"
        cancelText="取消"
        danger={true}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, snapshotId: '', snapshotName: '' })}
      />
    </>
  );
};

export default Timeline;
