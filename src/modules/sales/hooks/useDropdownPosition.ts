import { useEffect, useRef, useState } from "react";

interface DropdownPositionReturn {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  position: {
    top: number;
    left: number;
    openUpward: boolean;
  };
}

export function useDropdownPosition(isOpen: boolean): DropdownPositionReturn {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
    openUpward: false,
  });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow;

      setPosition({
        top: openUpward ? rect.top : rect.bottom,
        left: rect.left,
        openUpward,
      });
    }
  }, [isOpen]);

  return { triggerRef, position };
}
