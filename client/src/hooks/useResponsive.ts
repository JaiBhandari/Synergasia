import * as React from "react";

// Breakpoint values (same as Tailwind defaults)
const BREAKPOINTS = {
  sm: 640,   // Small tablets and large phones
  md: 768,   // Tablets
  lg: 1024,  // Small laptops
  xl: 1280,  // Desktops
  "2xl": 1536 // Large desktops
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

interface ResponsiveState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLargeDesktop: boolean;
  screenSize: 'mobile' | 'tablet' | 'desktop' | 'large';
  width: number;
  height: number;
  sidebarMode: 'expanded' | 'collapsed' | 'offcanvas';
}

export function useResponsive() {
  const [state, setState] = React.useState<ResponsiveState>(() => {
    // Initialize with default values (will be updated on mount)
    const initialWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const initialHeight = typeof window !== 'undefined' ? window.innerHeight : 768;
    return getResponsiveState(initialWidth, initialHeight);
  });

  React.useEffect(() => {
    function handleResize() {
      setState(getResponsiveState(window.innerWidth, window.innerHeight));
    }

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return state;
}

function getResponsiveState(width: number, height: number): ResponsiveState {
  const isMobile = width < BREAKPOINTS.md;
  const isTablet = width >= BREAKPOINTS.md && width < BREAKPOINTS.lg;
  const isDesktop = width >= BREAKPOINTS.lg && width < BREAKPOINTS.xl;
  const isLargeDesktop = width >= BREAKPOINTS.xl;

  let screenSize: ResponsiveState['screenSize'];
  if (isMobile) {
    screenSize = 'mobile';
  } else if (isTablet) {
    screenSize = 'tablet';
  } else if (isDesktop) {
    screenSize = 'desktop';
  } else {
    screenSize = 'large';
  }

  // Progressive sidebar mode based on available space
  let sidebarMode: ResponsiveState['sidebarMode'];
  
  // If mobile, always use offcanvas (burger menu)
  if (isMobile) {
    sidebarMode = 'offcanvas';
  } else {
    // If width is too narrow (less than ~900px), use offcanvas instead of trying to collapse
    // This prevents the cramped collapsed view that doesn't look good
    if (width < 900) {
      sidebarMode = 'offcanvas';
    }
    // Only collapse to icons if height is very short (less than 500px)
    else if (height < 500) {
      sidebarMode = 'collapsed';
    }
    // Otherwise use expanded mode with text
    else {
      sidebarMode = 'expanded';
    }
  }

  return {
    isMobile,
    isTablet,
    isDesktop,
    isLargeDesktop,
    screenSize,
    width,
    height,
    sidebarMode
  };
}

// Hook for getting optimal sidebar width based on screen size
export function useSidebarWidth() {
  const { screenSize, width } = useResponsive();
  
  return React.useMemo(() => {
    switch (screenSize) {
      case 'mobile':
        return {
          width: '18rem', // 288px - full width on mobile overlay
          shouldCollapse: false,
          variant: 'sheet' as const
        };
      case 'tablet':
        // For tablets, use a narrower sidebar or collapse to icon
        if (width < 900) {
          return {
            width: '5rem', // 80px - more comfortable icon width for small tablets
            shouldCollapse: true,
            variant: 'icon' as const
          };
        }
        return {
          width: '12rem', // 192px - reduced width for larger tablets
          shouldCollapse: false,
          variant: 'narrow' as const
        };
      case 'desktop':
        return {
          width: '16rem', // 256px - standard width for desktops
          shouldCollapse: false,
          variant: 'standard' as const
        };
      case 'large':
      default:
        return {
          width: '18rem', // 288px - comfortable width for large screens
          shouldCollapse: false,
          variant: 'full' as const
        };
    }
  }, [screenSize, width]);
}

// Legacy hook for backward compatibility
export function useIsMobile() {
  const { isMobile } = useResponsive();
  return isMobile;
}