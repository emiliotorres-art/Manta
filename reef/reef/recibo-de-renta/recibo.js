/* Motor del generador de recibos de renta (compartido por el hub y las variantes).
   Cada página puede definir window.RECIBO_PRESET = { uso, moral, abrirDetalles, abrirFiscal }
   para abrir el formulario preconfigurado a su caso. Todo ocurre en el navegador. */
(function () {
  const $ = id => document.getElementById(id);
  const pesos = n => (isFinite(n) ? n : 0).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  const num = id => { const v = parseFloat($(id).value); return isFinite(v) ? v : 0; };
  const esc = s => (s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  // ---------- Número a letras (MXN) ----------
  const UNI = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
  const DEC = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const CEN = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  function seccion(n) {
    if (n === 0) return '';
    if (n === 100) return 'CIEN';
    let t = '';
    const c = Math.floor(n / 100), dd = n % 100, d = Math.floor(dd / 10), u = dd % 10;
    if (c) t += CEN[c] + ' ';
    if (dd <= 20) t += UNI[dd];
    else if (dd < 30) t += 'VEINTI' + UNI[u];
    else { t += DEC[d]; if (u) t += ' Y ' + UNI[u]; }
    return t.trim();
  }
  function enteroALetras(n) {
    n = Math.floor(n);
    if (n === 0) return 'CERO';
    const millones = Math.floor(n / 1000000), miles = Math.floor((n % 1000000) / 1000), resto = n % 1000;
    let p = '';
    if (millones) p += (millones === 1 ? 'UN MILLÓN' : seccion(millones) + ' MILLONES') + ' ';
    if (miles) p += (miles === 1 ? 'MIL' : seccion(miles) + ' MIL') + ' ';
    if (resto) p += seccion(resto);
    return p.trim();
  }
  function montoALetra(m) {
    const ent = Math.floor(m), cent = Math.round((m - ent) * 100);
    return `${enteroALetras(ent)} PESOS ${String(cent).padStart(2, '0')}/100 M.N.`;
  }

  // ---------- Fechas ----------
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function fechaLarga(iso) {
    if (!iso) return '';
    const [a, m, d] = iso.split('-').map(Number);
    return `${d} de ${MESES[m - 1]} de ${a}`;
  }
  function periodoTexto(de, a) {
    if (!de && !a) return '';
    if (de && a) {
      const [ad, md, dd] = de.split('-').map(Number), [aa, ma, da] = a.split('-').map(Number);
      if (ad === aa && md === ma) return `del ${dd} al ${da} de ${MESES[md - 1]} de ${ad}`;
      if (ad === aa) return `del ${dd} de ${MESES[md - 1]} al ${da} de ${MESES[ma - 1]} de ${ad}`;
      return `del ${fechaLarga(de)} al ${fechaLarga(a)}`;
    }
    return de ? `desde el ${fechaLarga(de)}` : `hasta el ${fechaLarga(a)}`;
  }

  // ---------- Folio (memoria en este navegador) ----------
  if (!$('folio').value) $('folio').value = localStorage.getItem('reef_folio') || '1';

  // ---------- Memoria local (solo este navegador) ----------
  const MEM = { arr: 'reef_arrendador', inq: 'reef_inquilinos', dir: 'reef_direcciones' };
  function leerLista(k) { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } }
  function pintarDatalist(id, arr) { const dl = $(id); if (!dl) return; dl.innerHTML = arr.map(v => `<option value="${esc(v)}"></option>`).join(''); }
  function cargarMemoria() {
    try { const a = localStorage.getItem(MEM.arr); if (a && !$('arrendador').value) $('arrendador').value = a; } catch {}
    pintarDatalist('dlInquilinos', leerLista(MEM.inq));
    pintarDatalist('dlDirecciones', leerLista(MEM.dir));
  }
  function pushLista(k, v) {
    v = (v || '').trim(); if (!v) return;
    let a = leerLista(k).filter(x => x.toLowerCase() !== v.toLowerCase());
    a.unshift(v); a = a.slice(0, 20);
    try { localStorage.setItem(k, JSON.stringify(a)); } catch {}
  }
  function guardarMemoria() {
    try { if ($('arrendador').value.trim()) localStorage.setItem(MEM.arr, $('arrendador').value.trim()); } catch {}
    pushLista(MEM.inq, $('inquilino').value);
    pushLista(MEM.dir, $('direccion').value);
    cargarMemoria();
  }
  const btnBorrar = $('borrarMemoria');
  if (btnBorrar) btnBorrar.addEventListener('click', () => {
    [MEM.arr, MEM.inq, MEM.dir].forEach(k => { try { localStorage.removeItem(k); } catch {} });
    pintarDatalist('dlInquilinos', []); pintarDatalist('dlDirecciones', []);
    alert('Listo. Se borraron los nombres y direcciones guardados en este navegador.');
  });

  // ---------- Fiscal ----------
  function calcFiscal() {
    const base = num('monto');
    const comercial = $('uso').value === 'comercial';
    const moral = $('inqMoral').checked;
    const iva = comercial ? base * 0.16 : 0;
    const isrRet = moral ? base * 0.10 : 0;
    const ivaRet = moral ? iva * (2 / 3) : 0;
    const totalFactura = base + iva;
    const neto = totalFactura - isrRet - ivaRet;
    return { base, comercial, moral, iva, isrRet, ivaRet, totalFactura, neto };
  }

  // ---------- Render de la hoja ----------
  function render() {
    const saldoPend = num('saldoAnterior') - num('abono');
    if ($('saldoAnterior').value !== '' || $('abono').value !== '')
      $('saldoPendiente').value = saldoPend.toFixed(2);

    const monto = num('monto');
    $('montoLetra').textContent = monto > 0 ? montoALetra(monto) : '';

    const arr = esc($('arrendador').value) || '<span style="color:#94a3b8">Nombre del arrendador</span>';
    const inq = esc($('inquilino').value) || '<span style="color:#94a3b8">nombre del inquilino</span>';
    const dir = esc($('direccion').value);
    const per = periodoTexto($('periodoDe').value, $('periodoA').value);
    const fp = fechaLarga($('fechaPago').value);
    const folio = 'A' + String(parseInt($('folio').value, 10) || 1).padStart(4, '0');

    let filas = '', totalConc = 0;
    document.querySelectorAll('.concepto').forEach(c => {
      const v = parseFloat(c.value);
      if (isFinite(v) && v !== 0) { totalConc += v; filas += `<div style="display:flex;justify-content:space-between;gap:16px;padding:2px 0"><span>${c.dataset.concepto}</span><span style="white-space:nowrap">${pesos(v)}</span></div>`; }
    });
    const tablaConc = filas ? `
      <div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;gap:16px;border-bottom:1px solid #cbd5e1;padding-bottom:3px;font-size:11px;font-weight:600;color:#64748b"><span>Concepto</span><span>Importe</span></div>
        ${filas}
        <div style="display:flex;justify-content:space-between;gap:16px;border-top:1px solid #cbd5e1;margin-top:3px;padding-top:3px;font-weight:700"><span>Total</span><span style="white-space:nowrap">${pesos(totalConc)}</span></div>
      </div>` : '';

    const hayCascada = $('saldoAnterior').value !== '' || $('abono').value !== '';
    const cascada = hayCascada ? `
      <div style="margin-top:10px;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px">
        <div style="display:flex;justify-content:space-between"><span>Saldo anterior</span><span>${pesos(num('saldoAnterior'))}</span></div>
        <div style="display:flex;justify-content:space-between"><span>Abono</span><span>− ${pesos(num('abono'))}</span></div>
        <div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;margin-top:3px;padding-top:3px;font-weight:700"><span>Saldo pendiente</span><span>${pesos(num('saldoAnterior') - num('abono'))}</span></div>
      </div>` : '';

    const fpago = $('formaPago').value, ref = esc($('referencia').value);
    const lineaPago = fpago ? `<p style="margin-top:6px">Forma de pago: <b>${fpago}</b>${ref ? ` · Ref.: ${ref}` : ''}</p>` : '';

    const f = calcFiscal();
    const anyFiscal = $('predial').value || $('arrRfc').value || $('inqRfc').value || f.comercial || f.moral;
    let fiscalHtml = '';
    if (anyFiscal) {
      const filasF = [];
      if ($('predial').value) filasF.push(`<div style="display:flex;justify-content:space-between"><span>Cuenta predial</span><span>${esc($('predial').value)}</span></div>`);
      if ($('arrRfc').value) filasF.push(`<div style="display:flex;justify-content:space-between"><span>RFC arrendador</span><span>${esc($('arrRfc').value)}</span></div>`);
      if ($('inqRfc').value) filasF.push(`<div style="display:flex;justify-content:space-between"><span>RFC inquilino</span><span>${esc($('inqRfc').value)}</span></div>`);
      filasF.push(`<div style="display:flex;justify-content:space-between"><span>IVA (${f.comercial ? '16%' : 'exento'})</span><span>${pesos(f.iva)}</span></div>`);
      if (f.moral) {
        filasF.push(`<div style="display:flex;justify-content:space-between"><span>Retención ISR (10%)</span><span>− ${pesos(f.isrRet)}</span></div>`);
        filasF.push(`<div style="display:flex;justify-content:space-between"><span>Retención IVA (10.67%)</span><span>− ${pesos(f.ivaRet)}</span></div>`);
      }
      filasF.push(`<div style="display:flex;justify-content:space-between;border-top:1px solid #e2e8f0;margin-top:3px;padding-top:3px;font-weight:700"><span>Neto</span><span>${pesos(f.neto)}</span></div>`);
      fiscalHtml = `<div style="margin-top:12px;font-size:11px"><p style="font-weight:700;margin-bottom:2px">Datos fiscales (informativos)</p>${filasF.join('')}</div>`;
    }

    const firma = $('incFirma').checked ? `
      <div style="margin-top:44px;text-align:center">
        <div style="border-top:1px solid #0f172a;width:220px;margin:0 auto"></div>
        <p style="margin-top:4px">${esc($('arrendador').value) || 'Arrendador'}</p>
        <p style="font-size:11px;color:#64748b">Recibí conforme</p>
      </div>` : '';

    $('recibo').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <p style="font-size:16px;font-weight:700">${arr}</p>
          ${$('arrRfc').value ? `<p style="font-size:11px;color:#64748b">RFC: ${esc($('arrRfc').value)}</p>` : ''}
        </div>
        <div style="text-align:right;font-size:11px;color:#64748b">
          <p><b style="color:#0f172a">Folio ${esc(folio)}</b></p>
          <p>Expedido: ${fechaLarga(new Date().toISOString().slice(0, 10))}</p>
        </div>
      </div>
      <p style="text-align:center;font-weight:700;letter-spacing:.05em;margin:16px 0 12px">RECIBO DE PAGO</p>
      <p>Recibí de <b>${inq}</b> la cantidad de <b>${pesos(monto)}</b></p>
      <p style="font-size:11px;color:#475569;font-style:italic">(${montoALetra(monto)})</p>
      <p style="margin-top:8px">por concepto de renta${dir ? ` del inmueble ubicado en <b>${dir}</b>` : ''}${per ? `, correspondiente al periodo <b>${per}</b>` : ''}.</p>
      ${fp ? `<p style="margin-top:6px">Fecha de pago: <b>${fp}</b></p>` : ''}
      ${lineaPago}
      ${tablaConc}
      ${cascada}
      ${fiscalHtml}
      <p style="margin-top:14px;font-size:10px;color:#94a3b8">Este recibo no es comprobante fiscal (CFDI).</p>
      ${firma}
    `;
    $('fiscalResumen').innerHTML = `
      <div style="display:flex;justify-content:space-between"><span>Base (monto)</span><b>${pesos(f.base)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>IVA ${f.comercial ? '16%' : 'exento'}</span><b>${pesos(f.iva)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Retención ISR</span><b>${pesos(f.isrRet)}</b></div>
      <div style="display:flex;justify-content:space-between"><span>Retención IVA</span><b>${pesos(f.ivaRet)}</b></div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #cbd5e1;margin-top:4px;padding-top:4px"><span>Neto a recibir</span><b>${pesos(f.neto)}</b></div>`;
  }

  // ---------- Botón único: Generar recibo ----------
  function generar() {
    const monto = num('monto');
    if (!$('arrendador').value || !$('inquilino').value || monto <= 0) {
      alert('Para un recibo válido llena al menos: arrendador, inquilino y monto recibido.');
      return;
    }
    guardarMemoria();
    const folioTxt = 'A' + String(parseInt($('folio').value, 10) || 1).padStart(4, '0');
    const prev = document.title;
    document.title = 'recibo_' + folioTxt;
    window.print();
    document.title = prev;
  }

  // ---------- Eventos ----------
  $('form').addEventListener('input', render);
  $('form').addEventListener('change', render);
  $('btnGenerar').addEventListener('click', generar);
  window.addEventListener('afterprint', () => {
    const sig = (parseInt($('folio').value, 10) || 1) + 1;
    localStorage.setItem('reef_folio', String(sig));
    $('folio').value = sig;
    render();
  });
  $('limpiarDetalles').addEventListener('click', () => {
    ['formaPago', 'referencia', 'saldoAnterior', 'abono', 'saldoPendiente'].forEach(id => $(id).value = '');
    document.querySelectorAll('.concepto').forEach(c => c.value = '');
    $('incFirma').checked = true;
    render();
  });
  $('limpiarFiscal').addEventListener('click', () => {
    ['predial', 'arrRfc', 'arrRazon', 'arrRegimen', 'inqRfc', 'inqRazon', 'inqRegimen'].forEach(id => $(id).value = '');
    $('uso').value = 'habitacion';
    $('inqMoral').checked = false;
    render();
  });
  $('btnLimpiar').addEventListener('click', () => {
    $('form').querySelectorAll('input, select').forEach(el => {
      if (el.type === 'checkbox') el.checked = (el.id === 'incFirma');
      else if (el.id !== 'folio') el.value = '';
    });
    render();
  });

  // ---------- Preset por variante ----------
  // Las páginas de variante enlazan al hub con ?tipo=... para abrirlo preconfigurado.
  const PRESETS = {
    comercial:  { uso: 'comercial', abrirFiscal: true },
    parcial:    { abrirDetalles: true },
    habitacion: { uso: 'habitacion' }
  };
  const tipo = new URLSearchParams(location.search).get('tipo');
  const P = Object.assign({}, PRESETS[tipo] || {}, window.RECIBO_PRESET || {});
  if (P.uso && $('uso')) $('uso').value = P.uso;
  if (P.moral && $('inqMoral')) $('inqMoral').checked = true;
  if (P.abrirDetalles && $('detDetalles')) $('detDetalles').open = true;
  if (P.abrirFiscal && $('detFiscal')) $('detFiscal').open = true;

  cargarMemoria();
  render();
})();
