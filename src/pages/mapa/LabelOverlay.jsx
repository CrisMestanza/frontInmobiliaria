import React from "react";
import { OverlayView } from "@react-google-maps/api";

const LabelOverlay = ({
  position,
  text,
  fontSize = 12,
  maxWidth = 120,
  color = "#ffffff",
}) => {
  return (
    <OverlayView
      position={position}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
    >
      <div
        style={{
          pointerEvents: "none",
          transform: "translate(-50%, -50%)",
          width: `${Math.max(40, maxWidth)}px`,
          maxWidth: `${Math.max(40, maxWidth)}px`,
          textAlign: "center",
          color,
          fontSize: `${fontSize}px`,
          fontWeight: 800,
          lineHeight: 1.1,
          textShadow:
            "0 1px 2px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.65), 0 0 14px rgba(0,0,0,0.45)",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {text}
      </div>
    </OverlayView>
  );
};

export default LabelOverlay;
