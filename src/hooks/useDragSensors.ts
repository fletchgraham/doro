import type { PointerEvent, TouchEvent } from "react";
import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type PointerSensorOptions,
  type TouchSensorOptions,
} from "@dnd-kit/core";

// Drag sensors shared by every sortable list. Mouse and pen drag after a
// short move; touch drags after a hold, so a swipe still scrolls the page.
//
// PointerSensor also fires for touch, and its distance constraint would
// start a drag the moment a scroll begins, so it hands touch to TouchSensor.
class MousePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: (event: PointerEvent, options: PointerSensorOptions) =>
        event.nativeEvent.pointerType !== "touch" &&
        PointerSensor.activators[0].handler(event, options),
    },
  ];
}

// Holding a finger on a control inside a row (an input, a button) means
// the control, not a drag. Mouse gets the same via stopPropagation on
// pointerdown, which touchstart doesn't go through.
const isControl = (target: EventTarget | null) =>
  target instanceof Element &&
  target.closest("input, textarea, select, button, a, [contenteditable]") !==
    null;

class HoldTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: (event: TouchEvent, options: TouchSensorOptions) =>
        !isControl(event.target) &&
        TouchSensor.activators[0].handler(event, options),
    },
  ];
}

export function useDragSensors({ distance = 8 }: { distance?: number } = {}) {
  return useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance } }),
    useSensor(HoldTouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    })
  );
}
