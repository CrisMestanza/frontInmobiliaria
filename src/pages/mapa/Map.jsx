import React, { useState, useEffect, useRef } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import ProyectoSidebar from "./MapSidebarProyecto";
import MapSidebar from "./MapSidebar";
import MapMarker from "./MapMarker";
import PolygonOverlay from "./PolygonOverlay";
import styles from "./Mapa.module.css";
import ChatBotPanel from "../mybot/ChatBotPanel";
import loader from "../../components/loader";
import { useParams } from "react-router-dom";
import { Link } from "react-router-dom";
const defaultCenter = { lat: -6.4882, lng: -76.365629 };
const LIBRARIES = ["places"];

const RANGOS_PRECIO = [
  { label: "$. 5,000 - 15,000", value: "5000-15000" },
  { label: "$. 15,001 - 35,000", value: "15001-35000" },
  { label: "$. 35,001 - 80,000", value: "35001-80000" },
  { label: "$. 80,001 - 150,000", value: "80001-150000" },
  { label: "$. 150,001 - 250,000", value: "150001-250000" },
  { label: "$. 250,001 - más", value: "250001-999999999" },
];

const LotesOverlay = ({
  lotes,
  selectedLote,
  hoveredLote,
  onLoteClick,
  onLoteMouseOver,
  onLoteMouseOut,
}) => {
  const darkenColor = (hex, amount = 0.2) => {
    let c = hex.replace("#", "");
    if (c.length === 8) c = c.substring(0, 6);
    let num = parseInt(c, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.max(0, Math.floor(r * (1 - amount)));
    g = Math.max(0, Math.floor(g * (1 - amount)));
    b = Math.max(0, Math.floor(b * (1 - amount)));
    return `rgb(${r},${g},${b})`;
  };

  const getColorLote = (estado, hovered) => {
    let baseColor;
    switch (estado) {
      case 0:
        baseColor = "#00ff00";
        break;
      case 1:
        baseColor = "#ff0000";
        break;
      case 2:
        baseColor = "#ffff00";
        break;
      default:
        baseColor = "#808080";
    }
    if (estado === 1 || estado === 2 || !hovered) {
      return baseColor;
    }
    return darkenColor(baseColor, 0.3);
  };

  return (
    <>
      {lotes
        .filter((lote) =>
          selectedLote ? lote.idlote === selectedLote.lote.idlote : true,
        )
        .map((lote) => {
          const isLibre = lote.vendido === 0;

          return (
            <PolygonOverlay
              key={lote.idlote}
              puntos={lote.puntos}
              color={getColorLote(lote.vendido, hoveredLote === lote.idlote)}
              onClick={isLibre ? () => onLoteClick(lote) : undefined}
              onMouseOver={
                isLibre ? () => onLoteMouseOver(lote.idlote) : undefined
              }
              onMouseOut={isLibre ? onLoteMouseOut : undefined}
              label={hoveredLote === lote.idlote ? lote.nombre : null}
              options={{
                zIndex: hoveredLote === lote.idlote ? 11 : 10,
                clickable: isLibre,
                draggable: false,
                editable: false,
                strokeWeight: 2,
                strokeColor: "black",
              }}
            />
          );
        })}
    </>
  );
};

function MyMap() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [currentPosition, setCurrentPosition] = useState(defaultCenter);
  const [tiposInmo, setTiposInmo] = useState([]);
  const [selectedTipo, setSelectedTipo] = useState("");
  const [selectedRango, setSelectedRango] = useState("");
  const [proyecto, setProyecto] = useState([]);
  const [selectedProyecto, setselectedProyecto] = useState(null);
  const [lotesProyecto, setLotesProyecto] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [selectedLote, setSelectedLote] = useState(null);
  const [routeMode, setRouteMode] = useState(null);
  const [directions, setDirections] = useState(null);
  const [imagenesProyecto, setImagenesProyecto] = useState([]);
  const [imagenesLote, setImagenesLote] = useState([]);
  const [puntos, setPuntos] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  const [hoveredLote, setHoveredLote] = useState(null);
  const [iconosProyecto, setIconosProyecto] = useState([]);
  const [walkingInfo, setWalkingInfo] = useState(null);
  const [drivingInfo, setDrivingInfo] = useState(null);

  // Dentro de MyMap()
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState(5000); // Valor inicial
  const [tempFilters, setTempFilters] = useState({ tipo: "", precio: 5000 }); // Para el estado flotante

  // Función para determinar si el botón de filtro debe cambiar de color (si hay algo seleccionado)
  const hasActiveFilters =
    selectedTipo !== "" || selectedRango !== "" || priceRange > 5000;

  // Sincronizar el input manual con la barra
  const handlePriceChange = (val) => {
    const value = Math.max(0, parseInt(val) || 0);
    setPriceRange(value);
  };

  const mapRef = useRef(null);
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  // const inmoId = null;
  const { inmoId } = useParams();
  const [filtroBotActivo, setFiltroBotActivo] = useState(false);

  // Usuario
  const [hasSearchedLocation, setHasSearchedLocation] = useState(false);

  // ✅ FIX: Load Google Maps API properly with all required libraries
  useEffect(() => {
    const loadGoogleMaps = async () => {
      try {
        // Check if already loaded
        if (
          window.google?.maps?.places?.Autocomplete &&
          window.google?.maps?.Map
        ) {
          console.log("Google Maps API ya está cargada");
          setIsLoaded(true);
          return;
        }

        console.log("Cargando Google Maps API...");
        await loader.load();

        // Wait a bit to ensure all libraries are initialized
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify critical APIs are available
        if (!window.google?.maps?.Map) {
          throw new Error("google.maps.Map no está disponible");
        }
        if (!window.google?.maps?.places?.Autocomplete) {
          throw new Error("google.maps.places.Autocomplete no está disponible");
        }

        console.log("Google Maps API cargada correctamente");
        setIsLoaded(true);
      } catch (error) {
        console.error("Error al cargar Google Maps API:", error);
        setLoadError(error);
      }
    };

    loadGoogleMaps();
  }, []);

  useEffect(() => {
    // ❗ Si el usuario ya buscó una ubicación, NO usar GPS
    if (hasSearchedLocation) return;

    if (inmoId || selectedProyecto) return;

    navigator.geolocation?.getCurrentPosition(
      (pos) =>
        setCurrentPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => console.warn("Permiso de ubicación denegado."),
    );
  }, [inmoId, selectedProyecto, hasSearchedLocation]);

  useEffect(() => {
    if (inmoId) {
      setSelectedTipo("");
      setSelectedRango("");
      setFiltroBotActivo(false);

      const apiUrl = `https://apiinmo.y0urs.com/api/listProyectosInmobiliaria/${inmoId}`;

      fetch(apiUrl)
        .then((res) => res.json())
        .then((data) => {
          setProyecto(data);
          if (data.length > 0 && mapRef.current && window.google?.maps) {
            const bounds = new window.google.maps.LatLngBounds();
            data.forEach((p) =>
              bounds.extend({
                lat: parseFloat(p.latitud),
                lng: parseFloat(p.longitud),
              }),
            );
            mapRef.current.fitBounds(bounds);
          }
        })
        .catch(console.error);
    }
  }, [inmoId, isLoaded]);

  useEffect(() => {
    if (selectedLote) {
      fetch(
        `https://apiinmo.y0urs.com/api/list_imagen/${selectedLote.lote.idlote}`,
      )
        .then((res) => res.json())
        .then((data) => setImagenesLote(data))
        .catch((err) => console.error("Error cargando imágenes:", err));
    } else {
      setImagenesLote([]);
    }
  }, [selectedLote]);

  useEffect(() => {
    if (selectedProyecto?.idproyecto) {
      fetch(
        `https://apiinmo.y0urs.com/api/list_imagen_proyecto/${selectedProyecto.idproyecto}`,
      )
        .then((res) => res.json())
        .then((data) => setImagenesProyecto(data))
        .catch((err) => console.error("Error cargando imágenes:", err));
    } else {
      setImagenesProyecto([]);
    }
  }, [selectedProyecto]);

  useEffect(() => {
    if (!selectedProyecto) return;

    const cargarLotes = async () => {
      //  UNA sola llamada
      const res = await fetch(
        `https://apiinmo.y0urs.com/api/getLotesConPuntos/${selectedProyecto.idproyecto}`,
      );
      const data = await res.json();

      // 👉 Si hay filtros, filtras en memoria (rápido)
      let lotesFiltrados = data;

      if (selectedRango || filtroBotActivo) {
        lotesFiltrados = data.filter(
          (l) => l.idproyecto === selectedProyecto.idproyecto,
        );
      }

      setLotesProyecto(lotesFiltrados);
    };

    cargarLotes().catch(console.error);
  }, [selectedProyecto, selectedRango, filtroBotActivo]);

  useEffect(() => {
    fetch("https://apiinmo.y0urs.com/api/listTipoInmobiliaria/")
      .then((res) => res.json())
      .then(setTiposInmo)
      .catch(console.error);
  }, []);

  const handleTipoChange = (tipoId) => {
    if (selectedTipo === tipoId) {
      // Si vuelve a hacer clic en el mismo tipo → deseleccionar
      setSelectedTipo("");
    } else {
      setSelectedTipo(tipoId);
      // 🔹 Cuando se selecciona un tipo, se borra el rango
      setSelectedRango("");
    }

    // 🔹 Además, desactivar el filtro del bot
    setFiltroBotActivo(false);
  };

  const handleRangoChange = (rango) => {
    if (selectedRango === rango) {
      // Si vuelve a hacer clic en el mismo rango → deseleccionar
      setSelectedRango("");
    } else {
      setSelectedRango(rango);
      // 🔹 Cuando se selecciona un rango, se borra el tipo
      setSelectedTipo("");
    }

    // 🔹 Además, desactivar el filtro del bot
    setFiltroBotActivo(false);
  };

  useEffect(() => {
    if (inmoId) return;
    if (selectedTipo) {
      const tipo = tiposInmo.find((t) => t.idtipoinmobiliaria === selectedTipo);

      if (tipo) {
        if (tipo.idtipoinmobiliaria === 2) {
          fetch(
            `https://apiinmo.y0urs.com/api/filtroCasaProyecto/${selectedTipo}`,
          )
            .then((res) => res.json())
            .then((data) => {
              setProyecto(data);
            })
            .catch(console.error);
        } else if (tipo.idtipoinmobiliaria === 1) {
          fetch(
            `https://apiinmo.y0urs.com/api/filtroCasaProyecto/${selectedTipo}`,
          )
            .then((res) => res.json())
            .then((data) => {
              setProyecto(data);
            })
            .catch(console.error);
        }
      }
    } else if (selectedRango) {
      fetch(`https://apiinmo.y0urs.com/api/rangoPrecio/${selectedRango}`)
        .then((res) => res.json())
        .then((data) => {
          setLotes(data.lotes || []);

          const proyectosUnicos = [];
          const ids = new Set();
          data.lotes.forEach((lote) => {
            const p = lote.proyectos;
            if (p && !ids.has(p.idproyecto)) {
              ids.add(p.idproyecto);
              proyectosUnicos.push(p);
            }
          });

          if (Array.isArray(data.proyectos)) {
            data.proyectos.forEach((p) => {
              if (!ids.has(p.idproyecto)) {
                ids.add(p.idproyecto);
                proyectosUnicos.push(p);
              }
            });
          }

          setProyecto(proyectosUnicos);
          console.log(proyectosUnicos);
        })
        .catch(console.error);
    } else {
      fetch("https://apiinmo.y0urs.com/api/listProyectos/")
        .then((res) => res.json())
        .then(setProyecto)
        .catch(console.error);
    }
  }, [selectedTipo, selectedRango, tiposInmo, inmoId]);

  const calculateInfo = (mode, proyecto) => {
    if (!window.google?.maps?.DirectionsService) {
      console.warn("DirectionsService no disponible");
      return;
    }

    const service = new window.google.maps.DirectionsService();
    service.route(
      {
        origin: currentPosition,
        destination: {
          lat: parseFloat(proyecto.latitud),
          lng: parseFloat(proyecto.longitud),
        },
        travelMode: mode,
      },
      (result, status) => {
        if (status === "OK") {
          const leg = result.routes[0].legs[0];
          const info = {
            distance: leg.distance.text,
            duration: leg.duration.text,
          };
          if (mode === "WALKING") setWalkingInfo(info);
          if (mode === "DRIVING") setDrivingInfo(info);
        }
      },
    );
  };

  const handleLoteClick = (lote) => {
    if (isMobile()) {
      setShowFilters(false);
    }

    if (mapRef.current) {
      mapRef.current.panTo({
        lat: parseFloat(lote.latitud),
        lng: parseFloat(lote.longitud),
      });
      mapRef.current.setZoom(18);
    }

    setSelectedLote({
      lote: lote, // ✅ YA incluye puntos
      inmo: selectedProyecto?.inmo ?? null,
    });
  };

  const isMobile = () => window.innerWidth <= 768;

  const handleMarkerClick = async (proyecto) => {
    if (isMobile()) {
      setShowFilters(false);
    }
    try {
      setRouteMode(null);
      setDirections(null);
      setWalkingInfo(null);
      setDrivingInfo(null);
      setLotesProyecto([]);
      setPuntos([]);
      setIconosProyecto([]);

      const fecha = new Date().toISOString().split("T")[0];
      const hora = new Date().toLocaleTimeString("en-GB", { hour12: false });

      await fetch("https://apiinmo.y0urs.com/api/registerClickProyecto/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idproyecto: proyecto.idproyecto,
          fecha: fecha,
          hora: hora,
        }),
      });

      calculateInfo("WALKING", proyecto);
      calculateInfo("DRIVING", proyecto);

      const resPuntos = await fetch(
        `https://apiinmo.y0urs.com/api/listPuntosProyecto/${proyecto.idproyecto}`,
      );
      const dataPuntos = await resPuntos.json();
      setPuntos(dataPuntos);

      if (dataPuntos.length > 0 && mapRef.current) {
        const bounds = new window.google.maps.LatLngBounds();
        dataPuntos.forEach((p) =>
          bounds.extend({
            lat: parseFloat(p.latitud),
            lng: parseFloat(p.longitud),
          }),
        );
        mapRef.current.fitBounds(bounds);
      }
      const resLotes = await fetch(
        `https://apiinmo.y0urs.com/api/getLotesConPuntos/${proyecto.idproyecto}`,
      );
      const lotesConPuntos = await resLotes.json();

      setLotesProyecto(lotesConPuntos);

      const resInmo = await fetch(
        `https://apiinmo.y0urs.com/api/getInmobiliaria/${proyecto.idinmobiliaria}`,
      );
      const inmoData = await resInmo.json();

      const resIconos = await fetch(
        `https://apiinmo.y0urs.com/api/list_iconos_proyecto/${proyecto.idproyecto}`,
      );
      const dataIconos = await resIconos.json();
      setIconosProyecto(dataIconos);

      setselectedProyecto({
        ...proyecto,
        inmo: inmoData[0] ?? null,
      });
    } catch (err) {
      console.error("Error cargando inmobiliaria:", err);
    }
  };

  // ✅ FIX: Initialize Autocomplete only when Google Maps is fully loaded
  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    try {
      if (!window.google?.maps?.places?.Autocomplete) {
        console.error("Autocomplete no está disponible");
        return;
      }

      const autocomplete = new window.google.maps.places.Autocomplete(
        inputRef.current,
      );
      autocompleteRef.current = autocomplete;

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const location = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          };

          setCurrentPosition(location);
          setHasSearchedLocation(true); // ✅ CLAVE

          if (mapRef.current) {
            if (place.geometry.viewport) {
              mapRef.current.fitBounds(place.geometry.viewport);
            } else {
              mapRef.current.panTo(location);
              mapRef.current.setZoom(17);
            }
          }
        }
      });
    } catch (error) {
      console.error("Error inicializando Autocomplete:", error);
    }
  }, [isLoaded]);

  if (loadError) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Error al cargar Google Maps</h2>
        <p>{loadError.message || JSON.stringify(loadError)}</p>
        <button onClick={() => window.location.reload()}>
          Recargar página
        </button>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Cargando mapa...</h2>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          {/* Logo Section */}
          <div className={styles.logoSection}>
            <div className={styles.logoIcon}>
              <span className="material-symbols-outlined">location_on</span>
            </div>
            <span className={styles.logoText}>
              Geo<span className={styles.logoHighlight}>Habita</span>
            </span>
          </div>

          {/* Search Hub (Pill) */}
          <div className={styles.searchHub}>
            <div className={styles.pillContainer}>
              <div className={styles.pillItem}>
                <label>Ubicación</label>
                <input type="text" placeholder="¿A dónde vas?" ref={inputRef} />
              </div>

              <div className={styles.pillItem}>
                <label>Tipo</label>
                <select
                  value={selectedTipo}
                  onChange={(e) => handleTipoChange(e.target.value)}
                >
                  <option value="">Cualquier tipo</option>
                  {tiposInmo.map((tipo) => (
                    <option
                      key={tipo.idtipoinmobiliaria}
                      value={tipo.idtipoinmobiliaria}
                    >
                      {tipo.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.pillItem}>
                <label>Presupuesto</label>
                <select
                  value={selectedRango}
                  onChange={(e) => handleRangoChange(e.target.value)}
                >
                  <option value="">Sin límite</option>
                  {RANGOS_PRECIO.map((rango) => (
                    <option key={rango.value} value={rango.value}>
                      {rango.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button className={styles.searchBtn}>
              <span className="material-symbols-outlined">search</span>
            </button>
          </div>

          <div className={styles.searchActions}>
            <button
              className={`${styles.filterToggleBtn} ${hasActiveFilters ? styles.filterActive : ""}`}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <span className="material-symbols-outlined">tune</span>
            </button>
          </div>

          {/* User Actions */}
          <div className={styles.userActions}>
            <Link to="/login" className={styles.announceBtn}>
              Anuncia tu propiedad
            </Link>
            <div className={styles.userMenu}>
              <span className="material-symbols-outlined">menu</span>
              <div className={styles.userAvatar}>
                <span className="material-symbols-outlined">person</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`${styles.filterSubHeader} ${isFilterOpen ? styles.show : ""}`}
      >
        <div className={styles.filterGrid}>
          <div className={styles.filterControl}>
            <label>Presupuesto Máximo ($.)</label>
            <div className={styles.rangeWrapper}>
              <input
                type="range"
                min="5000"
                max="500000"
                step="1000"
                value={priceRange}
                onChange={(e) => handlePriceChange(e.target.value)}
              />
              <input
                type="number"
                value={priceRange}
                onChange={(e) => handlePriceChange(e.target.value)}
                className={styles.manualInput}
              />
            </div>
          </div>
          {/* Otros filtros adicionales que puedes deducir */}
          <div className={styles.filterControl}>
            <label>Área mínima (m²)</label>
            <input
              type="number"
              placeholder="Ej: 90"
              className={styles.manualInput}
            />
          </div>
        </div>
      </div>

      {/* 3. Chips Flotantes de filtros activos (Aparecen debajo del header) */}
      {!isFilterOpen && hasActiveFilters && (
        <div className={styles.activeFiltersBar}>
          {selectedTipo && (
            <span className={styles.chip}>Tipo: {selectedTipo}</span>
          )}
          {priceRange > 5000 && (
            <span className={styles.chip}>
              Bajo $.{priceRange.toLocaleString()}
            </span>
          )}
          <button
            onClick={() => {
              setSelectedTipo("");
              setPriceRange(5000);
            }}
            className={styles.clearBtn}
          >
            Limpiar
          </button>
        </div>
      )}

      {showFilters && (
        <div className={styles.filterPanel}>
          <button
            className={styles.closeBtn}
            onClick={() => setShowFilters(false)}
          >
            ✖
          </button>

          <div className={styles.filterGroup}>
            <h4>Quiero ver:</h4>
            <div className={styles.filterOptions}>
              {tiposInmo.map((tipo) => (
                <button
                  key={tipo.idtipoinmobiliaria}
                  className={`${styles.filterChip} ${
                    selectedTipo === tipo.idtipoinmobiliaria
                      ? styles.active
                      : ""
                  }`}
                  onClick={() => handleTipoChange(tipo.idtipoinmobiliaria)}
                >
                  {tipo.nombre}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.filterGroup}>
            <h4>Rango de precios:</h4>
            <div className={styles.filterOptions}>
              {RANGOS_PRECIO.map((rango) => (
                <button
                  key={rango.value}
                  className={`${styles.filterChip} ${
                    selectedRango === rango.value ? styles.active : ""
                  }`}
                  onClick={() => handleRangoChange(rango.value)}
                >
                  {rango.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerClassName={styles.map}
        center={currentPosition}
        zoom={13}
        onLoad={(map) => (mapRef.current = map)}
        options={{
          gestureHandling: "greedy",
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: false,
        }}
      >
        {puntos.length === 0 && <Marker position={currentPosition} />}

        {!filtroBotActivo &&
          proyecto
            .filter(
              (p) =>
                !(
                  selectedProyecto &&
                  puntos.length > 0 &&
                  selectedProyecto.idproyecto === p.idproyecto
                ),
            )
            .map((p) => (
              <MapMarker
                key={p.idproyecto}
                proyecto={p}
                onClick={handleMarkerClick}
              />
            ))}

        {filtroBotActivo &&
          proyecto
            .filter(
              (p) =>
                !(
                  selectedProyecto &&
                  selectedProyecto.idproyecto === p.idproyecto
                ),
            )
            .map((p) => (
              <Marker
                key={p.idproyecto}
                position={{
                  lat: parseFloat(p.latitud),
                  lng: parseFloat(p.longitud),
                }}
                icon={{
                  url:
                    p.iconoTipo === "casa"
                      ? "https://cdn-icons-png.freepik.com/512/11130/11130373.png"
                      : "/proyectoicono.png",
                  scaledSize: new window.google.maps.Size(40, 40),
                }}
                title={p.nombreproyecto}
                onClick={() => handleMarkerClick(p)}
              />
            ))}

        {iconosProyecto.map((ico) => (
          <Marker
            key={ico.idiconoproyecto}
            position={{
              lat: parseFloat(ico.latitud),
              lng: parseFloat(ico.longitud),
            }}
            icon={{
              url: `https://apiinmo.y0urs.com${ico.icono_detalle.imagen}`,
              scaledSize: new window.google.maps.Size(40, 40),
            }}
            title={ico.icono_detalle.nombre}
          />
        ))}

        {puntos.length > 0 && (
          <PolygonOverlay
            puntos={puntos}
            color="#106e2eff"
            showLados={false}
            options={{
              clickable: false,
              fillColor: "transparent",
              strokeWeight: 2,
            }}
          />
        )}

        {selectedProyecto && lotesProyecto.length > 0 && (
          <LotesOverlay
            lotes={lotesProyecto}
            selectedLote={selectedLote}
            hoveredLote={hoveredLote}
            onLoteClick={handleLoteClick}
            onLoteMouseOver={setHoveredLote}
            onLoteMouseOut={() => setHoveredLote(null)}
          />
        )}

        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>

      {selectedProyecto && (
        <ProyectoSidebar
          inmo={selectedProyecto?.inmo}
          proyecto={selectedProyecto}
          imagenes={imagenesProyecto}
          walkingInfo={walkingInfo}
          drivingInfo={drivingInfo}
          mapRef={mapRef}
          onClose={async () => {
            setselectedProyecto(null);
            setDirections(null);
            setWalkingInfo(null);
            setDrivingInfo(null);
            setRouteMode(null);
            setImagenesProyecto([]);
            setPuntos([]);
            setLotesProyecto([]);
            setIconosProyecto([]);
            setSelectedLote(null); // 🔥 CLAVE

            try {
              if (selectedRango) {
                const res = await fetch(
                  `https://apiinmo.y0urs.com/api/rangoPrecio/${selectedRango}`,
                );
                const data = await res.json();
                setLotes(data.lotes || []);
                const proyectosUnicos = [];
                const ids = new Set();
                (data.lotes || []).forEach((lote) => {
                  const p = lote.proyectos;
                  if (p && !ids.has(p.idproyecto)) {
                    ids.add(p.idproyecto);
                    proyectosUnicos.push(p);
                  }
                });
                (data.proyectos || []).forEach((p) => {
                  if (!ids.has(p.idproyecto)) {
                    ids.add(p.idproyecto);
                    proyectosUnicos.push(p);
                  }
                });
                setProyecto(proyectosUnicos);
              } else if (inmoId) {
                const res = await fetch(
                  `https://apiinmo.y0urs.com/api/listProyectosInmobiliaria/${inmoId}`,
                );
                const data = await res.json();
                setProyecto(data);
              } else {
                const res = await fetch(
                  "https://apiinmo.y0urs.com/api/listProyectos/",
                );
                const data = await res.json();
                setProyecto(data);
              }
            } catch (err) {
              console.error("Error recargando proyectos al cerrar:", err);
            }
          }}
        />
      )}

      {selectedLote && (
        <MapSidebar
          lote={selectedLote.lote}
          inmo={selectedLote.inmo}
          imagenes={imagenesLote}
          walkingInfo={walkingInfo}
          drivingInfo={drivingInfo}
          mapRef={mapRef}
          onClose={() => {
            setSelectedLote(null);
            setImagenesLote([]);
            setLotesProyecto((prev) => [...prev]);
          }}
        />
      )}
    </div>
  );
}

export default React.memo(MyMap);
