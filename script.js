let animalesPendientes = [];
let animalesTotales = [];
let animalesFiltrados = [];
let actual = null;
let categoriasSeleccionadas = []; // Se llena dinámicamente al cargar las guardadas
let nivelRepasoActivo = 0;
let ultimoInput = "idComun";
let racha = 0;
let juegoIniciado = false;
let modoExamen = false;
let timer = null;
let tiempoRestante = 20;
let examenPendientes = [];
let respuestasExamen = [];
let numeroPregunta = 0;
let totalExamen = 60;
let falladas = [];
let siguienteImagen = null;
let siguienteAnimal = null;
let mostrarSoloDificiles = false;
let animalesDificiles = JSON.parse(localStorage.getItem('dificiles')) || [];

const NUM_PARTES = 5; // en cuántos exámenes se divide "Examen de todo"
let parteActual = null; // qué parte del examen global se está haciendo (null si es otro examen)
// Historial para poder retroceder
let historialVistos = [];
let posicionHistorial = -1;

// Control del paso continuo con Shift Derecho e Izquierdo
let shiftInterval = null;

const examenConfig = {
  planta: 5, mineral: 5, roca: 5, pajaro: 5, mamifero: 5, reptil: 5, pez: 5,
  hongo: 5, anfibio: 5, fosil: 5, invermarino: 5, inverterrestre: 5, alga: 5,
  herbacea: 0
};

// ▒▒▒ INICIALIZACIÓN DE LA APLICACIÓN ▒▒▒
document.addEventListener("DOMContentLoaded", () => {
  restaurarCategorias(); 
  actualizarBotonMarcarTodo();
  cargarCSV();
  
  rebindTodosListeners(); // Enlaza todos los elementos del DOM original

  // Listeners globales del documento (se enlazan una sola vez en window)
  let shiftTimeout = null; 

  document.addEventListener("keydown", e => {
    // SHIFT DERECHO: AVANZAR
    if (e.code === "ShiftRight") {
      e.preventDefault();
      if (!shiftTimeout && !shiftInterval) {
        mostrarAnimal(); 
        shiftTimeout = setTimeout(() => {
          shiftInterval = setInterval(() => {
            mostrarAnimal(); 
          }, 150);
        }, 450); 
      }
    }
    
    // SHIFT IZQUIERDO: RETROCEDER
    if (e.code === "ShiftLeft") {
      e.preventDefault();
      if (!shiftTimeout && !shiftInterval) {
        retrocederAnimal(); 
        shiftTimeout = setTimeout(() => {
          shiftInterval = setInterval(() => {
            retrocederAnimal(); 
          }, 150);
        }, 450); 
      }
    }

    if (e.code === "F2") marcarComoDificil(); 
  });

  document.addEventListener("keyup", e => {
    if (e.code === "ShiftRight" || e.code === "ShiftLeft") {
      clearTimeout(shiftTimeout);
      clearInterval(shiftInterval);
      shiftTimeout = null;
      shiftInterval = null;
    }
  });
});

// ▒▒▒ RE-ENLAZAR LISTENERS TRAS RECONSTRUIR EL DOM ▒▒▒
function rebindTodosListeners() {
  document.getElementById("marcarDificil").addEventListener("click", toggleDificiles);
  document.getElementById("modoExamen").addEventListener("click", toggleExamen);
  document.getElementById("btnExamenTodo").addEventListener("click", crearExamenTodo);
  renderizarPanelPartes();
    document.getElementById("btnFallos").addEventListener("click", mostrarFallos);
  iniciarToggleFalladas();
    document.getElementById("btnRepasarFallos").addEventListener("click", repasarFallos);
  actualizarBotonFallos();
  document.getElementById("btnMarcarTodo").addEventListener("click", marcarTodasCategorias);
    document.getElementById("btnHistorial").addEventListener("click", mostrarHistorial);
    document.getElementById("btnMasFalladas").addEventListener("click", mostrarMasFalladas);
    document.getElementById("btnCargar").addEventListener("click", cargarImagenesMarcadas);
  document.querySelectorAll("#categorias input[type='checkbox']").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      if (modoExamen) return;
      guardarCategorias();
      actualizarBotonMarcarTodo();
      aplicarFiltros();
    });
  });
  
  if (document.getElementById("buscador")) {
    document.getElementById("buscador").addEventListener("input", aplicarFiltros);
  }
  
  document.getElementById("btnRepaso1").addEventListener("click", () => seleccionarRepaso(1));
  document.getElementById("btnRepaso2").addEventListener("click", () => seleccionarRepaso(2));
  document.getElementById("btnRepaso3").addEventListener("click", () => seleccionarRepaso(3));

  document.getElementById("btnNuevo").addEventListener("click", mostrarAnimal);

  document.getElementById("idComun").addEventListener("focus", () => ultimoInput = "idComun");
  document.getElementById("idCientifico").addEventListener("focus", () => ultimoInput = "idCientifico");

  document.getElementById("idComun").addEventListener("keydown", e => { if (e.key === "Enter") resolverComun() });
  document.getElementById("idCientifico").addEventListener("keydown", e => { if (e.key === "Enter") resolverCientifico() });
}

// ▒▒▒ CARGAR CSV ▒▒▒
async function cargarCSV() {
  const res = await fetch("animales.csv");
  const txt = await res.text();
  const filas = txt.trim().split("\n").slice(1);

  animalesTotales = filas.map(f => {
    const [categoria, nombreComun, nombreCient, imagen, repaso, incluir] = f.split(",");
    return {
      categoria: categoria.trim(),
      nombreComun: nombreComun.trim(),
      nombreCient: nombreCient.trim(),
      imagen: imagen.trim(),
      repaso: parseInt(repaso.trim()) || 0,
      incluir: incluir.trim().toLowerCase() === "si"
    };
  });

  sincronizarPartes();       // mete las especies nuevas del CSV en los 5 exámenes
  renderizarPanelPartes();   // actualiza los botones con el número de especies

  filtrarAnimales();
  mostrarAnimal();
}

// ▒▒▒ GUARDAR Y RESTAURAR CASILLAS (PERSISTENCIA SEGURA) ▒▒▒
function guardarCategorias() {
  const checkboxes = document.querySelectorAll("#categorias input[type='checkbox']");
  // Escudo de seguridad: si no hay checkboxes en el DOM, no sobreescribimos con un array vacío
  if (checkboxes.length === 0) return;

  const marcadas = [...checkboxes].filter(c => c.checked).map(c => c.value);
  localStorage.setItem('categoriasGuardadas', JSON.stringify(marcadas));
}

function restaurarCategorias() {
  const guardadas = JSON.parse(localStorage.getItem('categoriasGuardadas'));
  if (guardadas && Array.isArray(guardadas)) {
    document.querySelectorAll("#categorias input[type='checkbox']").forEach(checkbox => {
      checkbox.checked = guardadas.includes(checkbox.value);
    });
  } else {
    // Primera ejecución: Marcamos por defecto las 4 iniciales
    const inicialesDefault = ["pajaro", "mamifero", "reptil", "pez"];
    document.querySelectorAll("#categorias input[type='checkbox']").forEach(checkbox => {
      checkbox.checked = inicialesDefault.includes(checkbox.value);
    });
    guardarCategorias();
  }
}

// ▒▒▒ ACTIVAR/DESACTIVAR CONTROLES (UX DE EXAMEN) ▒▒▒
function toggleControlesExamen(desactivar) {
  // Esconde/muestra lo que sobra en modo examen (lo controla el CSS)
  document.body.classList.toggle("en-examen", desactivar);

  document.querySelectorAll("#categorias input[type='checkbox']").forEach(cb => {
    cb.disabled = desactivar;
  });

  const botonesAfectados = [
    "btnMarcarTodo", "aplicarFiltros", "btnRepaso1", "btnRepaso2", "btnRepaso3", "marcarDificil", "btnExamenTodo", "btnFalladas"
  ];
  botonesAfectados.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.disabled = desactivar;
  });

  document.querySelectorAll("#panelPartes button").forEach(b => {
    b.disabled = desactivar;
  });

  const buscador = document.getElementById("buscador");
  if (buscador) buscador.disabled = desactivar;
}

// ▒▒▒ ACCIÓN DE MARCAR / DESMARCAR TODO (TOGGLE AUTOMÁTICO) ▒▒▒
function marcarTodasCategorias() {
  if (modoExamen) return;

  const checkboxes = document.querySelectorAll("#categorias input[type='checkbox']");
  // Si todos están marcados, desmarcamos todo. Si no, los marcamos todos.
  const todosMarcados = [...checkboxes].every(cb => cb.checked);

  checkboxes.forEach(checkbox => {
    checkbox.checked = !todosMarcados;
  });

  guardarCategorias();
  actualizarBotonMarcarTodo();
  aplicarFiltros();
}

function actualizarBotonMarcarTodo() {
  const btn = document.getElementById("btnMarcarTodo");
  if (!btn) return;
  
  const checkboxes = document.querySelectorAll("#categorias input[type='checkbox']");
  if (checkboxes.length === 0) return;

  const todosMarcados = [...checkboxes].every(cb => cb.checked);
  btn.textContent = todosMarcados ? "Desmarcar todo" : "Marcar todo";
}

// ▒▒▒ FILTROS ▒▒▒
function aplicarFiltros() {
  if (modoExamen) return; 

  actual = null;
  siguienteAnimal = null;
  siguienteImagen = null;
  
  historialVistos = [];
  posicionHistorial = -1;
  
  const fotoImg = document.getElementById("foto");
  if (fotoImg) fotoImg.src = ""; 
  
  guardarCategorias(); 
  filtrarAnimales();
  mostrarAnimal();
}

function filtrarAnimales() {
  const buscadorInput = document.getElementById("buscador");
  const textoBusqueda = buscadorInput ? buscadorInput.value.trim().toLowerCase() : "";

  let base = animalesTotales.filter(a => a.incluir);

  if (textoBusqueda !== "") {
    base = base.filter(a => 
      a.nombreComun.toLowerCase().includes(textoBusqueda) || 
      a.nombreCient.toLowerCase().includes(textoBusqueda)
    );
  } else {
    categoriasSeleccionadas = [...document.querySelectorAll("#categorias input:checked")].map(c => c.value);
    base = base.filter(a => categoriasSeleccionadas.includes(a.categoria));
  }

  if (mostrarSoloDificiles) {
    base = base.filter(a => animalesDificiles.includes(a.nombreCient));
  }

  if (nivelRepasoActivo > 0) {
    animalesFiltrados = base.filter(a => a.repaso === nivelRepasoActivo);
  } else {
    animalesFiltrados = base;
  }

  animalesPendientes = [...animalesFiltrados];
  actualizarContador();
}

// ▒▒▒ REPASO ▒▒▒
function seleccionarRepaso(nivel) {
  if (modoExamen) return;

  if (nivelRepasoActivo === nivel) {
    nivelRepasoActivo = 0;
  } else {
    nivelRepasoActivo = nivel;
  }

  for (let i = 1; i <= 3; i++) {
    const btn = document.getElementById(`btnRepaso${i}`);
    if (nivelRepasoActivo === i) {
      btn.textContent = `Repaso ${i}: ON`;
      btn.style.background = "#27ae60"; 
    } else {
      btn.textContent = `Repaso ${i}: OFF`;
      btn.style.background = ""; 
    }
  }
  aplicarFiltros(); 
}

// ▒▒▒ MOSTRAR ANIMAL (AVANZAR) ▒▒▒
function mostrarAnimal() {
  clearInterval(timer); 

  if (modoExamen && actual) {
    const comunUsuario = document.getElementById("idComun") ? document.getElementById("idComun").value.trim() : "";
    const cientUsuario = document.getElementById("idCientifico") ? document.getElementById("idCientifico").value.trim() : "";
    respuestasExamen.push({ animal: actual, comunUsuario, cientUsuario });
    registrarFalladaPersistente(actual, cientUsuario);
  }

  if (posicionHistorial < historialVistos.length - 1) {
    posicionHistorial++;
    actual = historialVistos[posicionHistorial];
    renderizarAnimalEnPantalla();
    return;
  }

  if (animalesPendientes.length === 0 && !siguienteAnimal) {
    if (modoExamen) finalizarExamen();
    return;
  }

  if (!siguienteAnimal) {
    const i = Math.floor(Math.random() * animalesPendientes.length);
    actual = animalesPendientes.splice(i, 1)[0];
    
    if (modoExamen && actual && actual.todasLasImagenes && !actual.imagenSeleccionadaExamen) {
      actual.imagenSeleccionadaExamen = actual.todasLasImagenes[Math.floor(Math.random() * actual.todasLasImagenes.length)];
    }
  } else {
    actual = siguienteAnimal;
    siguienteAnimal = null;
  }

  if (actual) {
    historialVistos.push(actual);
    posicionHistorial = historialVistos.length - 1;
  }

  renderizarAnimalEnPantalla();

  // ▒▒▒ PRECARGA DEL SIGUIENTE ANIMAL ▒▒▒
  if (animalesPendientes.length > 0) {
    const i = Math.floor(Math.random() * animalesPendientes.length);
    siguienteAnimal = animalesPendientes.splice(i, 1)[0];
    
    if (modoExamen && siguienteAnimal.todasLasImagenes && siguienteAnimal.todasLasImagenes.length > 0) {
      siguienteAnimal.imagenSeleccionadaExamen = siguienteAnimal.todasLasImagenes[Math.floor(Math.random() * siguienteAnimal.todasLasImagenes.length)];
    }

    siguienteImagen = new Image();
    const nombreArchivoSiguiente = (modoExamen && siguienteAnimal.imagenSeleccionadaExamen) ? siguienteAnimal.imagenSeleccionadaExamen : siguienteAnimal.imagen;
    siguienteImagen.src = "imagenes/" + nombreArchivoSiguiente;
  }
}

// ▒▒▒ RETROCEDER ANIMAL ▒▒▒
function retrocederAnimal() {
  if (modoExamen) return; 
  
  if (posicionHistorial > 0) {
    posicionHistorial--;
    actual = historialVistos[posicionHistorial];
    renderizarAnimalEnPantalla();
  }
}

function renderizarAnimalEnPantalla() {
  const fotoImg = document.getElementById("foto");
  if (fotoImg) {
    if (actual) {
      const nombreArchivo = (modoExamen && actual.imagenSeleccionadaExamen) ? actual.imagenSeleccionadaExamen : actual.imagen;
      fotoImg.src = "imagenes/" + nombreArchivo;
    } else {
      fotoImg.src = "";
    }
  }

  actualizarContador();

  if (modoExamen) {
    numeroPregunta++;
    const txtContador = document.getElementById("contadorExamen");
    if (txtContador) txtContador.textContent = numeroPregunta + " / " + totalExamen;
  }

  const buscadorInput = document.getElementById("buscador");
  const estaBuscando = buscadorInput && buscadorInput.value.trim() !== "";

  if (!estaBuscando) {
    if(document.getElementById("idComun")) document.getElementById("idComun").value = "";
    if(document.getElementById("idCientifico")) document.getElementById("idCientifico").value = "";
    if(document.getElementById("resueltoComun")) document.getElementById("resueltoComun").textContent = "";
    if(document.getElementById("resueltoCientifico")) document.getElementById("resueltoCientifico").textContent = "";
  }

  if (modoExamen) iniciarTimer();
  
  if (document.activeElement !== buscadorInput) {
    const inputAEnfocar = document.getElementById(ultimoInput);
    if (inputAEnfocar) {
      setTimeout(() => {
        if (document.activeElement !== buscadorInput) inputAEnfocar.focus();
      }, 20);
    }
  }
}

// ▒▒▒ R A C H A ▒▒▒
function aumentarRacha() {
  racha++;
  actualizarRachaUI();
}

// ▒▒▒ CONTADORES ▒▒▒
function resetearRacha() {
  racha = 0;
  actualizarRachaUI();
}

function actualizarContador() {
  if(document.getElementById("contador")) {
    document.getElementById("contador").textContent = "Animales restantes: " + animalesPendientes.length;
  }
}

// ▒▒▒ COMPROBACIONES ▒▒▒
function resolverComun() {
  if (!actual) return;
  const entrada = document.getElementById("idComun").value.trim().toLowerCase();
  const correcto = actual.nombreComun.trim().toLowerCase();
  const res = document.getElementById("resueltoComun");

  if (entrada === correcto) {
    if(res) { res.innerHTML = "¡Correcto!"; res.style.color = "green"; }
    aumentarRacha();
  } else {
    if(res) { res.innerHTML = `Estudia >:( <br><span style="color:#555;">Era: ${actual.nombreComun}</span>`; res.style.color = "red"; }
    resetearRacha();
  }
}

function actualizarRachaUI() {
  const rachaDiv = document.getElementById("racha");
  if (rachaDiv) rachaDiv.textContent = "🔥 Racha: " + racha;
}

function resolverCientifico() {
  if (!actual) return;
  clearInterval(timer);
  const entrada = document.getElementById("idCientifico").value.trim().toLowerCase();
  const correcto = actual.nombreCient.trim().toLowerCase();
  const res = document.getElementById("resueltoCientifico");

  if (entrada === correcto) {
    if(res) { res.innerHTML = "¡Correcto!"; res.style.color = "green"; }
    aumentarRacha();
  } else {
    if(res) { res.innerHTML = `Estudia >:( <br><span style="color:#555;">Era: ${actual.nombreCient}</span>`; res.style.color = "red"; }
    resetearRacha();
  }
}

function toggleExamen() {
  modoExamen = !modoExamen;
  const btn = document.getElementById("modoExamen");
  if(btn) btn.textContent = "Modo Examen: " + (modoExamen ? "ON" : "OFF");

  if (modoExamen) {
    iniciarExamen();
  } else {
    clearInterval(timer);
    toggleControlesExamen(false); // Reactivar controles de interfaz
    if(document.getElementById("timer")) document.getElementById("timer").textContent = "";
    if(document.getElementById("contadorExamen")) document.getElementById("contadorExamen").textContent = "";
    filtrarAnimales();
    mostrarAnimal();
  }
}

// ▒▒▒ LÓGICA DE EXAMEN ▒▒▒
function construirMapaEspecies() {
  let mapaEspecies = {};
  animalesTotales.forEach(a => {
    if (!a.incluir) return;

    if (!mapaEspecies[a.nombreCient]) {
      mapaEspecies[a.nombreCient] = {
        categoria: a.categoria,
        nombreComun: a.nombreComun,
        nombreCient: a.nombreCient,
        repaso: a.repaso,
        todasLasImagenes: [a.imagen]
      };
    } else {
      if (!mapaEspecies[a.nombreCient].todasLasImagenes.includes(a.imagen)) {
        mapaEspecies[a.nombreCient].todasLasImagenes.push(a.imagen);
      }
    }
  });
  return mapaEspecies;
}

function iniciarExamen(especiesForzadas, indiceParte) {
  parteActual = (indiceParte === undefined) ? null : indiceParte;
  toggleControlesExamen(true);

  examenPendientes = [];
  respuestasExamen = [];
  numeroPregunta = 0;

  actual = null;
  siguienteAnimal = null;
  siguienteImagen = null;
  historialVistos = [];
  posicionHistorial = -1;

  const mapaEspecies = construirMapaEspecies();
  let listaEspeciesUnicas = Object.values(mapaEspecies);

  if (especiesForzadas && especiesForzadas.length > 0) {
    // Examen de una parte de "Examen de todo": se usan exactamente esas especies
    examenPendientes = [...especiesForzadas];
  } else {
    const categoriesMarcadas = [...document.querySelectorAll("#categorias input:checked")].map(c => c.value);

    if (categoriesMarcadas.length > 0) {
      let candidatos = listaEspeciesUnicas.filter(e => categoriesMarcadas.includes(e.categoria));

      const maxPreguntas = categoriesMarcadas.length === 1 ? candidatos.length : Math.min(60, candidatos.length);

      for (let i = 0; i < maxPreguntas; i++) {
        const randIndex = Math.floor(Math.random() * candidatos.length);
        examenPendientes.push(candidatos[randIndex]);
        candidatos.splice(randIndex, 1);
      }
    } else {
      for (let categoria in examenConfig) {
        const cantidad = examenConfig[categoria];
        let candidatos = listaEspeciesUnicas.filter(e => e.categoria === categoria);
        let añadidos = 0;
        while (añadidos < cantidad && candidatos.length > 0) {
          const randIndex = Math.floor(Math.random() * candidatos.length);
          examenPendientes.push(candidatos[randIndex]);
          candidatos.splice(randIndex, 1);
          añadidos++;
        }
      }
    }
  }

  animalesPendientes = [];
  while (examenPendientes.length > 0) {
    const randIndex = Math.floor(Math.random() * examenPendientes.length);
    animalesPendientes.push(examenPendientes.splice(randIndex, 1)[0]);
  }

  totalExamen = animalesPendientes.length;
  mostrarAnimal();
}

function iniciarTimer() {
  clearInterval(timer);
  tiempoRestante = 20;
  const timerDiv = document.getElementById("timer");
  if(timerDiv) timerDiv.textContent = "Tiempo: " + tiempoRestante;

  timer = setInterval(() => {
    tiempoRestante--;
    if(timerDiv) timerDiv.textContent = "Tiempo: " + tiempoRestante;
    if (tiempoRestante <= 0) {
      clearInterval(timer);
      mostrarAnimal();
    }
  }, 1000);
}

function finalizarExamen() {
  clearInterval(timer);
  
  if (!window.htmlOriginalEstructura) {
    window.htmlOriginalEstructura = document.body.innerHTML;
  }

  let correctos = 0;
  let filas = "";

  falladas = []; 
  respuestasExamen.forEach(r => {
    const userCient = r.cientUsuario || "";
    const ok = userCient.trim().toLowerCase() === r.animal.nombreCient.trim().toLowerCase();

    if (ok) correctos++;
    if (!ok) falladas.push(r.animal);
    
    const imagenMostrada = r.animal.imagenSeleccionadaExamen || r.animal.imagen;

    filas += `
    <tr>
      <td><img src="imagenes/${imagenMostrada}" width="80"></td>
      <td>${userCient}</td>
      <td>${r.animal.nombreCient}</td>
      <td style="color:${ok ? "green" : "red"}">${ok ? "✔" : "✘"}</td>
    </tr>`;
  });

  // ▒▒▒ NOTA SOBRE 10 Y SU COLOR ▒▒▒
  const nota = totalExamen > 0 ? (correctos / totalExamen) * 10 : 0;
  const notaTexto = formatearNota(nota);
  const perfecto = totalExamen > 0 && correctos === totalExamen;
  const claseNota = claseDeNota(nota);

  // Si era una parte del examen global, guardamos su nota (pinta el botón y alimenta el historial)
  if (parteActual !== null) {
    const notasPartes = JSON.parse(localStorage.getItem('notasPartes')) || {};
    notasPartes[parteActual] = { clase: claseNota, nota: notaTexto, valor: nota, registrada: false };
    localStorage.setItem('notasPartes', JSON.stringify(notasPartes));
    parteActual = null;
    registrarHistorialSiCompleto();
  }

  let html = `
  <div class="resultado-cabecera">
    <div class="resultado-aciertos">Aciertos: ${correctos} / ${totalExamen}</div>
    <div class="resultado-nota ${claseNota}">
      ${perfecto ? "🏆 " : ""}${notaTexto} / 10${perfecto ? " ✨" : ""}
    </div>
  </div>`;

  html += "<h2>Resultados del examen</h2>";
  html += "<table border='1' style='margin:auto;border-collapse:collapse'>";
  html += "<tr><th>Imagen</th><th>Tu científico</th><th>Correcto</th><th>Resultado</th></tr>";
  html += filas;
  html += "</table>";
  html += `
  <br><br>
  <button id="btnRepetirFalladas" style="font-size:20px; padding:10px 20px; cursor:pointer; margin-right:20px;">
    Repetir falladas
  </button>
  <button onclick="location.reload()" style="font-size:20px; padding:10px 20px; cursor:pointer;">
    Volver al menú
  </button>`;
  
  document.body.innerHTML = html;
  window.scrollTo(0, 0);
  document.getElementById("btnRepetirFalladas").addEventListener("click", repetirFalladas);
}

function repetirFalladas() {
  if (falladas.length === 0) {
    alert("¡No fallaste ninguna! 🎉");
    return;
  }

  document.body.innerHTML = window.htmlOriginalEstructura;

  // Restaurar el estado limpio de las casillas
  restaurarCategorias();
  actualizarBotonMarcarTodo();

  // Re-enlazar todos los controladores de eventos
  rebindTodosListeners();

  // Bloquear nuevamente los controles porque seguimos dentro de una prueba (repetición)
  toggleControlesExamen(true);

  modoExamen = true;
  const btnExamen = document.getElementById("modoExamen");
  if(btnExamen) btnExamen.textContent = "Modo Examen: ON";

  examenPendientes = [...falladas];
  animalesPendientes = [];
  while (examenPendientes.length > 0) {
    const randIndex = Math.floor(Math.random() * examenPendientes.length);
    animalesPendientes.push(examenPendientes.splice(randIndex, 1)[0]);
  }

  respuestasExamen = [];
  numeroPregunta = 0;
  totalExamen = animalesPendientes.length;
  actual = null;
  siguienteAnimal = null;
  siguienteImagen = null;
  historialVistos = [];
  posicionHistorial = -1;

  mostrarAnimal();
}

// ▒▒▒ DIFICULTAD ▒▒▒
function toggleDificiles() {
  if (modoExamen) return;

  mostrarSoloDificiles = !mostrarSoloDificiles;
  const btn = document.getElementById("marcarDificil");
  
  if(btn) {
    btn.textContent = mostrarSoloDificiles ? "Ver todo" : "Practicar difíciles ⭐";
    btn.style.background = mostrarSoloDificiles ? "#e67e22" : "";
  }
  aplicarFiltros();
}

function marcarComoDificil() {
  if (!actual) return;
  
  if (!animalesDificiles.includes(actual.nombreCient)) {
    animalesDificiles.push(actual.nombreCient);
    localStorage.setItem('dificiles', JSON.stringify(animalesDificiles));
    alert("¡Marcado como difícil!");
  } else {
    animalesDificiles = animalesDificiles.filter(n => n !== actual.nombreCient);
    localStorage.setItem('dificiles', JSON.stringify(animalesDificiles));
    alert("¡Animal desmarcado!");
  }
}

// ▒▒▒ EXAMEN DE TODO (DIVIDIDO EN PARTES) ▒▒▒
function crearExamenTodo() {
  if (modoExamen) return;
  if (animalesTotales.length === 0) {
    alert("Todavía no se han cargado las especies, espera un segundo y vuelve a probar.");
    return;
  }

  if (localStorage.getItem('examenTodoPartes')) {
    const seguro = confirm("Ya tienes una división guardada. Si creas una NUEVA se perderán la anterior, las notas de las partes y los fallos guardados. ¿Continuar?");
    if (!seguro) return;
  }

  // Lista de nombres científicos únicos (cada uno cuenta como una especie)
  const nombres = [...new Set(animalesTotales.filter(a => a.incluir).map(a => a.nombreCient))];

  // Mezclar al azar
  for (let i = nombres.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nombres[i], nombres[j]] = [nombres[j], nombres[i]];
  }

  // Repartir en NUM_PARTES grupos del mismo tamaño (±1)
  const partes = Array.from({ length: NUM_PARTES }, () => []);
  nombres.forEach((n, i) => partes[i % NUM_PARTES].push(n));

  localStorage.setItem('examenTodoPartes', JSON.stringify(partes));
  localStorage.removeItem('notasPartes');
  localStorage.removeItem('bancoFallos');
  renderizarPanelPartes();
  actualizarBotonFallos();
}

// Mantiene la división guardada al día con el CSV:
// - las especies nuevas se añaden al examen que tenga menos
// - las que ya no estén en el CSV (o estén en "no") se quitan
function sincronizarPartes() {
  if (animalesTotales.length === 0) return;

  const guardado = JSON.parse(localStorage.getItem('examenTodoPartes'));
  if (!guardado) return;

  const vigentes = new Set(animalesTotales.filter(a => a.incluir).map(a => a.nombreCient));

  const partes = guardado.map(p => p.filter(n => vigentes.has(n)));

  const yaAsignadas = new Set(partes.flat());
  const nuevas = [...vigentes].filter(n => !yaAsignadas.has(n));

  // Mezclar las nuevas para que no se acumulen todas seguidas
  for (let i = nuevas.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nuevas[i], nuevas[j]] = [nuevas[j], nuevas[i]];
  }

  nuevas.forEach(n => {
    let menor = 0;
    for (let k = 1; k < partes.length; k++) {
      if (partes[k].length < partes[menor].length) menor = k;
    }
    partes[menor].push(n);
  });

  localStorage.setItem('examenTodoPartes', JSON.stringify(partes));
}

function renderizarPanelPartes() {
  const panel = document.getElementById("panelPartes");
  if (!panel) return;
  panel.innerHTML = "";

  const partes = JSON.parse(localStorage.getItem('examenTodoPartes'));
  if (!partes) return;

  const notasPartes = JSON.parse(localStorage.getItem('notasPartes')) || {};

  partes.forEach((nombres, i) => {
    const b = document.createElement("button");
    b.textContent = "Parte " + (i + 1) + " (" + nombres.length + ")";

    const n = notasPartes[i];
    if (n) {
      b.classList.add(n.clase);
      b.title = "Última nota: " + n.nota + " / 10";
    }

    b.addEventListener("click", () => iniciarExamenParte(i));
    panel.appendChild(b);
  });
}

function iniciarExamenParte(i) {
  if (modoExamen) return;

  const partes = JSON.parse(localStorage.getItem('examenTodoPartes'));
  if (!partes || !partes[i]) return;

  const mapa = construirMapaEspecies();
  const lista = partes[i].map(n => mapa[n]).filter(Boolean);
  if (lista.length === 0) return;

  modoExamen = true;
  const btn = document.getElementById("modoExamen");
  if (btn) btn.textContent = "Modo Examen: ON";

  iniciarExamen(lista, i);
}

// ▒▒▒ LISTA PERSISTENTE DE FALLADAS ▒▒▒
function actualizarBotonFalladas() {
  const btn = document.getElementById("btnFalladas");
  if (!btn) return;
  const lista = JSON.parse(localStorage.getItem('falladasPersistentes')) || [];
  btn.textContent = "Falladas (" + lista.length + ")";
}

function iniciarExamenFalladas() {
  if (modoExamen) return;

  const guardadas = JSON.parse(localStorage.getItem('falladasPersistentes')) || [];
  if (guardadas.length === 0) {
    alert("No tienes ninguna fallada guardada. ¡Bien! 🎉");
    return;
  }

  const mapa = construirMapaEspecies();
  const lista = guardadas.map(n => mapa[n]).filter(Boolean);
  if (lista.length === 0) {
    alert("Las falladas guardadas ya no están en el CSV.");
    return;
  }

  modoExamen = true;
  const btn = document.getElementById("modoExamen");
  if (btn) btn.textContent = "Modo Examen: ON";

  iniciarExamen(lista);
}

// Guarda o quita la especie del banco de fallos (solo si el interruptor está activado)
// Cuenta el intento en las estadísticas y, si el interruptor está activado, actualiza el banco de fallos
function registrarFalladaPersistente(animal, cientUsuario) {
  const ok = (cientUsuario || "").trim().toLowerCase() === animal.nombreCient.trim().toLowerCase();

  // Contadores a largo plazo: siempre, tenga o no el interruptor activado
  registrarEstadistica(animal.nombreCient, ok);

  if (localStorage.getItem('guardarFalladas') !== 'si') return;

  let lista = JSON.parse(localStorage.getItem('bancoFallos')) || [];

  if (ok) {
    // Solo sale del banco si en este examen no ha fallado ninguna foto de esa especie
    const falloEnEstaPrueba = respuestasExamen.some(r =>
      r.animal.nombreCient === animal.nombreCient &&
      (r.cientUsuario || "").trim().toLowerCase() !== animal.nombreCient.trim().toLowerCase()
    );
    if (!falloEnEstaPrueba) {
      lista = lista.filter(n => n !== animal.nombreCient);
    }
  } else if (!lista.includes(animal.nombreCient)) {
    lista.push(animal.nombreCient);
  }

  localStorage.setItem('bancoFallos', JSON.stringify(lista));
  actualizarBotonFallos();
}
  // ▒▒▒ CARGAR IMÁGENES DE LAS CATEGORÍAS MARCADAS ▒▒▒
function cargarImagenesMarcadas() {
  const marcadas = [...document.querySelectorAll("#categorias input:checked")].map(c => c.value);
  const lista = animalesTotales.filter(a => a.incluir && marcadas.includes(a.categoria));
  const btn = document.getElementById("btnCargar");

  if (lista.length === 0) {
    alert("Marca alguna categoría primero.");
    return;
  }

  let hechas = 0;
  btn.disabled = true;
  btn.textContent = "Cargando 0 / " + lista.length;

  lista.forEach(a => {
    const img = new Image();
    img.onload = img.onerror = () => {
      hechas++;
      btn.textContent = "Cargando " + hechas + " / " + lista.length;
      if (hechas === lista.length) {
        btn.textContent = "¡Cargadas!";
        btn.disabled = false;
        setTimeout(() => { btn.textContent = "Cargar imágenes"; }, 2000);
      }
    };
    img.src = "imagenes/" + a.imagen;
  });
}
// ▒▒▒ INTERRUPTOR "GUARDAR FALLADAS" Y GALERÍA DE FALLOS ▒▒▒
function iniciarToggleFalladas() {
  const chk = document.getElementById("chkGuardarFalladas");
  if (!chk) return;

  chk.checked = localStorage.getItem('guardarFalladas') === 'si';
  chk.addEventListener("change", () => {
    localStorage.setItem('guardarFalladas', chk.checked ? 'si' : 'no');
  });
}

function actualizarBotonFallos() {
  const btn = document.getElementById("btnFallos");
  if (!btn) return;
  const lista = JSON.parse(localStorage.getItem('bancoFallos')) || [];
  btn.textContent = "🔍 Fallos (" + lista.length + ")";
}

function mostrarFallos() {
  const lista = JSON.parse(localStorage.getItem('bancoFallos')) || [];
  const mapa = construirMapaEspecies();
  const especies = lista.map(n => mapa[n]).filter(Boolean);

  const antiguo = document.getElementById("overlayFallos");
  if (antiguo) antiguo.remove();

  const overlay = document.createElement("div");
  overlay.id = "overlayFallos";

  let html = `<div class="fallos-panel">
    <div class="fallos-cabecera">
      <h2>Fallos (${especies.length})</h2>
      <button id="btnCerrarFallos">Cerrar ✕</button>
    </div>`;

  if (especies.length === 0) {
    html += `<p class="fallos-vacio">No hay fallos guardados. Activa «Guardar falladas» antes de hacer un examen.</p>`;
  } else {
    html += `<div class="fallos-grid">`;
    especies.forEach(e => {
      html += `
      <div class="fallo-card">
        <img src="imagenes/${e.todasLasImagenes[0]}" loading="lazy">
        <div class="fallo-cient">${e.nombreCient}</div>
        <div class="fallo-comun">${e.nombreComun}</div>
      </div>`;
    });
    html += `</div>`;
  }
  html += `</div>`;

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  function cerrar() {
    overlay.remove();
    document.removeEventListener("keydown", alPulsarTecla);
  }
  function alPulsarTecla(e) {
    if (e.key === "Escape") cerrar();
  }

  document.getElementById("btnCerrarFallos").addEventListener("click", cerrar);
  overlay.addEventListener("click", e => { if (e.target === overlay) cerrar(); });
  document.addEventListener("keydown", alPulsarTecla);
}
// ▒▒▒ EXAMEN DE REPASO CON LOS FALLOS GUARDADOS ▒▒▒
function repasarFallos() {
  if (modoExamen) return;

  const guardadas = JSON.parse(localStorage.getItem('bancoFallos')) || [];
  if (guardadas.length === 0) {
    alert("No hay fallos guardados para repasar. Activa «Guardar falladas» y haz algún examen.");
    return;
  }

  // Una pregunta por cada foto de cada especie fallada
  const mapa = construirMapaEspecies();
  const lista = [];
  guardadas.forEach(n => {
    const e = mapa[n];
    if (!e) return;
    e.todasLasImagenes.forEach(img => {
      lista.push({ ...e, todasLasImagenes: [img] });
    });
  });

  if (lista.length === 0) {
    alert("Los fallos guardados ya no están en el CSV.");
    return;
  }

  modoExamen = true;
  const btn = document.getElementById("modoExamen");
  if (btn) btn.textContent = "Modo Examen: ON";

  iniciarExamen(lista);
}
// ▒▒▒ HISTORIAL DE EXÁMENES GLOBALES ▒▒▒
function formatearNota(valor) {
  return (Math.round(valor * 100) / 100).toString().replace(".", ",");
}

function claseDeNota(valor) {
  if (valor >= 10 - 1e-9) return "nota-oro";
  if (valor > 9.8) return "nota-verde-oscuro";
  if (valor >= 9) return "nota-verde-claro";
  if (valor >= 8.5) return "nota-naranja";
  return "nota-roja";
}

// Cuando las 5 partes tienen nota "sin registrar", se apunta una entrada nueva en el historial
function registrarHistorialSiCompleto() {
  const notasPartes = JSON.parse(localStorage.getItem('notasPartes')) || {};

  const partes = [];
  for (let i = 0; i < NUM_PARTES; i++) {
    const n = notasPartes[i];
    if (!n || n.registrada) return; // falta alguna parte, o ya se contó en otra entrada
    const valor = (typeof n.valor === "number")
      ? n.valor
      : parseFloat(String(n.nota).replace(",", "."));
    if (isNaN(valor)) return;
    partes.push(valor);
  }

  const media = partes.reduce((a, b) => a + b, 0) / partes.length;

  const historial = JSON.parse(localStorage.getItem('historialExamenes')) || [];
  historial.push({ fecha: Date.now(), partes: partes, media: media });
  localStorage.setItem('historialExamenes', JSON.stringify(historial));

  for (let i = 0; i < NUM_PARTES; i++) notasPartes[i].registrada = true;
  localStorage.setItem('notasPartes', JSON.stringify(notasPartes));
}

function mostrarHistorial() {
  const historial = JSON.parse(localStorage.getItem('historialExamenes')) || [];

  const antiguo = document.getElementById("overlayHistorial");
  if (antiguo) antiguo.remove();

  const overlay = document.createElement("div");
  overlay.id = "overlayHistorial";

  let html = `<div class="hist-panel">
    <div class="hist-cabecera">
      <h2>📊 Historial de exámenes globales (${historial.length})</h2>
      <button id="btnCerrarHistorial">Cerrar ✕</button>
    </div>`;

  if (historial.length === 0) {
    html += `<p class="hist-vacio">Todavía no has terminado ningún examen global completo. Cuando acabes las 5 partes aparecerá aquí.</p>`;
  } else {
    const numPartes = Math.max(...historial.map(h => h.partes.length));
    const columnas = `grid-template-columns: 110px 90px repeat(${numPartes}, 1fr)`;

    html += `<div class="hist-titulos" style="${columnas}"><span>Fecha</span><span>Media</span>`;
    for (let i = 1; i <= numPartes; i++) html += `<span>Parte ${i}</span>`;
    html += `</div>`;

    historial.slice().reverse().forEach(h => {
      const fecha = new Date(h.fecha);
      const fechaTexto = fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
      const horaTexto = fecha.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

      html += `<div class="hist-fila" style="${columnas}">
        <div class="hist-fecha" title="${horaTexto}">${fechaTexto}</div>
        <div class="hist-media ${claseDeNota(h.media)}">${formatearNota(h.media)}</div>`;
      h.partes.forEach((p, i) => {
        html += `<div class="hist-parte ${claseDeNota(p)}" title="Parte ${i + 1}">${formatearNota(p)}</div>`;
      });
      html += `</div>`;
    });
  }
  html += `</div>`;

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  function cerrar() {
    overlay.remove();
    document.removeEventListener("keydown", alPulsarTecla);
  }
  function alPulsarTecla(e) {
    if (e.key === "Escape") cerrar();
  }

  document.getElementById("btnCerrarHistorial").addEventListener("click", cerrar);
  overlay.addEventListener("click", e => { if (e.target === overlay) cerrar(); });
  document.addEventListener("keydown", alPulsarTecla);
}
// ▒▒▒ RANKING DE LAS ESPECIES MÁS FALLADAS (MEMORIA A LARGO PLAZO) ▒▒▒
function registrarEstadistica(nombreCient, ok) {
  const stats = JSON.parse(localStorage.getItem('estadisticasEspecies')) || {};
  if (!stats[nombreCient]) stats[nombreCient] = { vistas: 0, fallos: 0 };
  stats[nombreCient].vistas++;
  if (!ok) stats[nombreCient].fallos++;
  localStorage.setItem('estadisticasEspecies', JSON.stringify(stats));
}

function mostrarMasFalladas() {
  const LIMITE_RANKING = 50; // cuántas especies se enseñan (y entran en el examen) como máximo

  const stats = JSON.parse(localStorage.getItem('estadisticasEspecies')) || {};
  const mapa = construirMapaEspecies();

  const ranking = Object.keys(stats)
    .filter(n => stats[n].fallos > 0 && mapa[n])
    .map(n => ({
      especie: mapa[n],
      vistas: stats[n].vistas,
      fallos: stats[n].fallos,
      tasa: stats[n].fallos / stats[n].vistas
    }))
    .sort((a, b) => b.fallos - a.fallos || b.tasa - a.tasa || b.vistas - a.vistas);

  const mostrados = ranking.slice(0, LIMITE_RANKING);

  const antiguo = document.getElementById("overlayMasFalladas");
  if (antiguo) antiguo.remove();

  const overlay = document.createElement("div");
  overlay.id = "overlayMasFalladas";

  let titulo = "🎯 Más falladas";
  if (ranking.length > mostrados.length) {
    titulo += ` (las ${mostrados.length} primeras de ${ranking.length})`;
  } else {
    titulo += ` (${ranking.length})`;
  }

  let html = `<div class="hist-panel">
    <div class="hist-cabecera">
      <h2>${titulo}</h2>
      <div class="hist-acciones">
        <button id="btnExamenMasFalladas">📝 Examen de estas (${mostrados.length})</button>
        <button id="btnResetStats">Reiniciar contadores</button>
        <button id="btnCerrarMasFalladas">Cerrar ✕</button>
      </div>
    </div>`;

  if (mostrados.length === 0) {
    html += `<p class="hist-vacio">Todavía no hay datos. Se irá llenando con cada examen que hagas a partir de ahora.</p>`;
  } else {
    mostrados.forEach((r, i) => {
      const pct = Math.round(r.tasa * 100);
      const clasePct = pct >= 50 ? "rank-alta" : (pct >= 25 ? "rank-media" : "rank-baja");
      html += `
      <div class="rank-fila">
        <div class="rank-puesto">${i + 1}</div>
        <img src="imagenes/${r.especie.todasLasImagenes[0]}" loading="lazy">
        <div class="rank-nombres">
          <span class="rank-cient">${r.especie.nombreCient}</span>
          <span class="rank-comun">${r.especie.nombreComun}</span>
        </div>
        <div class="rank-cuenta">${r.fallos} / ${r.vistas}</div>
        <div class="rank-pct ${clasePct}">${pct}%</div>
      </div>`;
    });
  }
  html += `</div>`;

  overlay.innerHTML = html;
  document.body.appendChild(overlay);

  function cerrar() {
    overlay.remove();
    document.removeEventListener("keydown", alPulsarTecla);
  }
  function alPulsarTecla(e) {
    if (e.key === "Escape") cerrar();
  }

  document.getElementById("btnCerrarMasFalladas").addEventListener("click", cerrar);

  document.getElementById("btnExamenMasFalladas").addEventListener("click", () => {
    if (mostrados.length === 0) {
      alert("Todavía no hay datos para hacer un examen. Haz algún examen primero.");
      return;
    }
    cerrar();
    examenMasFalladas(mostrados.map(r => r.especie));
  });

  document.getElementById("btnResetStats").addEventListener("click", () => {
    if (confirm("¿Borrar todos los contadores de fallos? Empezarán de cero.")) {
      localStorage.removeItem('estadisticasEspecies');
      cerrar();
      mostrarMasFalladas();
    }
  });

  overlay.addEventListener("click", e => { if (e.target === overlay) cerrar(); });
  document.addEventListener("keydown", alPulsarTecla);
}

// ▒▒▒ EXAMEN CON LAS ESPECIES MÁS FALLADAS ▒▒▒
function examenMasFalladas(especies) {
  if (modoExamen) return;

  const USAR_TODAS_LAS_FOTOS = false; // true = una pregunta por cada foto de cada especie

  let lista = especies;
  if (USAR_TODAS_LAS_FOTOS) {
    lista = [];
    especies.forEach(e => {
      e.todasLasImagenes.forEach(img => {
        lista.push({ ...e, todasLasImagenes: [img] });
      });
    });
  }

  modoExamen = true;
  const btn = document.getElementById("modoExamen");
  if (btn) btn.textContent = "Modo Examen: ON";

  iniciarExamen(lista);
}