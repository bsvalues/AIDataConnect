import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, reducer } from './use-toast';

describe('useToast Hook', () => {
  beforeEach(() => {
    // Reset mocks between tests
    vi.clearAllMocks();
  });

  it('should add a toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({
        title: 'Test Toast',
        description: 'This is a test toast',
      });
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Test Toast');
    expect(result.current.toasts[0].description).toBe('This is a test toast');
  });

  it('should add a toast with custom props', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({
        title: 'Custom Toast',
        description: 'This is a custom toast',
        variant: 'destructive',
        duration: 5000,
      });
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].title).toBe('Custom Toast');
    expect(result.current.toasts[0].variant).toBe('destructive');
    expect(result.current.toasts[0].duration).toBe(5000);
  });

  it('should update a toast', () => {
    const { result } = renderHook(() => useToast());
    
    let toastId: string;
    
    act(() => {
      toastId = result.current.toast({
        title: 'Initial Toast',
        description: 'This is an initial toast',
      }).id;
    });
    
    act(() => {
      result.current.update({
        id: toastId,
        title: 'Updated Toast',
        description: 'This toast has been updated',
      });
    });
    
    expect(result.current.toasts.length).toBe(1);
    expect(result.current.toasts[0].id).toBe(toastId);
    expect(result.current.toasts[0].title).toBe('Updated Toast');
    expect(result.current.toasts[0].description).toBe('This toast has been updated');
  });

  it('should dismiss a toast by id', () => {
    const { result } = renderHook(() => useToast());
    
    let toastId: string;
    
    act(() => {
      toastId = result.current.toast({
        title: 'Toast to dismiss',
      }).id;
    });
    
    expect(result.current.toasts.length).toBe(1);
    
    act(() => {
      result.current.dismiss(toastId);
    });
    
    expect(result.current.toasts.length).toBe(0);
  });

  it('should dismiss all toasts when no id is provided', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({ title: 'First toast' });
      result.current.toast({ title: 'Second toast' });
      result.current.toast({ title: 'Third toast' });
    });
    
    expect(result.current.toasts.length).toBe(3);
    
    act(() => {
      result.current.dismiss();
    });
    
    expect(result.current.toasts.length).toBe(0);
  });

  it('should generate unique IDs for each toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.toast({ title: 'First toast' });
      result.current.toast({ title: 'Second toast' });
    });
    
    expect(result.current.toasts.length).toBe(2);
    expect(result.current.toasts[0].id).not.toBe(result.current.toasts[1].id);
  });

  it('should handle the reducer correctly', () => {
    // Test ADD action
    const addAction = {
      type: 'ADD_TOAST',
      toast: { id: '1', title: 'Add Toast' },
    };
    
    const stateAfterAdd = reducer({ toasts: [] }, addAction);
    expect(stateAfterAdd.toasts.length).toBe(1);
    expect(stateAfterAdd.toasts[0].id).toBe('1');
    
    // Test UPDATE action
    const updateAction = {
      type: 'UPDATE_TOAST',
      toast: { id: '1', title: 'Updated Toast' },
    };
    
    const stateAfterUpdate = reducer(stateAfterAdd, updateAction);
    expect(stateAfterUpdate.toasts.length).toBe(1);
    expect(stateAfterUpdate.toasts[0].title).toBe('Updated Toast');
    
    // Test DISMISS action
    const dismissAction = {
      type: 'DISMISS_TOAST',
      toastId: '1',
    };
    
    const stateAfterDismiss = reducer(stateAfterUpdate, dismissAction);
    expect(stateAfterDismiss.toasts.length).toBe(0);
  });
});