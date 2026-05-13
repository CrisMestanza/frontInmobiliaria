import { useCallback, useEffect, useRef, useState } from "react";

const MIN_SCALE = 1;
const MAX_SCALE = 4;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getTouchDistance = (touchA, touchB) =>
  Math.hypot(touchB.clientX - touchA.clientX, touchB.clientY - touchA.clientY);

export default function useImagePanZoom({
  onSwipeNext,
  onSwipePrev,
  maxScale = MAX_SCALE,
} = {}) {
  const stageRef = useRef(null);
  const imageRef = useRef(null);
  const suppressClickRef = useRef(false);
  const gestureRef = useRef({
    isPanning: false,
    startX: 0,
    startY: 0,
    originOffsetX: 0,
    originOffsetY: 0,
    pinchStartDistance: 0,
    pinchStartScale: MIN_SCALE,
    swipeStartX: 0,
    swipeStartY: 0,
    activeMode: null,
    pointerId: null,
  });
  const [transform, setTransform] = useState({
    scale: MIN_SCALE,
    x: 0,
    y: 0,
  });

  const clampOffset = useCallback((nextScale, nextX, nextY) => {
    const stageEl = stageRef.current;
    const imageEl = imageRef.current;
    if (!stageEl || !imageEl || nextScale <= 1) {
      return { x: 0, y: 0 };
    }

    const stageRect = stageEl.getBoundingClientRect();
    const imageRect = imageEl.getBoundingClientRect();
    const baseWidth = imageRect.width / Math.max(transform.scale, 1);
    const baseHeight = imageRect.height / Math.max(transform.scale, 1);
    const scaledWidth = baseWidth * nextScale;
    const scaledHeight = baseHeight * nextScale;
    const maxOffsetX = Math.max(0, (scaledWidth - stageRect.width) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - stageRect.height) / 2);

    return {
      x: clamp(nextX, -maxOffsetX, maxOffsetX),
      y: clamp(nextY, -maxOffsetY, maxOffsetY),
    };
  }, [transform.scale]);

  const applyTransform = useCallback((nextScale, nextX, nextY) => {
    const safeScale = clamp(nextScale, MIN_SCALE, maxScale);
    const safeOffset = clampOffset(safeScale, nextX, nextY);
    setTransform({
      scale: safeScale,
      x: safeOffset.x,
      y: safeOffset.y,
    });
  }, [clampOffset, maxScale]);

  const reset = useCallback(() => {
    setTransform({ scale: MIN_SCALE, x: 0, y: 0 });
    suppressClickRef.current = false;
    gestureRef.current = {
      isPanning: false,
      startX: 0,
      startY: 0,
      originOffsetX: 0,
      originOffsetY: 0,
      pinchStartDistance: 0,
      pinchStartScale: MIN_SCALE,
      swipeStartX: 0,
      swipeStartY: 0,
      activeMode: null,
      pointerId: null,
    };
  }, []);

  const startPan = useCallback((clientX, clientY) => {
    suppressClickRef.current = false;
    gestureRef.current.isPanning = true;
    gestureRef.current.activeMode = "pan";
    gestureRef.current.startX = clientX;
    gestureRef.current.startY = clientY;
    gestureRef.current.originOffsetX = transform.x;
    gestureRef.current.originOffsetY = transform.y;
  }, [transform.x, transform.y]);

  const endPointerGesture = useCallback(() => {
    gestureRef.current.isPanning = false;
    gestureRef.current.pointerId = null;
    if (gestureRef.current.activeMode === "pan") {
      gestureRef.current.activeMode = null;
    }
  }, []);

  const handleWheel = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY < 0 ? 0.24 : -0.24;
    const nextScale = clamp(transform.scale + delta, MIN_SCALE, maxScale);
    if (nextScale <= 1) {
      reset();
      return;
    }
    applyTransform(nextScale, transform.x, transform.y);
  }, [applyTransform, maxScale, reset, transform.scale, transform.x, transform.y]);

  const handleMouseDown = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();
    if (transform.scale <= 1) return;
    startPan(event.clientX, event.clientY);
  }, [startPan, transform.scale]);

  const handleMouseMove = useCallback((event) => {
    if (!gestureRef.current.isPanning) return;
    event.preventDefault();
    const deltaX = event.clientX - gestureRef.current.startX;
    const deltaY = event.clientY - gestureRef.current.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      suppressClickRef.current = true;
    }
    applyTransform(
      transform.scale,
      gestureRef.current.originOffsetX + deltaX,
      gestureRef.current.originOffsetY + deltaY,
    );
  }, [applyTransform, transform.scale]);

  const handlePointerDown = useCallback((event) => {
    if (event.pointerType === "mouse") return;
    event.preventDefault();
    event.stopPropagation();
    if (transform.scale <= 1 || gestureRef.current.activeMode === "pinch") return;
    gestureRef.current.pointerId = event.pointerId;
    startPan(event.clientX, event.clientY);
  }, [startPan, transform.scale]);

  const handleDragStart = useCallback((event) => {
    event.preventDefault();
  }, []);

  const handlePointerMove = useCallback((event) => {
    if (!gestureRef.current.isPanning) return;
    if (
      gestureRef.current.pointerId !== null &&
      event.pointerId !== gestureRef.current.pointerId
    ) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - gestureRef.current.startX;
    const deltaY = event.clientY - gestureRef.current.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      suppressClickRef.current = true;
    }
    applyTransform(
      transform.scale,
      gestureRef.current.originOffsetX + deltaX,
      gestureRef.current.originOffsetY + deltaY,
    );
  }, [applyTransform, transform.scale]);

  const handlePointerUp = useCallback((event) => {
    if (
      gestureRef.current.pointerId !== null &&
      event.pointerId !== gestureRef.current.pointerId
    ) {
      return;
    }
    endPointerGesture();
  }, [endPointerGesture]);

  const handleTouchStart = useCallback((event) => {
    event.stopPropagation();
    const touches = event.touches;
    if (touches.length === 2) {
      gestureRef.current.activeMode = "pinch";
      gestureRef.current.pinchStartDistance = getTouchDistance(
        touches[0],
        touches[1],
      );
      gestureRef.current.pinchStartScale = transform.scale;
      gestureRef.current.originOffsetX = transform.x;
      gestureRef.current.originOffsetY = transform.y;
      return;
    }

    const touch = touches[0];
    gestureRef.current.swipeStartX = touch.clientX;
    gestureRef.current.swipeStartY = touch.clientY;
    if (transform.scale > 1.02) {
      startPan(touch.clientX, touch.clientY);
      return;
    }
    gestureRef.current.activeMode = "swipe";
  }, [startPan, transform.scale, transform.x, transform.y]);

  const handleTouchMove = useCallback((event) => {
    const touches = event.touches;
    if (touches.length === 2 && gestureRef.current.activeMode === "pinch") {
      event.preventDefault();
      const nextDistance = getTouchDistance(touches[0], touches[1]);
      const ratio =
        nextDistance / Math.max(gestureRef.current.pinchStartDistance, 1);
      const nextScale = clamp(
        gestureRef.current.pinchStartScale * ratio,
        MIN_SCALE,
        maxScale,
      );
      applyTransform(
        nextScale,
        gestureRef.current.originOffsetX,
        gestureRef.current.originOffsetY,
      );
      return;
    }

    if (gestureRef.current.activeMode === "pan" && touches.length === 1) {
      event.preventDefault();
      const touch = touches[0];
      const deltaX = touch.clientX - gestureRef.current.startX;
      const deltaY = touch.clientY - gestureRef.current.startY;
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        suppressClickRef.current = true;
      }
      applyTransform(
        transform.scale,
        gestureRef.current.originOffsetX + deltaX,
        gestureRef.current.originOffsetY + deltaY,
      );
    }
  }, [applyTransform, maxScale, transform.scale]);

  const handleTouchEnd = useCallback((event) => {
    const gesture = gestureRef.current;
    if (
      gesture.activeMode === "swipe" &&
      transform.scale <= 1.02 &&
      event.changedTouches.length
    ) {
      const touch = event.changedTouches[0];
      const diffX = gesture.swipeStartX - touch.clientX;
      const diffY = Math.abs(gesture.swipeStartY - touch.clientY);
      if (Math.abs(diffX) > 50 && diffY < 60) {
        if (diffX > 0) onSwipeNext?.();
        else onSwipePrev?.();
      }
    }

    gesture.isPanning = false;
    gesture.pinchStartDistance = 0;
    gesture.activeMode = null;
    gesture.pointerId = null;
  }, [onSwipeNext, onSwipePrev, transform.scale]);

  useEffect(() => {
    const handleMouseUp = () => endPointerGesture();
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [endPointerGesture]);

  useEffect(() => {
    const stageEl = stageRef.current;
    if (!stageEl) return undefined;
    const wheelListener = (event) => {
      handleWheel(event);
    };
    stageEl.addEventListener("wheel", wheelListener, { passive: false });
    return () => {
      stageEl.removeEventListener("wheel", wheelListener);
    };
  }, [handleWheel]);

  const consumeSuppressedClick = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return {
    stageRef,
    imageRef,
    scale: transform.scale,
    offsetX: transform.x,
    offsetY: transform.y,
    consumeSuppressedClick,
    reset,
    bind: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: endPointerGesture,
      onMouseLeave: endPointerGesture,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: endPointerGesture,
      onDragStart: handleDragStart,
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
  };
}
