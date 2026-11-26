// ===== Estado y almacenamiento =====
const CLAVE = "calculadora-notas-v1";

let estado = {
  notaMax: 20,
  notaAprob: 10.5,
  cursos: [] // { id, nombre, criterios: [{ nombre, peso, nota }] }
};

function cargar() {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (guardado) estado = { ...estado, ...JSON.parse(guardado) };
  } catch (e) { /* si falla, se usa el estado por defecto */ }
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch (e) {}
}

const $ = (id) => document.getElementById(id);
const redondear = (n) => Math.round(n * 100) / 100;

// ===== Formulario de nuevo curso =====
function agregarFilaCriterio(nombre = "", peso = "") {
  const fila = document.createElement("div");
  fila.className = "criterio-fila";
  fila.innerHTML = `
    <input type="text" class="crit-nombre" placeholder="Ej. Examen parcial" value="${nombre}">
    <input type="number" class="crit-peso" placeholder="%" min="0" max="100" step="0.5" value="${peso}">
    <button type="button" class="quitar" title="Quitar">✕</button>
  `;
  fila.querySelector(".quitar").onclick = () => { fila.remove(); actualizarSuma(); };
  fila.querySelector(".crit-peso").oninput = actualizarSuma;
  $("criteriosForm").appendChild(fila);
  actualizarSuma();
}

function leerCriteriosForm() {
  return [...document.querySelectorAll("#criteriosForm .criterio-fila")].map((f) => ({
    nombre: f.querySelector(".crit-nombre").value.trim(),
    peso: parseFloat(f.querySelector(".crit-peso").value) || 0
  }));
}

function actualizarSuma() {
  const total = redondear(leerCriteriosForm().reduce((s, c) => s + c.peso, 0));
  const el = $("sumaPorcentajes");
  el.textContent = `Total: ${total}%` + (total === 100 ? " ✓" : " (debe sumar 100%)");
  el.className = "suma " + (total === 100 ? "ok" : "mal");
}

function limpiarFormulario() {
  $("cursoNombre").value = "";
  $("criteriosForm").innerHTML = "";
  $("errorCurso").textContent = "";
  agregarFilaCriterio();
  agregarFilaCriterio();
}

function guardarCurso() {
  const nombre = $("cursoNombre").value.trim();
  const criterios = leerCriteriosForm();
  const total = redondear(criterios.reduce((s, c) => s + c.peso, 0));
  const error = $("errorCurso");

  if (!nombre) return (error.textContent = "Escribe el nombre del curso.");
  if (criterios.length === 0) return (error.textContent = "Agrega al menos un criterio.");
  if (criterios.some((c) => !c.nombre)) return (error.textContent = "Todos los criterios necesitan un nombre.");
  if (criterios.some((c) => c.peso <= 0)) return (error.textContent = "Cada criterio debe tener un porcentaje mayor a 0.");
  if (total !== 100) return (error.textContent = `Los porcentajes suman ${total}%, deben sumar 100%.`);

  estado.cursos.push({
    id: Date.now(),
    nombre,
    criterios: criterios.map((c) => ({ ...c, nota: null }))
  });
  guardar();
  limpiarFormulario();
  render();
}

// ===== Cálculo =====
function calcular(curso) {
  const { notaMax, notaAprob } = estado;
  let acumulado = 0, pesoPendiente = 0, pesoRendido = 0;

  curso.criterios.forEach((c) => {
    if (c.nota === null || c.nota === "" || isNaN(c.nota)) pesoPendiente += c.peso;
    else { acumulado += c.nota * c.peso / 100; pesoRendido += c.peso; }
  });

  const res = { acumulado: redondear(acumulado), pesoPendiente, pesoRendido };

  if (pesoPendiente === 0) {
    res.tipo = acumulado >= notaAprob ? "aprobado" : "desaprobado";
    res.titulo = acumulado >= notaAprob
      ? `Aprobaste con ${res.acumulado}`
      : `Promedio final: ${res.acumulado}. No alcanzó el ${notaAprob}.`;
    res.detalle = "Ya tienes todas las notas registradas.";
    return res;
  }

  const necesario = (notaAprob - acumulado) / (pesoPendiente / 100);
  res.necesario = redondear(necesario);
  const maxPosible = redondear(acumulado + notaMax * pesoPendiente / 100);

  if (necesario <= 0) {
    res.tipo = "aprobado";
    res.titulo = "¡Ya aprobaste aunque saques 0 en lo que falta!";
    res.detalle = `Llevas ${res.acumulado} puntos acumulados.`;
  } else if (necesario > notaMax) {
    res.tipo = "desaprobado";
    res.titulo = `Necesitarías ${res.necesario}, más que la nota máxima (${notaMax}).`;
    res.detalle = `Lo máximo que podrías alcanzar es ${maxPosible}.`;
  } else {
    res.tipo = necesario > notaMax * 0.75 ? "dificil" : "pendiente";
    res.titulo = `Necesitas un promedio de ${res.necesario} en lo que falta`;
    res.detalle = `Llevas ${res.acumulado} puntos acumulados; falta rendir el ${pesoPendiente}% del curso ` +
      `(${redondear(notaAprob - acumulado)} puntos por conseguir).`;
  }
  return res;
}

// ===== Render de cursos =====
function render() {
  const cont = $("cursos");
  cont.innerHTML = "";
  $("sinCursos").style.display = estado.cursos.length ? "none" : "block";

  estado.cursos.forEach((curso) => {
    const card = document.createElement("div");
    card.className = "card";

    const filas = curso.criterios.map((c, i) => `
      <tr>
        <td>${c.nombre}</td>
        <td class="num">${c.peso}%</td>
        <td><input type="number" data-i="${i}" min="0" max="${estado.notaMax}" step="0.1"
             placeholder="Pendiente" value="${c.nota ?? ""}"></td>
      </tr>`).join("");

    card.innerHTML = `
      <div class="curso-cab">
        <h3>${curso.nombre}</h3>
        <button type="button" class="quitar" style="padding:6px 10px">Eliminar</button>
      </div>
      <table>
        <thead><tr><th>Criterio</th><th>Peso</th><th>Nota obtenida</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="resultado"></div>
    `;

    const pintarResultado = () => {
      const r = calcular(curso);
      const box = card.querySelector(".resultado");
      box.className = "resultado " + r.tipo;
      box.innerHTML = `<strong>${r.titulo}</strong><div class="detalle">${r.detalle}</div>`;
    };

    card.querySelectorAll("tbody input").forEach((inp) => {
      inp.oninput = () => {
        const v = inp.value === "" ? null : parseFloat(inp.value);
        curso.criterios[inp.dataset.i].nota = (v === null || isNaN(v)) ? null : v;
        guardar();
        pintarResultado();
      };
    });

    card.querySelector(".curso-cab .quitar").onclick = () => {
      if (!confirm(`¿Eliminar el curso "${curso.nombre}"?`)) return;
      estado.cursos = estado.cursos.filter((x) => x.id !== curso.id);
      guardar();
      render();
    };

    pintarResultado();
    cont.appendChild(card);
  });
}

// ===== Inicio =====
cargar();
$("notaMax").value = estado.notaMax;
$("notaAprob").value = estado.notaAprob;

$("notaMax").oninput = (e) => { estado.notaMax = parseFloat(e.target.value) || 20; guardar(); render(); };
$("notaAprob").oninput = (e) => { estado.notaAprob = parseFloat(e.target.value) || 0; guardar(); render(); };
$("btnAddCriterio").onclick = () => agregarFilaCriterio();
$("btnGuardarCurso").onclick = guardarCurso;
$("btnBorrarTodo").onclick = () => {
  if (!confirm("¿Borrar todos los cursos y notas?")) return;
  estado.cursos = [];
  guardar();
  render();
};

limpiarFormulario();
render();
