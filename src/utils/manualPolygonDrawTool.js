// Google retiró por completo DrawingManager de la Maps JavaScript API
// (https://developers.google.com/maps/deprecations) a partir de la v3.65,
// por lo que el modo de dibujo de polígonos se reimplementa a mano aquí
// usando los controles y overlays públicos del mapa (Polygon, Marker,
// map.controls), sin depender de la librería "drawing".

const BUTTON_STYLE = {
  background: "#fff",
  border: "none",
  borderRadius: "2px",
  boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  color: "#333",
  cursor: "pointer",
  fontFamily: "Roboto, Arial, sans-serif",
  fontSize: "13px",
  margin: "10px 4px",
  padding: "8px 12px",
};

export function attachManualPolygonDrawTool(
  map,
  googleMaps,
  { onPolygonComplete, polygonOptions = {}, position } = {},
) {
  if (!map || !googleMaps) return () => {};

  let active = false;
  let path = [];
  let tempPolygon = null;
  let tempMarkers = [];
  let mapClickListener = null;

  const clearTemp = () => {
    tempMarkers.forEach((m) => m.setMap(null));
    tempMarkers = [];
    if (tempPolygon) {
      tempPolygon.setMap(null);
      tempPolygon = null;
    }
    path = [];
  };

  const updateTempPolygon = () => {
    if (!tempPolygon) {
      tempPolygon = new googleMaps.Polygon({
        paths: path,
        map,
        clickable: false,
        strokeColor: polygonOptions.strokeColor || "#FF00FF",
        fillColor: polygonOptions.fillColor || "#FF00FF",
        fillOpacity: 0.25,
        strokeWeight: 2,
      });
    } else {
      tempPolygon.setPath(path);
    }
  };

  const setButtonState = () => {
    drawBtn.textContent = active ? "Cancelar dibujo" : "Dibujar polígono";
    finishBtn.style.display = active && path.length >= 3 ? "inline-block" : "none";
  };

  const finishDrawing = (commit) => {
    map.setOptions({ draggableCursor: null });
    if (mapClickListener) {
      mapClickListener.remove();
      mapClickListener = null;
    }
    const finalPath = path.slice();
    clearTemp();
    active = false;
    setButtonState();

    if (commit && finalPath.length >= 3) {
      const polygon = new googleMaps.Polygon({
        paths: finalPath,
        map,
        editable: true,
        draggable: true,
        fillColor: "#FF00FF",
        fillOpacity: 0.3,
        strokeColor: "#FF00FF",
        strokeWeight: 2,
        ...polygonOptions,
      });
      onPolygonComplete?.(polygon);
    }
  };

  const handleMapClick = (e) => {
    const point = { lat: e.latLng.lat(), lng: e.latLng.lng() };
    path.push(point);

    const marker = new googleMaps.Marker({
      position: point,
      map,
      clickable: path.length === 1,
      icon: {
        path: googleMaps.SymbolPath.CIRCLE,
        scale: 5,
        fillColor: "#FF00FF",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 1,
      },
    });
    if (path.length === 1) {
      marker.addListener("click", () => finishDrawing(true));
    }
    tempMarkers.push(marker);
    updateTempPolygon();
    setButtonState();
  };

  const startDrawing = () => {
    active = true;
    path = [];
    map.setOptions({ draggableCursor: "crosshair" });
    mapClickListener = googleMaps.event.addListener(map, "click", handleMapClick);
    setButtonState();
  };

  const controlDiv = document.createElement("div");
  controlDiv.style.display = "flex";

  const drawBtn = document.createElement("button");
  drawBtn.type = "button";
  Object.assign(drawBtn.style, BUTTON_STYLE);
  drawBtn.onclick = () => {
    if (active) {
      finishDrawing(false);
    } else {
      startDrawing();
    }
  };

  const finishBtn = document.createElement("button");
  finishBtn.type = "button";
  finishBtn.textContent = "Finalizar polígono";
  Object.assign(finishBtn.style, BUTTON_STYLE);
  finishBtn.style.display = "none";
  finishBtn.onclick = () => finishDrawing(true);

  controlDiv.appendChild(drawBtn);
  controlDiv.appendChild(finishBtn);
  setButtonState();

  const controlsArray =
    map.controls[position ?? googleMaps.ControlPosition.TOP_CENTER];
  controlsArray.push(controlDiv);

  return () => {
    finishDrawing(false);
    const idx = controlsArray.getArray().indexOf(controlDiv);
    if (idx > -1) controlsArray.removeAt(idx);
  };
}
