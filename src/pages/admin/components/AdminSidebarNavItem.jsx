import React, { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import {
  SIDEBAR_ITEM_HOVER,
  SIDEBAR_SPRING,
  SIDEBAR_SUBMENU_ITEM_VARIANTS,
  SIDEBAR_SUBMENU_VARIANTS,
} from './sidebarMotion';

function matchesItemPath(pathname, to) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AdminSidebarNavItem({
  item,
  pathname,
  isCollapsed = false,
  depth = 0,
}) {
  const MotionDiv = motion.div;
  const MotionSpan = motion.span;
  const MotionButton = motion.button;
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;
  const isRouteActive = matchesItemPath(pathname, item.to);
  const isChildActive = hasChildren && item.children.some((child) => matchesItemPath(pathname, child.to));
  const isActiveBranch = isRouteActive || isChildActive;
  const [isOpen, setIsOpen] = useState(isActiveBranch);

  useEffect(() => {
    if (isActiveBranch) {
      setIsOpen(true);
    }
  }, [isActiveBranch]);

  const itemStyle = useMemo(
    () => ({ '--sidebar-depth': depth }),
    [depth],
  );

  const itemContent = () => (
    <>
      <span className="admin-sidebar-linkIconWrap">
        <item.icon size={18} />
      </span>
      <span className="admin-sidebar-linkCopy">
        <span className="admin-sidebar-linkLabel">{item.label}</span>
        <span className="admin-sidebar-linkHint">{item.description}</span>
      </span>
    </>
  );

  if (!hasChildren) {
    return (
      <MotionDiv
        layout="position"
        className={`admin-sidebar-item${isRouteActive ? ' admin-sidebar-item--active' : ''}`}
        style={itemStyle}
        whileHover={isCollapsed ? undefined : SIDEBAR_ITEM_HOVER}
      >
        {isRouteActive && (
          <MotionDiv
            layoutId={isCollapsed ? 'admin-sidebar-active-pill-collapsed' : 'admin-sidebar-active-pill'}
            className="admin-sidebar-activeChrome"
            transition={SIDEBAR_SPRING}
          >
            <span className="admin-sidebar-activePill" />
          </MotionDiv>
        )}
        <NavLink
          to={item.to}
          end={item.to === '/dashboard/resumen'}
          className={({ isActive }) =>
            `admin-sidebar-link admin-sidebar-link--${item.accent} ${isActive ? 'admin-sidebar-link--active' : ''}`
          }
          title={`${item.label} · ${item.description}`}
        >
          {itemContent()}
        </NavLink>
      </MotionDiv>
    );
  }

  return (
    <MotionDiv
      layout="position"
      className={`admin-sidebar-item admin-sidebar-item--group${isActiveBranch ? ' admin-sidebar-item--active' : ''}`}
      style={itemStyle}
    >
      {isActiveBranch && (
        <MotionDiv
          layoutId={isCollapsed ? 'admin-sidebar-active-pill-collapsed' : 'admin-sidebar-active-pill'}
          className="admin-sidebar-activeChrome"
          transition={SIDEBAR_SPRING}
        >
          <span className="admin-sidebar-activePill" />
        </MotionDiv>
      )}
      <MotionButton
        type="button"
        className={`admin-sidebar-link admin-sidebar-link--${item.accent} ${isActiveBranch ? 'admin-sidebar-link--active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        whileHover={isCollapsed ? undefined : SIDEBAR_ITEM_HOVER}
        title={`${item.label} · ${item.description}`}
      >
        <span className="admin-sidebar-linkIconWrap">
          <item.icon size={18} />
        </span>
        <span className="admin-sidebar-linkCopy">
          <span className="admin-sidebar-linkLabel">{item.label}</span>
          <span className="admin-sidebar-linkHint">{item.description}</span>
        </span>
        <MotionSpan
          className="admin-sidebar-chevron"
          animate={{ rotate: isOpen ? 90 : 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <ChevronRight size={16} />
        </MotionSpan>
      </MotionButton>

      <AnimatePresence initial={false}>
        {isOpen && !isCollapsed && (
          <MotionDiv
            layout="position"
            className="admin-sidebar-submenuWrap"
            variants={SIDEBAR_SUBMENU_VARIANTS}
            initial="collapsed"
            animate="open"
            exit="collapsed"
          >
            <div className="admin-sidebar-submenu">
              {item.children.map((child, index) => (
                <MotionDiv
                  key={child.to}
                  custom={index}
                  variants={SIDEBAR_SUBMENU_ITEM_VARIANTS}
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                >
                  <AdminSidebarNavItem
                    item={child}
                    pathname={pathname}
                    isCollapsed={false}
                    depth={depth + 1}
                  />
                </MotionDiv>
              ))}
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>
    </MotionDiv>
  );
}
