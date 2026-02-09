// ModalPortal.jsx
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const ModalPortal = ({ children }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const modalRoot = document.getElementById("modal-root");
  if (!modalRoot) return null;

  return createPortal(children, modalRoot);
};

export default ModalPortal;
