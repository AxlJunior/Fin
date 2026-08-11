import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus, Pencil, Trash2, Download, Upload, CreditCard, ArrowUpRight, ArrowDownRight,
  Wallet, Calendar, Search, X, Settings, PieChart as PieIcon, LayoutGrid, ListOrdered,
  Check, ChevronLeft, ChevronRight, RotateCcw
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from "recharts";

/* ------------------------------------------------------------------ *
 *  Paleta: fondo azul-pizarra medio (oscuro pero no negro) + pasteles *
 * ------------------------------------------------------------------ */
const T = {
  bg: "#242a3d",
  panel: "#2c3350",
  panel2: "#343c5c",
  panel3: "#3d4668",
  line: "#434d75",
  text: "#edeffb",
  dim: "#a3adcd",
  dim2: "#7882a6",
  mint: "#93dcb8",
  rose: "#f4a3ac",
  lav: "#bda9f3",
  sky: "#9ac8f2",
  butter: "#f6d79f",
  peach: "#f5b791",
};

const PASTELS = [T.mint, T.rose, T.lav, T.sky, T.butter, T.peach, "#a8e0d5", "#e9a8d5"];

const KEY = "finanzas:v1";

const CATS_DEFAULT = [
  { id: "c1", nombre: "Sueldo", tipo: "ingreso", color: T.mint },
  { id: "c2", nombre: "Extras / Freelance", tipo: "ingreso", color: "#a8e0d5" },
  { id: "c3", nombre: "Supermercado", tipo: "gasto", color: T.rose },
  { id: "c4", nombre: "Compras", tipo: "gasto", color: T.lav },
  { id: "c5", nombre: "Renta / Hogar", tipo: "gasto", color: T.sky },
  { id: "c6", nombre: "Transporte", tipo: "gasto", color: T.butter },
  { id: "c7", nombre: "Comida fuera", tipo: "gasto", color: T.peach },
  { id: "c8", nombre: "Servicios", tipo: "gasto", color: "#e9a8d5" },
  { id: "c9", nombre: "Salud", tipo: "gasto", color: "#a8e0d5" },
  { id: "c10", nombre: "Ocio", tipo: "gasto", color: T.lav },
];

const METODOS = ["Efectivo", "Débito", "Transferencia", "Tarjeta de crédito"];

/* ----------------------------- utilidades ----------------------------- */
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hoyISO = () => toISO(new Date());
const parseISO = (s) => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
const diasEnMes = (y, m) => new Date(y, m + 1, 0).getDate();
const fechaEnDia = (y, m, dia) => new Date(y, m, Math.min(Math.max(1, dia | 0), diasEnMes(y, m)));
const mesSiguiente = (y, m) => { const d = new Date(y, m + 1, 1); return [d.getFullYear(), d.getMonth()]; };
const ymHoy = () => hoyISO().slice(0, 7);
const ymShift = (ym, k) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + k, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const ymLabel = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("es", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fechaCorta = (iso) => parseISO(iso).toLocaleDateString("es", { day: "2-digit", month: "short" });
const fechaLarga = (d) => d.toLocaleDateString("es", { day: "2-digit", month: "long" });
const money = (n, cur = "$") => {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v < 0 ? "-" : "") + cur + s;
};
const moneyCorto = (n, cur = "$") => {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1000000) return cur + (v / 1000000).toFixed(1) + "M";
  if (v >= 1000) return cur + (v / 1000).toFixed(1) + "k";
  return cur + v.toFixed(0);
};

/* --------------- lógica de tarjetas: cortes y vencimientos --------------- */
function corteDe(tarjeta, fecha) {
  const y = fecha.getFullYear(), m = fecha.getMonth();
  const corte = fechaEnDia(y, m, tarjeta.cierre);
  if (fecha <= corte) return corte;
  const [y2, m2] = mesSiguiente(y, m);
  return fechaEnDia(y2, m2, tarjeta.cierre);
}
function vencimientoDe(tarjeta, corte) {
  const desplaza = Number(tarjeta.pago) <= Number(tarjeta.cierre) ? 1 : 0;
  const d = new Date(corte.getFullYear(), corte.getMonth() + desplaza, 1);
  return fechaEnDia(d.getFullYear(), d.getMonth(), tarjeta.pago);
}
function corteMasMeses(tarjeta, corte, k) {
  const d = new Date(corte.getFullYear(), corte.getMonth() + k, 1);
  return fechaEnDia(d.getFullYear(), d.getMonth(), tarjeta.cierre);
}

/** Convierte movimientos con tarjeta en cargos (una fila por cuota). */
function cargosDeTarjeta(movs, tarjeta) {
  const out = [];
  movs.filter((t) => t.tipo === "gasto" && t.tarjetaId === tarjeta.id).forEach((t) => {
    const n = Math.max(1, Number(t.cuotas) || 1);
    const base = corteDe(tarjeta, parseISO(t.fecha));
    const cuota = (Number(t.monto) || 0) / n;
    for (let i = 0; i < n; i++) {
      const corte = corteMasMeses(tarjeta, base, i);
      out.push({
        movId: t.id, nombre: t.nota || t.categoria, categoria: t.categoria, fecha: t.fecha,
        monto: cuota, cuota: i + 1, cuotas: n, corte, vence: vencimientoDe(tarjeta, corte),
      });
    }
  });
  return out.sort((a, b) => a.vence - b.vence || a.fecha.localeCompare(b.fecha));
}

function resumenTarjeta(movs, tarjeta) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const cargos = cargosDeTarjeta(movs, tarjeta);
  const pendientes = cargos.filter((c) => c.vence >= hoy);
  const deuda = pendientes.reduce((s, c) => s + c.monto, 0);
  const corteAbierto = corteDe(tarjeta, hoy);
  const enCorteActual = cargos.filter((c) => +c.corte === +corteAbierto);
  const proximoVence = pendientes.length ? pendientes[0].vence : vencimientoDe(tarjeta, corteAbierto);
  const aPagar = pendientes.filter((c) => +c.vence === +proximoVence).reduce((s, c) => s + c.monto, 0);
  const limite = Number(tarjeta.limite) || 0;
  return {
    cargos, pendientes, deuda, corteAbierto, enCorteActual,
    totalCorteActual: enCorteActual.reduce((s, c) => s + c.monto, 0),
    proximoVence, aPagar, limite,
    disponible: limite ? Math.max(0, limite - deuda) : null,
    uso: limite ? Math.min(100, (deuda / limite) * 100) : null,
    dias: Math.round((proximoVence - hoy) / 86400000),
  };
}

/* ------------------------------ UI base ------------------------------ */
function Panel({ children, className = "", style = {} }) {
  return (
    <div className={"rounded-2xl " + className}
      style={{ background: T.panel, border: `1px solid ${T.line}`, ...style }}>
      {children}
    </div>
  );
}

function Etiqueta({ children }) {
  return <div className="text-xs uppercase tracking-widest mb-1" style={{ color: T.dim2 }}>{children}</div>;
}

function Boton({ children, onClick, tono = "suave", chico = false, activo = false, title }) {
  const paletas = {
    suave: { bg: activo ? T.panel3 : T.panel2, fg: T.text, bd: T.line },
    menta: { bg: "#2f4a45", fg: T.mint, bd: "#3f6157" },
    rosa: { bg: "#4a3440", fg: T.rose, bd: "#63424f" },
    lav: { bg: "#3b3660", fg: T.lav, bd: "#4d4779" },
  };
  const p = paletas[tono] || paletas.suave;
  return (
    <button onClick={onClick} title={title}
      className={"inline-flex items-center justify-center gap-2 rounded-xl transition-colors " + (chico ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2 text-sm")}
      style={{ background: p.bg, color: p.fg, border: `1px solid ${p.bd}` }}>
      {children}
    </button>
  );
}

function Campo({ label, children }) {
  return (
    <label className="block">
      <Etiqueta>{label}</Etiqueta>
      {children}
    </label>
  );
}

const inputStyle = {
  background: T.bg, color: T.text, border: `1px solid ${T.line}`,
  borderRadius: 12, padding: "9px 11px", width: "100%", outline: "none", fontSize: 14,
};

function Input(props) { return <input {...props} style={{ ...inputStyle, ...(props.style || {}) }} />; }
function Select({ children, ...p }) {
  return <select {...p} style={{ ...inputStyle, appearance: "none", ...(p.style || {}) }}>{children}</select>;
}

function Modal({ title, onClose, children, ancho = 520 }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ background: "rgba(16,19,30,.72)" }} onClick={onClose}>
      <div className="w-full my-6" style={{ maxWidth: ancho }} onClick={(e) => e.stopPropagation()}>
        <Panel className="p-5" style={{ background: T.panel }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg" style={{ color: T.text }}>{title}</h3>
            <button onClick={onClose} style={{ color: T.dim }}><X size={18} /></button>
          </div>
          {children}
        </Panel>
      </div>
    </div>
  );
}

function Anillo({ dias, color }) {
  const total = 31;
  const pct = Math.max(0, Math.min(1, 1 - Math.min(dias, total) / total));
  const r = 20, c = 2 * Math.PI * r;
  return (
    <svg width="52" height="52" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} fill="none" stroke={T.panel3} strokeWidth="5" />
      <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 26 26)" />
      <text x="26" y="24" textAnchor="middle" fontSize="13" fill={T.text} className="tabular-nums">{Math.max(0, dias)}</text>
      <text x="26" y="35" textAnchor="middle" fontSize="8" fill={T.dim2}>días</text>
    </svg>
  );
}

/* ================================ APP ================================ */
export default function App() {
  const [cargado, setCargado] = useState(false);
  const [movs, setMovs] = useState([]);
  const [tarjetas, setTarjetas] = useState([]);
  const [cats, setCats] = useState(CATS_DEFAULT);
  const [ajustes, setAjustes] = useState({ moneda: "$" });
  const [vista, setVista] = useState("resumen");
  const [periodo, setPeriodo] = useState({ modo: "mes", ym: ymHoy() });
  const [editMov, setEditMov] = useState(null);
  const [editCard, setEditCard] = useState(null);
  const [aviso, setAviso] = useState(null);

  /* ---- cargar / guardar ---- */
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(KEY);
        if (r && r.value) {
          const d = JSON.parse(r.value);
          if (Array.isArray(d.movs)) setMovs(d.movs);
          if (Array.isArray(d.tarjetas)) setTarjetas(d.tarjetas);
          if (Array.isArray(d.cats) && d.cats.length) setCats(d.cats);
          if (d.ajustes) setAjustes({ moneda: "$", ...d.ajustes });
        }
      } catch (e) { /* primera vez: arranca vacío */ }
      setCargado(true);
    })();
  }, []);

  const primerGuardado = useRef(true);
  useEffect(() => {
    if (!cargado) return;
    if (primerGuardado.current) { primerGuardado.current = false; }
    const t = setTimeout(() => {
      try {
        const p = window.storage.set(KEY, JSON.stringify({ movs, tarjetas, cats, ajustes }));
        if (p && p.catch) p.catch(() => { });
      } catch (e) { /* sin almacenamiento: se mantiene en memoria */ }
    }, 350);
    return () => clearTimeout(t);
  }, [movs, tarjetas, cats, ajustes, cargado]);

  const cur = ajustes.moneda || "$";
  const notificar = (t) => { setAviso(t); setTimeout(() => setAviso(null), 2200); };

  /* ---- filtro de periodo ---- */
  const enPeriodo = (t) => {
    if (periodo.modo === "todo") return true;
    if (periodo.modo === "mes") return t.fecha.startsWith(periodo.ym);
    return t.fecha >= (periodo.desde || "0000") && t.fecha <= (periodo.hasta || "9999");
  };
  const movsPeriodo = useMemo(() => movs.filter(enPeriodo), [movs, periodo]);

  const tot = useMemo(() => {
    const ing = movsPeriodo.filter((t) => t.tipo === "ingreso").reduce((s, t) => s + Number(t.monto), 0);
    const gas = movsPeriodo.filter((t) => t.tipo === "gasto").reduce((s, t) => s + Number(t.monto), 0);
    return { ing, gas, bal: ing - gas, ahorro: ing > 0 ? ((ing - gas) / ing) * 100 : 0 };
  }, [movsPeriodo]);

  /* ---- guardar movimiento ---- */
  const guardarMov = (m) => {
    setMovs((prev) => m.id && prev.some((x) => x.id === m.id)
      ? prev.map((x) => (x.id === m.id ? m : x))
      : [{ ...m, id: m.id || uid() }, ...prev]);
    setEditMov(null);
    notificar(m.id ? "Movimiento guardado" : "Movimiento agregado");
  };
  const borrarMov = (id) => { setMovs((p) => p.filter((x) => x.id !== id)); notificar("Movimiento eliminado"); };
  const guardarCard = (c) => {
    setTarjetas((prev) => c.id && prev.some((x) => x.id === c.id)
      ? prev.map((x) => (x.id === c.id ? c : x))
      : [...prev, { ...c, id: c.id || uid() }]);
    setEditCard(null);
    notificar("Tarjeta guardada");
  };
  const borrarCard = (id) => {
    setTarjetas((p) => p.filter((x) => x.id !== id));
    setMovs((p) => p.map((m) => (m.tarjetaId === id ? { ...m, tarjetaId: null, metodo: "Efectivo", cuotas: 1 } : m)));
    notificar("Tarjeta eliminada");
  };

  /* ---- exportar ---- */
  const bajar = (nombre, contenido, tipo) => {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = document.createElement("a");
    a.href = url; a.download = nombre; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  const exportarCSV = (lista) => {
    const cab = ["Fecha", "Tipo", "Monto", "Categoría", "Método", "Tarjeta", "Cuotas", "Nota"];
    const filas = lista.map((t) => [
      t.fecha, t.tipo, Number(t.monto).toFixed(2), t.categoria, t.metodo,
      tarjetas.find((c) => c.id === t.tarjetaId)?.nombre || "", t.cuotas || 1, (t.nota || "").replace(/"/g, "'"),
    ]);
    const csv = "\uFEFF" + [cab, ...filas].map((f) => f.map((v) => `"${v}"`).join(",")).join("\n");
    bajar(`movimientos-${hoyISO()}.csv`, csv, "text/csv;charset=utf-8");
    notificar("CSV descargado");
  };
  const exportarJSON = () => {
    bajar(`respaldo-finanzas-${hoyISO()}.json`, JSON.stringify({ movs, tarjetas, cats, ajustes }, null, 2), "application/json");
    notificar("Respaldo descargado");
  };
  const importarJSON = (file) => {
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (Array.isArray(d.movs)) setMovs(d.movs);
        if (Array.isArray(d.tarjetas)) setTarjetas(d.tarjetas);
        if (Array.isArray(d.cats) && d.cats.length) setCats(d.cats);
        if (d.ajustes) setAjustes({ moneda: "$", ...d.ajustes });
        notificar("Respaldo restaurado");
      } catch (e) { notificar("El archivo no es un respaldo válido"); }
    };
    fr.readAsText(file);
  };

  const tabs = [
    { id: "resumen", label: "Resumen", icon: LayoutGrid },
    { id: "movs", label: "Movimientos", icon: ListOrdered },
    { id: "tarjetas", label: "Tarjetas", icon: CreditCard },
    { id: "reportes", label: "Reportes", icon: PieIcon },
    { id: "ajustes", label: "Ajustes", icon: Settings },
  ];

  if (!cargado) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.dim }}>
        Cargando tus datos…
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.text, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-5">

        {/* encabezado */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ color: T.dim2 }}>Mis finanzas</div>
            <h1 className="text-2xl" style={{ color: T.text }}>
              {periodo.modo === "mes" ? ymLabel(periodo.ym) : periodo.modo === "todo" ? "Todo el historial" : "Rango elegido"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {periodo.modo === "mes" && (
              <div className="flex items-center rounded-xl" style={{ background: T.panel2, border: `1px solid ${T.line}` }}>
                <button className="px-2 py-2" style={{ color: T.dim }} onClick={() => setPeriodo({ ...periodo, ym: ymShift(periodo.ym, -1) })}><ChevronLeft size={16} /></button>
                <button className="px-2 py-2 text-xs" style={{ color: T.dim }} onClick={() => setPeriodo({ modo: "mes", ym: ymHoy() })}>Hoy</button>
                <button className="px-2 py-2" style={{ color: T.dim }} onClick={() => setPeriodo({ ...periodo, ym: ymShift(periodo.ym, 1) })}><ChevronRight size={16} /></button>
              </div>
            )}
            <Boton chico activo={periodo.modo === "mes"} onClick={() => setPeriodo({ modo: "mes", ym: periodo.ym || ymHoy() })}>Mes</Boton>
            <Boton chico activo={periodo.modo === "todo"} onClick={() => setPeriodo({ modo: "todo", ym: periodo.ym })}>Todo</Boton>
            <Boton tono="menta" onClick={() => setEditMov({ tipo: "gasto", fecha: hoyISO(), monto: "", categoria: "", metodo: "Efectivo", tarjetaId: null, cuotas: 1, nota: "" })}>
              <Plus size={16} /> Nuevo
            </Boton>
          </div>
        </div>

        {/* pestañas */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-5">
          {tabs.map((t) => {
            const Icon = t.icon, on = vista === t.id;
            return (
              <button key={t.id} onClick={() => setVista(t.id)}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm whitespace-nowrap"
                style={{ background: on ? T.panel2 : "transparent", color: on ? T.text : T.dim, border: `1px solid ${on ? T.line : "transparent"}` }}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        {vista === "resumen" && (
          <Resumen tot={tot} cur={cur} movs={movsPeriodo} todos={movs} cats={cats} tarjetas={tarjetas}
            onEditar={setEditMov} onIrTarjetas={() => setVista("tarjetas")} periodo={periodo} />
        )}
        {vista === "movs" && (
          <Movimientos movs={movsPeriodo} cats={cats} tarjetas={tarjetas} cur={cur}
            onEditar={setEditMov} onBorrar={borrarMov} onExportar={exportarCSV} />
        )}
        {vista === "tarjetas" && (
          <Tarjetas tarjetas={tarjetas} movs={movs} cur={cur} onNueva={() => setEditCard({ nombre: "", banco: "", limite: "", cierre: 1, pago: 15, color: T.lav })}
            onEditar={setEditCard} onBorrar={borrarCard} onNuevoGasto={(id) => setEditMov({ tipo: "gasto", fecha: hoyISO(), monto: "", categoria: "Compras", metodo: "Tarjeta de crédito", tarjetaId: id, cuotas: 1, nota: "" })} />
        )}
        {vista === "reportes" && <Reportes movs={movs} movsPeriodo={movsPeriodo} cats={cats} cur={cur} periodo={periodo} tarjetas={tarjetas} />}
        {vista === "ajustes" && (
          <Ajustes cats={cats} setCats={setCats} ajustes={ajustes} setAjustes={setAjustes}
            onExportarJSON={exportarJSON} onImportar={importarJSON}
            onReiniciar={() => { setMovs([]); setTarjetas([]); setCats(CATS_DEFAULT); notificar("Datos borrados"); }}
            totalMovs={movs.length} />
        )}
      </div>

      {editMov && (
        <FormMov mov={editMov} cats={cats} tarjetas={tarjetas} cur={cur}
          onGuardar={guardarMov} onCerrar={() => setEditMov(null)} />
      )}
      {editCard && <FormCard card={editCard} onGuardar={guardarCard} onCerrar={() => setEditCard(null)} />}

      {aviso && (
        <div className="fixed bottom-5 left-1/2 rounded-xl px-4 py-2.5 text-sm"
          style={{ transform: "translateX(-50%)", background: T.panel3, border: `1px solid ${T.line}`, color: T.text }}>
          {aviso}
        </div>
      )}
    </div>
  );
}

/* ============================== RESUMEN ============================== */
function Resumen({ tot, cur, movs, todos, cats, tarjetas, onEditar, onIrTarjetas, periodo }) {
  const porCat = useMemo(() => {
    const m = {};
    movs.filter((t) => t.tipo === "gasto").forEach((t) => { m[t.categoria] = (m[t.categoria] || 0) + Number(t.monto); });
    return Object.entries(m).map(([nombre, monto]) => ({
      nombre, monto, color: cats.find((c) => c.nombre === nombre)?.color || T.dim,
    })).sort((a, b) => b.monto - a.monto);
  }, [movs, cats]);
  const maxCat = porCat[0]?.monto || 1;
  const recientes = [...movs].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 6);

  const proximos = useMemo(() => tarjetas.map((c) => ({ card: c, r: resumenTarjeta(todos, c) }))
    .sort((a, b) => a.r.proximoVence - b.r.proximoVence), [tarjetas, todos]);

  return (
    <div className="grid gap-4">
      {/* tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Ingresos" valor={money(tot.ing, cur)} color={T.mint} icon={ArrowUpRight} />
        <Tile label="Gastos" valor={money(tot.gas, cur)} color={T.rose} icon={ArrowDownRight} />
        <Tile label="Balance" valor={money(tot.bal, cur)} color={tot.bal >= 0 ? T.sky : T.rose} icon={Wallet} />
        <Tile label="Tasa de ahorro" valor={`${tot.ahorro.toFixed(0)}%`} color={T.butter} icon={PieIcon}
          nota={tot.ing > 0 ? `de ${money(tot.ing, cur)} ingresados` : "sin ingresos registrados"} />
      </div>

      {/* firma: calendario de pagos */}
      <Panel className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm" style={{ color: T.dim }}>
            <Calendar size={15} /> Próximos pagos de tarjetas
          </div>
          <Boton chico onClick={onIrTarjetas}>Ver tarjetas</Boton>
        </div>
        {proximos.length === 0 ? (
          <Vacio texto="Todavía no registras tarjetas. Agrégalas para ver aquí cuándo toca pagar." />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {proximos.map(({ card, r }) => (
              <div key={card.id} className="flex items-center gap-3 rounded-xl p-3 shrink-0" style={{ background: T.panel2, border: `1px solid ${T.line}`, minWidth: 250 }}>
                <Anillo dias={r.dias} color={card.color || T.lav} />
                <div>
                  <div className="text-sm" style={{ color: T.text }}>{card.nombre}</div>
                  <div className="text-lg tabular-nums" style={{ color: card.color || T.lav }}>{money(r.aPagar, cur)}</div>
                  <div className="text-xs" style={{ color: T.dim2 }}>vence {fechaLarga(r.proximoVence)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* gastos por categoría */}
        <Panel className="p-4">
          <div className="text-sm mb-3" style={{ color: T.dim }}>Gastos por categoría</div>
          {porCat.length === 0 ? <Vacio texto="Sin gastos en este periodo." /> : (
            <div className="grid gap-2.5">
              {porCat.slice(0, 7).map((c) => (
                <div key={c.nombre}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: T.text }}>{c.nombre}</span>
                    <span className="tabular-nums" style={{ color: T.dim }}>{money(c.monto, cur)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: T.panel3 }}>
                    <div className="h-2 rounded-full" style={{ width: `${(c.monto / maxCat) * 100}%`, background: c.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        {/* recientes */}
        <Panel className="p-4">
          <div className="text-sm mb-3" style={{ color: T.dim }}>Últimos movimientos</div>
          {recientes.length === 0 ? <Vacio texto="Registra tu primer movimiento con el botón Nuevo." /> : (
            <div className="grid gap-1.5">
              {recientes.map((t) => (
                <button key={t.id} onClick={() => onEditar(t)}
                  className="flex items-center justify-between rounded-xl px-3 py-2 text-left"
                  style={{ background: T.panel2 }}>
                  <div className="min-w-0">
                    <div className="text-sm truncate" style={{ color: T.text }}>{t.nota || t.categoria}</div>
                    <div className="text-xs" style={{ color: T.dim2 }}>
                      {fechaCorta(t.fecha)} · {t.categoria}{t.tarjetaId ? " · " + (tarjetas.find((c) => c.id === t.tarjetaId)?.nombre || "tarjeta") : ""}
                    </div>
                  </div>
                  <div className="tabular-nums text-sm shrink-0 ml-3" style={{ color: t.tipo === "ingreso" ? T.mint : T.rose }}>
                    {t.tipo === "ingreso" ? "+" : "−"}{money(t.monto, cur)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Tile({ label, valor, color, icon: Icon, nota }) {
  return (
    <Panel className="p-4">
      <div className="flex items-start justify-between">
        <Etiqueta>{label}</Etiqueta>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="text-2xl tabular-nums" style={{ color }}>{valor}</div>
      {nota && <div className="text-xs mt-1" style={{ color: T.dim2 }}>{nota}</div>}
    </Panel>
  );
}

function Vacio({ texto }) {
  return <div className="rounded-xl px-4 py-6 text-sm text-center" style={{ background: T.panel2, color: T.dim2 }}>{texto}</div>;
}

/* ============================ MOVIMIENTOS ============================ */
function Movimientos({ movs, cats, tarjetas, cur, onEditar, onBorrar, onExportar }) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [cat, setCat] = useState("todas");
  const [tarjeta, setTarjeta] = useState("todas");
  const [orden, setOrden] = useState("fecha");
  const [confirmar, setConfirmar] = useState(null);

  const lista = useMemo(() => {
    let l = movs.filter((t) => {
      if (tipo !== "todos" && t.tipo !== tipo) return false;
      if (cat !== "todas" && t.categoria !== cat) return false;
      if (tarjeta !== "todas" && t.tarjetaId !== tarjeta) return false;
      if (q && !((t.nota || "") + t.categoria + t.metodo).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    l.sort((a, b) => orden === "monto" ? Number(b.monto) - Number(a.monto) : b.fecha.localeCompare(a.fecha));
    return l;
  }, [movs, q, tipo, cat, tarjeta, orden]);

  const suma = lista.reduce((s, t) => s + (t.tipo === "ingreso" ? Number(t.monto) : -Number(t.monto)), 0);

  return (
    <div className="grid gap-4">
      <Panel className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative">
            <Search size={15} style={{ color: T.dim2, position: "absolute", left: 10, top: 12 }} />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" style={{ paddingLeft: 32 }} />
          </div>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="todos">Todos los tipos</option>
            <option value="ingreso">Solo ingresos</option>
            <option value="gasto">Solo gastos</option>
          </Select>
          <Select value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="todas">Todas las categorías</option>
            {cats.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </Select>
          <Select value={tarjeta} onChange={(e) => setTarjeta(e.target.value)}>
            <option value="todas">Cualquier método</option>
            {tarjetas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </Select>
          <div className="flex gap-2">
            <Select value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="fecha">Por fecha</option>
              <option value="monto">Por monto</option>
            </Select>
            <Boton onClick={() => onExportar(lista)} title="Exportar a CSV"><Download size={15} /></Boton>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: T.dim2 }}>
          <span>{lista.length} movimiento{lista.length === 1 ? "" : "s"}</span>
          <span>Neto: <span className="tabular-nums" style={{ color: suma >= 0 ? T.mint : T.rose }}>{money(suma, cur)}</span></span>
          <span>Promedio: <span className="tabular-nums">{money(lista.length ? lista.reduce((s, t) => s + Number(t.monto), 0) / lista.length : 0, cur)}</span></span>
        </div>
      </Panel>

      {lista.length === 0 ? <Vacio texto="No hay movimientos que coincidan. Cambia los filtros o el mes." /> : (
        <Panel style={{ overflow: "hidden" }}>
          {lista.map((t, i) => {
            const c = cats.find((x) => x.nombre === t.categoria);
            const card = tarjetas.find((x) => x.id === t.tarjetaId);
            return (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3"
                style={{ borderTop: i ? `1px solid ${T.line}` : "none" }}>
                <div className="w-1.5 h-9 rounded-full shrink-0" style={{ background: c?.color || (t.tipo === "ingreso" ? T.mint : T.rose) }} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate" style={{ color: T.text }}>{t.nota || t.categoria}</div>
                  <div className="text-xs truncate" style={{ color: T.dim2 }}>
                    {fechaCorta(t.fecha)} · {t.categoria} · {t.metodo}
                    {card ? ` (${card.nombre}${Number(t.cuotas) > 1 ? `, ${t.cuotas} cuotas` : ""})` : ""}
                  </div>
                </div>
                <div className="tabular-nums text-sm shrink-0" style={{ color: t.tipo === "ingreso" ? T.mint : T.rose }}>
                  {t.tipo === "ingreso" ? "+" : "−"}{money(t.monto, cur)}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button className="p-2 rounded-lg" style={{ color: T.dim }} onClick={() => onEditar(t)}><Pencil size={15} /></button>
                  {confirmar === t.id ? (
                    <button className="p-2 rounded-lg" style={{ color: T.rose }} onClick={() => { onBorrar(t.id); setConfirmar(null); }} title="Confirmar"><Check size={15} /></button>
                  ) : (
                    <button className="p-2 rounded-lg" style={{ color: T.dim }} onClick={() => setConfirmar(t.id)}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>
            );
          })}
        </Panel>
      )}
      {confirmar && <div className="text-xs" style={{ color: T.rose }}>Toca el check para confirmar que quieres borrar.</div>}
    </div>
  );
}

/* ============================== TARJETAS ============================== */
function Tarjetas({ tarjetas, movs, cur, onNueva, onEditar, onBorrar, onNuevoGasto }) {
  const [abierta, setAbierta] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="text-sm" style={{ color: T.dim }}>
          {tarjetas.length} tarjeta{tarjetas.length === 1 ? "" : "s"} registrada{tarjetas.length === 1 ? "" : "s"}
        </div>
        <Boton tono="lav" onClick={onNueva}><Plus size={15} /> Agregar tarjeta</Boton>
      </div>

      {tarjetas.length === 0 && (
        <Vacio texto="Registra una tarjeta con su día de corte y su día de pago; la app calcula sola cuánto y cuándo pagas." />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {tarjetas.map((c) => {
          const r = resumenTarjeta(movs, c);
          const color = c.color || T.lav;
          const abierto = abierta === c.id;
          return (
            <Panel key={c.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base" style={{ color: T.text }}>{c.nombre}</div>
                  <div className="text-xs" style={{ color: T.dim2 }}>
                    {c.banco || "Sin banco"} · corte día {c.cierre} · pago día {c.pago}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 rounded-lg" style={{ color: T.dim }} onClick={() => onEditar(c)}><Pencil size={15} /></button>
                  {confirmar === c.id ? (
                    <button className="p-2 rounded-lg" style={{ color: T.rose }} onClick={() => { onBorrar(c.id); setConfirmar(null); }}><Check size={15} /></button>
                  ) : (
                    <button className="p-2 rounded-lg" style={{ color: T.dim }} onClick={() => setConfirmar(c.id)}><Trash2 size={15} /></button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 mt-4">
                <Anillo dias={r.dias} color={color} />
                <div>
                  <Etiqueta>A pagar el {fechaLarga(r.proximoVence)}</Etiqueta>
                  <div className="text-2xl tabular-nums" style={{ color }}>{money(r.aPagar, cur)}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <Mini label="Deuda total" valor={money(r.deuda, cur)} color={T.rose} />
                <Mini label="Corte actual" valor={money(r.totalCorteActual, cur)} color={T.butter} />
                <Mini label="Disponible" valor={r.disponible === null ? "—" : money(r.disponible, cur)} color={T.mint} />
              </div>

              {r.uso !== null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1" style={{ color: T.dim2 }}>
                    <span>Uso del límite</span><span className="tabular-nums">{r.uso.toFixed(0)}% de {money(r.limite, cur)}</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: T.panel3 }}>
                    <div className="h-2 rounded-full" style={{ width: `${r.uso}%`, background: r.uso > 80 ? T.rose : color }} />
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <Boton chico onClick={() => onNuevoGasto(c.id)}><Plus size={14} /> Cargar compra</Boton>
                <Boton chico onClick={() => setAbierta(abierto ? null : c.id)}>
                  {abierto ? "Ocultar" : "Ver"} cargos pendientes ({r.pendientes.length})
                </Boton>
              </div>

              {abierto && (
                <div className="mt-3 grid gap-1.5">
                  {r.pendientes.length === 0 ? <Vacio texto="Sin cargos pendientes. Vas al día." /> :
                    r.pendientes.map((g, i) => (
                      <div key={g.movId + "-" + i} className="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style={{ background: T.panel2 }}>
                        <div className="min-w-0">
                          <div className="truncate" style={{ color: T.text }}>{g.nombre}</div>
                          <div className="text-xs" style={{ color: T.dim2 }}>
                            {g.cuotas > 1 ? `cuota ${g.cuota}/${g.cuotas} · ` : ""}vence {fechaCorta(toISO(g.vence))}
                          </div>
                        </div>
                        <span className="tabular-nums" style={{ color: T.dim }}>{money(g.monto, cur)}</span>
                      </div>
                    ))}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Mini({ label, valor, color }) {
  return (
    <div className="rounded-xl px-2 py-2.5" style={{ background: T.panel2 }}>
      <div className="text-xs" style={{ color: T.dim2 }}>{label}</div>
      <div className="text-sm tabular-nums" style={{ color }}>{valor}</div>
    </div>
  );
}

/* ============================== REPORTES ============================== */
function Reportes({ movs, movsPeriodo, cats, cur, periodo, tarjetas }) {
  const meses = useMemo(() => {
    const base = periodo.modo === "mes" ? periodo.ym : ymHoy();
    const arr = [];
    for (let i = 11; i >= 0; i--) {
      const ym = ymShift(base, -i);
      const ing = movs.filter((t) => t.tipo === "ingreso" && t.fecha.startsWith(ym)).reduce((s, t) => s + Number(t.monto), 0);
      const gas = movs.filter((t) => t.tipo === "gasto" && t.fecha.startsWith(ym)).reduce((s, t) => s + Number(t.monto), 0);
      arr.push({ mes: ymLabel(ym).slice(0, 3), ym, Ingresos: ing, Gastos: gas, Balance: ing - gas });
    }
    return arr;
  }, [movs, periodo]);

  const dona = useMemo(() => {
    const m = {};
    movsPeriodo.filter((t) => t.tipo === "gasto").forEach((t) => { m[t.categoria] = (m[t.categoria] || 0) + Number(t.monto); });
    return Object.entries(m).map(([name, value], i) => ({
      name, value, color: cats.find((c) => c.nombre === name)?.color || PASTELS[i % PASTELS.length],
    })).sort((a, b) => b.value - a.value);
  }, [movsPeriodo, cats]);

  const gastos = movsPeriodo.filter((t) => t.tipo === "gasto");
  const totalGasto = gastos.reduce((s, t) => s + Number(t.monto), 0);
  const mayor = gastos.slice().sort((a, b) => Number(b.monto) - Number(a.monto))[0];
  const anio = Number(periodo.ym.slice(0, 4)), mesIdx = Number(periodo.ym.slice(5, 7)) - 1;
  const totalDelMes = diasEnMes(anio, mesIdx);
  const dias = periodo.modo === "mes"
    ? (periodo.ym === ymHoy() ? new Date().getDate() : totalDelMes)
    : Math.max(1, new Set(movsPeriodo.map((t) => t.fecha)).size);
  const promDia = totalGasto / Math.max(1, dias);
  const proyeccion = periodo.modo === "mes" ? promDia * totalDelMes : null;

  const porMetodo = useMemo(() => {
    const m = {};
    gastos.forEach((t) => { const k = t.tarjetaId ? (tarjetas.find((c) => c.id === t.tarjetaId)?.nombre || "Tarjeta") : t.metodo; m[k] = (m[k] || 0) + Number(t.monto); });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [gastos, tarjetas]);

  const tip = { background: T.panel3, border: `1px solid ${T.line}`, borderRadius: 12, color: T.text, fontSize: 12 };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Mini label="Gasto promedio por día" valor={money(promDia, cur)} color={T.butter} />
        <Mini label="Proyección del mes" valor={proyeccion === null ? "—" : money(proyeccion, cur)} color={T.peach} />
        <Mini label="Gasto más alto" valor={mayor ? money(mayor.monto, cur) : "—"} color={T.rose} />
        <Mini label="Categoría más costosa" valor={dona[0] ? dona[0].name : "—"} color={T.lav} />
      </div>

      <Panel className="p-4">
        <div className="text-sm mb-3" style={{ color: T.dim }}>Ingresos vs gastos · últimos 12 meses</div>
        <div style={{ width: "100%", height: 250 }}>
          <ResponsiveContainer>
            <BarChart data={meses} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={T.line} vertical={false} />
              <XAxis dataKey="mes" tick={{ fill: T.dim2, fontSize: 11 }} stroke={T.line} />
              <YAxis tick={{ fill: T.dim2, fontSize: 11 }} stroke={T.line} tickFormatter={(v) => moneyCorto(v, cur)} />
              <Tooltip contentStyle={tip} formatter={(v) => money(v, cur)} cursor={{ fill: "rgba(255,255,255,.04)" }} />
              <Legend wrapperStyle={{ fontSize: 12, color: T.dim }} />
              <Bar dataKey="Ingresos" fill={T.mint} radius={[6, 6, 0, 0]} />
              <Bar dataKey="Gastos" fill={T.rose} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <div className="text-sm mb-3" style={{ color: T.dim }}>Reparto de gastos del periodo</div>
          {dona.length === 0 ? <Vacio texto="Sin gastos en este periodo." /> : (
            <div style={{ width: "100%", height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={dona} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                    {dona.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={tip} formatter={(v) => money(v, cur)} />
                  <Legend wrapperStyle={{ fontSize: 11, color: T.dim }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel className="p-4">
          <div className="text-sm mb-3" style={{ color: T.dim }}>Cómo pagaste</div>
          {porMetodo.length === 0 ? <Vacio texto="Sin gastos en este periodo." /> : (
            <div className="grid gap-2.5">
              {porMetodo.map(([k, v], i) => (
                <div key={k}>
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: T.text }}>{k}</span>
                    <span className="tabular-nums" style={{ color: T.dim }}>{money(v, cur)} · {((v / totalGasto) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: T.panel3 }}>
                    <div className="h-2 rounded-full" style={{ width: `${(v / totalGasto) * 100}%`, background: PASTELS[i % PASTELS.length] }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* =============================== AJUSTES =============================== */
function Ajustes({ cats, setCats, ajustes, setAjustes, onExportarJSON, onImportar, onReiniciar, totalMovs }) {
  const [nueva, setNueva] = useState({ nombre: "", tipo: "gasto", color: T.lav });
  const [confirmar, setConfirmar] = useState(false);
  const fileRef = useRef(null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel className="p-4">
        <div className="text-sm mb-3" style={{ color: T.dim }}>Categorías</div>
        <div className="grid gap-1.5 mb-4">
          {cats.map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: T.panel2 }}>
              <input type="color" value={c.color} onChange={(e) => setCats(cats.map((x) => x.id === c.id ? { ...x, color: e.target.value } : x))}
                style={{ width: 26, height: 26, background: "none", border: "none", padding: 0 }} />
              <input value={c.nombre} onChange={(e) => setCats(cats.map((x) => x.id === c.id ? { ...x, nombre: e.target.value } : x))}
                style={{ ...inputStyle, background: "transparent", border: "none", padding: "2px 4px" }} />
              <span className="text-xs shrink-0" style={{ color: c.tipo === "ingreso" ? T.mint : T.rose }}>{c.tipo}</span>
              <button className="p-1.5" style={{ color: T.dim2 }} onClick={() => setCats(cats.filter((x) => x.id !== c.id))}><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "1fr auto auto" }}>
          <Input value={nueva.nombre} placeholder="Nueva categoría" onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} />
          <Select value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })} style={{ width: 110 }}>
            <option value="gasto">Gasto</option>
            <option value="ingreso">Ingreso</option>
          </Select>
          <Boton tono="menta" onClick={() => {
            if (!nueva.nombre.trim()) return;
            setCats([...cats, { ...nueva, id: uid(), color: PASTELS[cats.length % PASTELS.length] }]);
            setNueva({ nombre: "", tipo: "gasto", color: T.lav });
          }}><Plus size={15} /></Boton>
        </div>
      </Panel>

      <div className="grid gap-4">
        <Panel className="p-4">
          <div className="text-sm mb-3" style={{ color: T.dim }}>General</div>
          <Campo label="Símbolo de moneda">
            <Input value={ajustes.moneda} maxLength={4} onChange={(e) => setAjustes({ ...ajustes, moneda: e.target.value })} style={{ maxWidth: 120 }} />
          </Campo>
          <div className="text-xs mt-3" style={{ color: T.dim2 }}>
            Tus datos se guardan en este dispositivo automáticamente. Llevas {totalMovs} movimiento{totalMovs === 1 ? "" : "s"} registrado{totalMovs === 1 ? "" : "s"}.
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="text-sm mb-3" style={{ color: T.dim }}>Respaldo</div>
          <div className="flex flex-wrap gap-2">
            <Boton onClick={onExportarJSON}><Download size={15} /> Descargar respaldo</Boton>
            <Boton onClick={() => fileRef.current && fileRef.current.click()}><Upload size={15} /> Restaurar respaldo</Boton>
            <input ref={fileRef} type="file" accept="application/json" style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files && e.target.files[0]; if (f) onImportar(f); e.target.value = ""; }} />
          </div>
          <div className="text-xs mt-3" style={{ color: T.dim2 }}>
            El respaldo incluye movimientos, tarjetas y categorías. Guárdalo de vez en cuando.
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="text-sm mb-3" style={{ color: T.rose }}>Borrar todo</div>
          {confirmar ? (
            <div className="flex gap-2">
              <Boton tono="rosa" onClick={() => { onReiniciar(); setConfirmar(false); }}>Sí, borrar todo</Boton>
              <Boton onClick={() => setConfirmar(false)}>Cancelar</Boton>
            </div>
          ) : (
            <Boton tono="rosa" onClick={() => setConfirmar(true)}><RotateCcw size={15} /> Empezar de cero</Boton>
          )}
          <div className="text-xs mt-3" style={{ color: T.dim2 }}>Descarga primero un respaldo: esto no se puede deshacer.</div>
        </Panel>
      </div>
    </div>
  );
}

/* ========================== FORMULARIO MOVIMIENTO ========================== */
function FormMov({ mov, cats, tarjetas, cur, onGuardar, onCerrar }) {
  const [f, setF] = useState({
    tipo: "gasto", fecha: hoyISO(), monto: "", categoria: "", metodo: "Efectivo",
    tarjetaId: null, cuotas: 1, nota: "", ...mov,
  });
  const [error, setError] = useState("");
  const catsTipo = cats.filter((c) => c.tipo === f.tipo);
  const usaTarjeta = f.metodo === "Tarjeta de crédito";

  useEffect(() => {
    if (!catsTipo.some((c) => c.nombre === f.categoria)) {
      setF((v) => ({ ...v, categoria: catsTipo[0]?.nombre || "" }));
    }
  }, [f.tipo]);

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const guardar = () => {
    const monto = Number(String(f.monto).replace(",", "."));
    if (!monto || monto <= 0) return setError("Escribe un monto mayor a cero.");
    if (!f.categoria) return setError("Elige una categoría.");
    if (usaTarjeta && !f.tarjetaId) return setError("Elige la tarjeta con la que pagaste.");
    onGuardar({
      ...f, monto, cuotas: usaTarjeta ? Math.max(1, Number(f.cuotas) || 1) : 1,
      tarjetaId: usaTarjeta ? f.tarjetaId : null,
    });
  };

  const cuota = usaTarjeta && Number(f.cuotas) > 1 && Number(f.monto)
    ? Number(f.monto) / Number(f.cuotas) : null;

  return (
    <Modal title={mov.id ? "Editar movimiento" : "Nuevo movimiento"} onClose={onCerrar}>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-2">
          {["gasto", "ingreso"].map((t) => (
            <button key={t} onClick={() => set("tipo", t)} className="rounded-xl py-2.5 text-sm capitalize"
              style={{
                background: f.tipo === t ? (t === "gasto" ? "#4a3440" : "#2f4a45") : T.panel2,
                color: f.tipo === t ? (t === "gasto" ? T.rose : T.mint) : T.dim,
                border: `1px solid ${f.tipo === t ? (t === "gasto" ? "#63424f" : "#3f6157") : T.line}`,
              }}>{t}</button>
          ))}
        </div>

        <Campo label={`Monto (${cur})`}>
          <Input value={f.monto} inputMode="decimal" placeholder="0.00" autoFocus
            onChange={(e) => set("monto", e.target.value.replace(/[^\d.,]/g, ""))}
            style={{ fontSize: 22, fontVariantNumeric: "tabular-nums" }} />
        </Campo>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha"><Input type="date" value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Campo>
          <Campo label="Categoría">
            <Select value={f.categoria} onChange={(e) => set("categoria", e.target.value)}>
              {catsTipo.length === 0 && <option value="">Crea una categoría en Ajustes</option>}
              {catsTipo.map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
            </Select>
          </Campo>
        </div>

        <Campo label="Método de pago">
          <Select value={f.metodo} onChange={(e) => set("metodo", e.target.value)}>
            {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
        </Campo>

        {usaTarjeta && (
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tarjeta">
              <Select value={f.tarjetaId || ""} onChange={(e) => set("tarjetaId", e.target.value || null)}>
                <option value="">Elige una…</option>
                {tarjetas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </Campo>
            <Campo label="Cuotas">
              <Input type="number" min="1" max="48" value={f.cuotas} onChange={(e) => set("cuotas", e.target.value)} />
            </Campo>
          </div>
        )}
        {cuota && <div className="text-xs" style={{ color: T.butter }}>Quedan {f.cuotas} pagos de {money(cuota, cur)} cada uno.</div>}
        {usaTarjeta && tarjetas.length === 0 && (
          <div className="text-xs" style={{ color: T.butter }}>Aún no tienes tarjetas: agrégalas en la pestaña Tarjetas.</div>
        )}

        <Campo label="Nota (opcional)">
          <Input value={f.nota} placeholder="Ej. tenis nuevos, súper del sábado…" onChange={(e) => set("nota", e.target.value)} />
        </Campo>

        {error && <div className="text-xs" style={{ color: T.rose }}>{error}</div>}

        <div className="flex justify-end gap-2 mt-1">
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton tono="menta" onClick={guardar}><Check size={15} /> Guardar</Boton>
        </div>
      </div>
    </Modal>
  );
}

/* =========================== FORMULARIO TARJETA =========================== */
function FormCard({ card, onGuardar, onCerrar }) {
  const [f, setF] = useState({ nombre: "", banco: "", limite: "", cierre: 1, pago: 15, color: T.lav, ...card });
  const [error, setError] = useState("");
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const previo = useMemo(() => {
    const t = { cierre: Math.min(31, Math.max(1, Number(f.cierre) || 1)), pago: Math.min(31, Math.max(1, Number(f.pago) || 1)) };
    const corte = corteDe(t, new Date());
    return { corte, vence: vencimientoDe(t, corte) };
  }, [f.cierre, f.pago]);

  return (
    <Modal title={card.id ? "Editar tarjeta" : "Nueva tarjeta"} onClose={onCerrar} ancho={480}>
      <div className="grid gap-3">
        <Campo label="Nombre de la tarjeta">
          <Input value={f.nombre} autoFocus placeholder="Ej. Visa Oro" onChange={(e) => set("nombre", e.target.value)} />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Banco"><Input value={f.banco} placeholder="Opcional" onChange={(e) => set("banco", e.target.value)} /></Campo>
          <Campo label="Límite de crédito"><Input value={f.limite} inputMode="decimal" placeholder="Opcional"
            onChange={(e) => set("limite", e.target.value.replace(/[^\d.]/g, ""))} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Día de corte"><Input type="number" min="1" max="31" value={f.cierre} onChange={(e) => set("cierre", e.target.value)} /></Campo>
          <Campo label="Día límite de pago"><Input type="number" min="1" max="31" value={f.pago} onChange={(e) => set("pago", e.target.value)} /></Campo>
        </div>
        <Campo label="Color">
          <div className="flex gap-2 flex-wrap">
            {PASTELS.map((c) => (
              <button key={c} onClick={() => set("color", c)} className="rounded-full"
                style={{ width: 28, height: 28, background: c, border: f.color === c ? `2px solid ${T.text}` : "2px solid transparent" }} />
            ))}
          </div>
        </Campo>
        <div className="rounded-xl px-3 py-2.5 text-xs" style={{ background: T.panel2, color: T.dim }}>
          Con estos días, el corte en curso cierra el <span style={{ color: T.text }}>{fechaLarga(previo.corte)}</span> y se paga el <span style={{ color: T.text }}>{fechaLarga(previo.vence)}</span>.
        </div>
        {error && <div className="text-xs" style={{ color: T.rose }}>{error}</div>}
        <div className="flex justify-end gap-2 mt-1">
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton tono="lav" onClick={() => {
            if (!f.nombre.trim()) return setError("Ponle un nombre a la tarjeta.");
            onGuardar({
              ...f, nombre: f.nombre.trim(),
              cierre: Math.min(31, Math.max(1, Number(f.cierre) || 1)),
              pago: Math.min(31, Math.max(1, Number(f.pago) || 1)),
              limite: Number(f.limite) || 0,
            });
          }}><Check size={15} /> Guardar tarjeta</Boton>
        </div>
      </div>
    </Modal>
  );
}