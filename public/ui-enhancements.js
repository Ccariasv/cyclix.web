(function () {
  const state = (window.__cyclixUiState ||= {
    supportExpanded: false,
    usersExpanded: false,
    analyticsExpanded: false,
    tripsExpanded: false,
    fleetExpanded: false,
    financeExpanded: false,
    registryStationOpen: false,
    registryBikeOpen: false,
    registryMapPickerOpen: false,
    supportFilters: {
      category: 'ALL',
      status: 'ALL',
      priority: 'ALL',
    },
    analyticsDatasets: [],
  })

  let enhanceScheduled = false
  const floatingWindowKeys = [
    'supportExpanded',
    'usersExpanded',
    'analyticsExpanded',
    'tripsExpanded',
    'fleetExpanded',
    'financeExpanded',
    'registryStationOpen',
    'registryBikeOpen',
    'registryMapPickerOpen',
  ]
  const registryMapPicker = {
    modal: null,
    mapContainer: null,
    addressNode: null,
    latitudeNode: null,
    longitudeNode: null,
    statusNode: null,
    applyButton: null,
    cancelButton: null,
    closeButton: null,
    map: null,
    tileLayer: null,
    marker: null,
    selection: null,
    readyPromise: null,
    pickButton: null,
    interactionMode: 'move',
    lastDragEndedAt: 0,
    lastSyncKey: null,
    lastSyncContainer: null,
  }
  const registryMapDefaultCenter = [14.9725, -89.5301]
  const registryMapDefaultZoom = 14

  function getSectionTitle() {
    return document.querySelector('.page-header h1')?.textContent?.trim().toLowerCase() ?? ''
  }

  function scheduleEnhance() {
    if (enhanceScheduled) {
      return
    }

    enhanceScheduled = true
    window.requestAnimationFrame(() => {
      enhanceScheduled = false
      enhanceCurrentSection()
    })
  }

  function setExpanded(key, value) {
    state[key] = value
  }

  function isExpanded(key) {
    return Boolean(state[key])
  }

  function hasOpenFloatingPanel() {
    return floatingWindowKeys.some((key) => isExpanded(key))
  }

  function closeFloatingPanels(exceptKey) {
    floatingWindowKeys.forEach((key) => {
      if (key !== exceptKey) {
        setExpanded(key, false)
      }
    })
  }

  function ensureCollapsiblePanel(panel, stateKey, windowTitle) {
    const head = panel.querySelector('.card-head')
    if (!head) {
      return null
    }

    panel.classList.add('cx-floating-filter-panel')

    let toggleButton = head.querySelector('.cx-filter-toggle')
    if (!toggleButton) {
      toggleButton = document.createElement('button')
      toggleButton.type = 'button'
      toggleButton.className = 'secondary-button cx-filter-toggle'
      toggleButton.addEventListener('click', () => {
        const nextExpanded = !isExpanded(stateKey)
        closeFloatingPanels(nextExpanded ? stateKey : null)
        setExpanded(stateKey, nextExpanded)
        updateCollapsiblePanel(panel, stateKey)
      })
      head.appendChild(toggleButton)
    }

    let body = panel.querySelector(':scope > .cx-collapsible-body')
    if (!body) {
      body = document.createElement('div')
      body.className = 'cx-collapsible-body'
      body.setAttribute('role', 'dialog')
      body.setAttribute('aria-modal', 'true')

      const windowHead = document.createElement('div')
      windowHead.className = 'cx-floating-window-head'
      windowHead.innerHTML = [
        `<strong class="cx-floating-window-title">${windowTitle}</strong>`,
        '<button type="button" class="secondary-button cx-floating-window-close" aria-label="Cerrar filtros"><span aria-hidden="true">×</span></button>',
      ].join('')
      body.appendChild(windowHead)

      windowHead.querySelector('.cx-floating-window-close')?.addEventListener('click', () => {
        setExpanded(stateKey, false)
        updateCollapsiblePanel(panel, stateKey)
      })

      const children = Array.from(panel.children)
      let afterHead = false
      children.forEach((child) => {
        if (child === head) {
          afterHead = true
          return
        }

        if (afterHead) {
          body.appendChild(child)
        }
      })

      panel.appendChild(body)
    }

    const titleNode = body.querySelector('.cx-floating-window-title')
    if (titleNode) {
      titleNode.textContent = windowTitle
    }

    let backdrop = panel.querySelector(':scope > .cx-floating-backdrop')
    if (!backdrop) {
      backdrop = document.createElement('button')
      backdrop.type = 'button'
      backdrop.className = 'cx-floating-backdrop'
      backdrop.hidden = true
      backdrop.setAttribute('aria-label', 'Cerrar filtros')
      backdrop.addEventListener('click', () => {
        setExpanded(stateKey, false)
        updateCollapsiblePanel(panel, stateKey)
      })
      panel.appendChild(backdrop)
    }

    updateCollapsiblePanel(panel, stateKey)
    return body
  }

  function updateCollapsiblePanel(panel, stateKey) {
    const body = panel.querySelector(':scope > .cx-collapsible-body')
    const backdrop = panel.querySelector(':scope > .cx-floating-backdrop')
    const toggleButton = panel.querySelector('.cx-filter-toggle')
    const expanded = isExpanded(stateKey)

    panel.classList.toggle('cx-floating-filter-panel--open', expanded)

    if (body) {
      body.hidden = !expanded
    }

    if (backdrop) {
      backdrop.hidden = !expanded
    }

    document.body.classList.toggle('cx-floating-lock', hasOpenFloatingPanel())

    if (toggleButton) {
      toggleButton.textContent = 'Filtros'
      toggleButton.setAttribute('aria-expanded', String(expanded))
      toggleButton.classList.toggle('cx-filter-toggle--active', expanded)
    }
  }

  function fillSelect(select, options, value) {
    const currentValue = value && options.some((option) => option.value === value) ? value : 'ALL'
    select.innerHTML = ''

    options.forEach((option) => {
      const element = document.createElement('option')
      element.value = option.value
      element.textContent = option.label
      select.appendChild(element)
    })

    select.value = currentValue
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right, 'es'))
  }

  function setFieldValue(field, value) {
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
      return
    }

    const prototype =
      field instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : field instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value')
    descriptor?.set?.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
    field.dispatchEvent(new Event('change', { bubbles: true }))
  }

  function getControlFieldByLabel(root, labelText) {
    const labels = Array.from(root.querySelectorAll('label.control'))
    const match = labels.find(
      (label) => label.querySelector('span')?.textContent?.trim().toLowerCase() === labelText.toLowerCase(),
    )
    return match?.querySelector('input, textarea, select') ?? null
  }

  function getRegistryStationCard() {
    return Array.from(document.querySelectorAll('.cx-registry-floating-card')).find((card) =>
      (card.querySelector('.card-head h2')?.textContent?.trim().toLowerCase() ?? '').includes('estacion'),
    )
  }

  function getRegistryStationFormFields() {
    const card = getRegistryStationCard()
    if (!card) {
      return null
    }

    return {
      card,
      address: getControlFieldByLabel(card, 'Direccion'),
      latitude: getControlFieldByLabel(card, 'Latitud'),
      longitude: getControlFieldByLabel(card, 'Longitud'),
    }
  }

  function getRegistryStationFormValues() {
    const fields = getRegistryStationFormFields()
    if (!fields) {
      return null
    }

    const latitude = Number.parseFloat(fields.latitude?.value ?? '')
    const longitude = Number.parseFloat(fields.longitude?.value ?? '')

    return {
      ...fields,
      latitudeValue: Number.isFinite(latitude) ? latitude : null,
      longitudeValue: Number.isFinite(longitude) ? longitude : null,
      addressValue: fields.address?.value?.trim() ?? '',
    }
  }

  function getRegistryStationSyncKey(values) {
    return [
      values.addressValue || '',
      typeof values.latitudeValue === 'number' ? values.latitudeValue.toFixed(6) : '',
      typeof values.longitudeValue === 'number' ? values.longitudeValue.toFixed(6) : '',
    ].join('|')
  }

  function updateRegistryMapSummary(selection) {
    if (!registryMapPicker.addressNode || !registryMapPicker.latitudeNode || !registryMapPicker.longitudeNode) {
      return
    }

    registryMapPicker.addressNode.textContent = selection?.address || 'Sin direccion seleccionada.'
    registryMapPicker.latitudeNode.textContent =
      typeof selection?.lat === 'number' ? selection.lat.toFixed(6) : 'Sin seleccionar'
    registryMapPicker.longitudeNode.textContent =
      typeof selection?.lng === 'number' ? selection.lng.toFixed(6) : 'Sin seleccionar'
    if (registryMapPicker.applyButton) {
      registryMapPicker.applyButton.disabled = !(typeof selection?.lat === 'number' && typeof selection?.lng === 'number')
    }
  }

  function setRegistryMapStatus(message) {
    if (registryMapPicker.statusNode) {
      registryMapPicker.statusNode.textContent = message
    }
  }

  function updateRegistryMapInteractionButtons() {
    registryMapPicker.pickButton?.classList.toggle('cx-map-mode-button--active', registryMapPicker.interactionMode === 'pick')
  }

  function setRegistryMapInteractionMode(mode) {
    registryMapPicker.interactionMode = mode === 'pick' ? 'pick' : 'move'
    updateRegistryMapInteractionButtons()
  }

  function applyRegistryStationSelectionToForm(selection) {
    const fields = getRegistryStationFormFields()
    if (!fields || !selection) {
      return
    }

    if (fields.address) {
      setFieldValue(
        fields.address,
        selection.address || `${selection.lat.toFixed(6)}, ${selection.lng.toFixed(6)}`,
      )
    }
    if (fields.latitude) {
      setFieldValue(fields.latitude, selection.lat.toFixed(6))
    }
    if (fields.longitude) {
      setFieldValue(fields.longitude, selection.lng.toFixed(6))
    }
  }

  async function reverseGeocodeRegistryPoint(lat, lng) {
    try {
      setRegistryMapStatus('Buscando direccion...')
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&accept-language=es`,
        {
          headers: {
            Accept: 'application/json',
          },
        },
      )
      const data = response.ok ? await response.json() : null
      const address = typeof data?.display_name === 'string' && data.display_name.trim() ? data.display_name.trim() : ''

      registryMapPicker.selection = {
        lat,
        lng,
        address,
      }
      updateRegistryMapSummary(registryMapPicker.selection)
      applyRegistryStationSelectionToForm(registryMapPicker.selection)
      setRegistryMapStatus(address ? 'Direccion encontrada.' : 'No se encontro una direccion exacta. Puedes usar las coordenadas.')
    } catch {
      registryMapPicker.selection = {
        lat,
        lng,
        address: '',
      }
      updateRegistryMapSummary(registryMapPicker.selection)
      applyRegistryStationSelectionToForm(registryMapPicker.selection)
      setRegistryMapStatus('No se pudo resolver la direccion. Puedes usar las coordenadas.')
    }
  }

  function updateRegistryMapMarker(lat, lng) {
    if (!registryMapPicker.map || !window.L) {
      return
    }

    if (!registryMapPicker.marker) {
      registryMapPicker.marker = window.L.circleMarker([lat, lng], {
        radius: 9,
        color: '#2a7bda',
        weight: 3,
        fillColor: '#47a2ff',
        fillOpacity: 0.32,
      }).addTo(registryMapPicker.map)
    } else {
      registryMapPicker.marker.setLatLng([lat, lng])
    }

    registryMapPicker.map.setView([lat, lng], Math.max(registryMapPicker.map.getZoom(), 15), { animate: false })
  }

  function clearRegistryMapMarker() {
    if (registryMapPicker.marker) {
      registryMapPicker.marker.remove()
      registryMapPicker.marker = null
    }
  }

  function ensureLeafletLoaded() {
    if (window.L) {
      return Promise.resolve(window.L)
    }

    if (registryMapPicker.readyPromise) {
      return registryMapPicker.readyPromise
    }

    registryMapPicker.readyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
      script.async = true
      script.onload = () => resolve(window.L)
      script.onerror = () => reject(new Error('No se pudo cargar Leaflet.'))
      document.head.appendChild(script)
    })

    return registryMapPicker.readyPromise
  }

  function ensureRegistryMapModal() {
    if (registryMapPicker.modal) {
      return registryMapPicker.modal
    }

    const modal = document.createElement('div')
    modal.className = 'registry-location-modal cx-registry-map-modal'
    modal.hidden = true
    modal.innerHTML = [
      '<button type="button" class="registry-location-modal__backdrop cx-registry-map-modal__backdrop" aria-label="Cerrar selector de mapa"></button>',
      '<section class="registry-location-modal__panel">',
      '<div class="registry-location-modal__header">',
      '<div>',
      '<h2>Seleccionar direccion</h2>',
      '<p>Haz clic en el mapa para fijar la ubicacion de la estacion.</p>',
      '</div>',
      '<button type="button" class="secondary-button cx-registry-map-modal__close" aria-label="Cerrar selector de mapa">&times;</button>',
      '</div>',
      '<div class="registry-location-modal__body">',
      '<div class="registry-location-modal__map">',
      '<div class="fleet-map">',
      '<div class="fleet-map__leaflet cx-registry-map-canvas"></div>',
      '<div class="fleet-map__guide"><strong>Seleccion de ubicacion</strong><p>Haz clic en cualquier punto del mapa para usarlo en Direccion, Latitud y Longitud.</p></div>',
      '</div>',
      '</div>',
      '<aside class="registry-location-modal__aside">',
      '<div class="fleet-note-card fleet-note-card--compact cx-registry-map-summary">',
      '<strong>Direccion</strong>',
      '<p class="cx-registry-map-address">Sin direccion seleccionada.</p>',
      '</div>',
      '<div class="fleet-detail-list">',
      '<div class="fleet-detail-list__row"><span>Latitud</span><strong class="cx-registry-map-latitude">Sin seleccionar</strong></div>',
      '<div class="fleet-detail-list__row"><span>Longitud</span><strong class="cx-registry-map-longitude">Sin seleccionar</strong></div>',
      '<div class="fleet-detail-list__row"><span>Estado</span><strong class="cx-registry-map-status">Selecciona un punto en el mapa.</strong></div>',
      '</div>',
      '<div class="button-row cx-registry-map-actions">',
      '<button type="button" class="secondary-button cx-registry-map-cancel">Cancelar</button>',
      '<button type="button" class="primary-button cx-registry-map-apply" disabled>Usar ubicacion</button>',
      '</div>',
      '</aside>',
      '</div>',
      '</section>',
    ].join('')

    document.body.appendChild(modal)

    registryMapPicker.modal = modal
    registryMapPicker.mapContainer = modal.querySelector('.cx-registry-map-canvas')
    registryMapPicker.addressNode = modal.querySelector('.cx-registry-map-address')
    registryMapPicker.latitudeNode = modal.querySelector('.cx-registry-map-latitude')
    registryMapPicker.longitudeNode = modal.querySelector('.cx-registry-map-longitude')
    registryMapPicker.statusNode = modal.querySelector('.cx-registry-map-status')
    registryMapPicker.applyButton = modal.querySelector('.cx-registry-map-apply')
    registryMapPicker.cancelButton = modal.querySelector('.cx-registry-map-cancel')
    registryMapPicker.closeButton = modal.querySelector('.cx-registry-map-modal__close')

    modal.querySelector('.cx-registry-map-modal__backdrop')?.addEventListener('click', () => {
      closeRegistryMapPicker(false)
    })
    registryMapPicker.cancelButton?.addEventListener('click', () => {
      closeRegistryMapPicker(false)
    })
    registryMapPicker.closeButton?.addEventListener('click', () => {
      closeRegistryMapPicker(false)
    })
    registryMapPicker.applyButton?.addEventListener('click', () => {
      closeRegistryMapPicker(true)
    })

    updateRegistryMapSummary(null)
    return modal
  }

  async function ensureRegistryMapReady() {
    const L = await ensureLeafletLoaded()

    if (!registryMapPicker.mapContainer) {
      throw new Error('No hay contenedor de mapa disponible.')
    }

    if (registryMapPicker.map && registryMapPicker.map.getContainer() !== registryMapPicker.mapContainer) {
      registryMapPicker.map.remove()
      registryMapPicker.map = null
      registryMapPicker.tileLayer = null
      registryMapPicker.marker = null
    }

    if (!registryMapPicker.map) {
      registryMapPicker.map = L.map(registryMapPicker.mapContainer, {
        center: registryMapDefaultCenter,
        zoom: registryMapDefaultZoom,
        dragging: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        keyboard: true,
        touchZoom: true,
        zoomControl: true,
      })
      registryMapPicker.tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(registryMapPicker.map)
      registryMapPicker.map.on('dragend', () => {
        registryMapPicker.lastDragEndedAt = Date.now()
      })
      registryMapPicker.map.on('zoomend', () => {
        registryMapPicker.lastDragEndedAt = Date.now()
      })
      registryMapPicker.map.on('click', (event) => {
        const lat = event.latlng.lat
        const lng = event.latlng.lng
        if (Date.now() - registryMapPicker.lastDragEndedAt < 220) {
          return
        }
        if (registryMapPicker.interactionMode !== 'pick') {
          setRegistryMapStatus('Puedes mover el mapa libremente. Usa "Seleccionar punto" cuando quieras fijar la ubicacion.')
          return
        }
        registryMapPicker.selection = { lat, lng, address: '' }
        updateRegistryMapMarker(lat, lng)
        updateRegistryMapSummary(registryMapPicker.selection)
        applyRegistryStationSelectionToForm(registryMapPicker.selection)
        setRegistryMapInteractionMode('move')
        setRegistryMapStatus('Punto seleccionado. Puedes seguir moviendo el mapa o volver a pulsar "Seleccionar punto" para cambiarlo.')
        reverseGeocodeRegistryPoint(lat, lng)
      })
    }

    return registryMapPicker.map
  }

  function ensureRegistryStationMapPanel(card) {
    let panel = card.querySelector('.cx-registry-station-map-panel')
    if (!panel) {
      panel = document.createElement('section')
      panel.className = 'cx-registry-station-map-panel'
      panel.innerHTML = [
        '<div class="cx-registry-station-map-grid">',
        '<div class="fleet-map cx-registry-station-map-shell">',
        '<div class="fleet-map__leaflet cx-registry-station-map-canvas"></div>',
        '</div>',
        '<aside class="cx-registry-station-map-summary">',
        '<div class="cx-registry-map-toolbar">',
        '<button type="button" class="secondary-button cx-map-mode-button cx-map-mode-button--pick">Seleccionar punto</button>',
        '</div>',
        '<div class="fleet-note-card fleet-note-card--compact cx-registry-map-summary">',
        '<strong>Direccion seleccionada</strong>',
        '<p class="cx-registry-map-address">Sin direccion seleccionada.</p>',
        '</div>',
        '<div class="fleet-detail-list">',
        '<div class="fleet-detail-list__row"><span>Latitud</span><strong class="cx-registry-map-latitude">Sin seleccionar</strong></div>',
        '<div class="fleet-detail-list__row"><span>Longitud</span><strong class="cx-registry-map-longitude">Sin seleccionar</strong></div>',
        '<div class="fleet-detail-list__row"><span>Estado</span><strong class="cx-registry-map-status">Selecciona un punto en el mapa.</strong></div>',
        '</div>',
        '</aside>',
        '</div>',
      ].join('')

      const buttonRow = card.querySelector('.button-row')
      const formGrid = card.querySelector('.form-grid')
      if (buttonRow) {
        buttonRow.parentElement?.insertBefore(panel, buttonRow)
      } else if (formGrid) {
        formGrid.parentElement?.appendChild(panel)
      }
    }

    registryMapPicker.modal = null
    registryMapPicker.mapContainer = panel.querySelector('.cx-registry-station-map-canvas')
    registryMapPicker.addressNode = panel.querySelector('.cx-registry-map-address')
    registryMapPicker.latitudeNode = panel.querySelector('.cx-registry-map-latitude')
    registryMapPicker.longitudeNode = panel.querySelector('.cx-registry-map-longitude')
    registryMapPicker.statusNode = panel.querySelector('.cx-registry-map-status')
    registryMapPicker.pickButton = panel.querySelector('.cx-map-mode-button--pick')
    registryMapPicker.applyButton = null
    registryMapPicker.cancelButton = null
    registryMapPicker.closeButton = null

    registryMapPicker.pickButton.onclick = () => {
      const nextMode = registryMapPicker.interactionMode === 'pick' ? 'move' : 'pick'
      setRegistryMapInteractionMode(nextMode)
      setRegistryMapStatus(
        nextMode === 'pick'
          ? 'Modo seleccion activo. Haz clic en el mapa para fijar la ubicacion.'
          : 'Puedes mover el mapa libremente. Pulsa "Seleccionar punto" cuando quieras fijar la ubicacion.',
      )
    }
    updateRegistryMapInteractionButtons()

    return panel
  }

  async function syncRegistryStationMap(card, forceView) {
    const panel = ensureRegistryStationMapPanel(card)
    const values = getRegistryStationFormValues()
    if (!panel || !values) {
      return
    }

    try {
      const map = await ensureRegistryMapReady()
      const syncKey = getRegistryStationSyncKey(values)
      const sameContainer = registryMapPicker.lastSyncContainer === registryMapPicker.mapContainer
      const sameValues = registryMapPicker.lastSyncKey === syncKey

      if (!forceView && sameContainer && sameValues) {
        map.invalidateSize()
        return
      }

      const hasCoordinates = typeof values.latitudeValue === 'number' && typeof values.longitudeValue === 'number'

      if (hasCoordinates) {
        registryMapPicker.selection = {
          lat: values.latitudeValue,
          lng: values.longitudeValue,
          address: values.addressValue,
        }
        updateRegistryMapSummary(registryMapPicker.selection)
        updateRegistryMapMarker(values.latitudeValue, values.longitudeValue)
        setRegistryMapStatus(
          values.addressValue
            ? 'Ubicacion actual cargada. Puedes ajustarla moviendote o con clic en el mapa.'
            : 'Ubicacion cargada. Puedes ajustarla moviendote o con clic en el mapa.',
        )
      } else {
        registryMapPicker.selection = null
        clearRegistryMapMarker()
        updateRegistryMapSummary(null)
        map.setView(registryMapDefaultCenter, registryMapDefaultZoom, { animate: false })
        setRegistryMapStatus('Mapa centrado en Zacapa. Muevelo libremente y haz clic para seleccionar la direccion de la estacion.')
      }

      setRegistryMapInteractionMode('move')
      registryMapPicker.lastSyncKey = syncKey
      registryMapPicker.lastSyncContainer = registryMapPicker.mapContainer
      map.invalidateSize()
    } catch {
      setRegistryMapStatus('No se pudo cargar el mapa.')
    }
  }

  async function openRegistryMapPicker() {
    const values = getRegistryStationFormValues()
    if (!values) {
      return
    }

    setExpanded('registryMapPickerOpen', true)
    document.body.classList.toggle('cx-floating-lock', true)

    const modal = ensureRegistryMapModal()
    modal.hidden = false

    try {
      const map = await ensureRegistryMapReady()
      const lat = values.latitudeValue ?? registryMapDefaultCenter[0]
      const lng = values.longitudeValue ?? registryMapDefaultCenter[1]
      registryMapPicker.selection = {
        lat,
        lng,
        address: values.addressValue,
      }
      updateRegistryMapSummary(registryMapPicker.selection)
      updateRegistryMapMarker(lat, lng)
      map.invalidateSize()
      if (!values.addressValue) {
        setRegistryMapStatus('Selecciona un punto en el mapa o usa la ubicacion actual.')
      } else {
        setRegistryMapStatus('Ubicacion actual cargada. Puedes ajustarla en el mapa.')
      }
    } catch {
      setRegistryMapStatus('No se pudo cargar el mapa.')
    }
  }

  function closeRegistryMapPicker(applySelection) {
    if (applySelection && registryMapPicker.selection) {
      const fields = getRegistryStationFormFields()
      if (fields) {
        if (fields.address) {
          setFieldValue(fields.address, registryMapPicker.selection.address || `${registryMapPicker.selection.lat.toFixed(6)}, ${registryMapPicker.selection.lng.toFixed(6)}`)
        }
        if (fields.latitude) {
          setFieldValue(fields.latitude, registryMapPicker.selection.lat.toFixed(6))
        }
        if (fields.longitude) {
          setFieldValue(fields.longitude, registryMapPicker.selection.lng.toFixed(6))
        }
      }
    }

    setExpanded('registryMapPickerOpen', false)
    if (registryMapPicker.modal) {
      registryMapPicker.modal.hidden = true
    }
    document.body.classList.toggle('cx-floating-lock', hasOpenFloatingPanel())
  }

  function ensureSupportFilters(panel, body) {
    let wrapper = panel.querySelector('.cx-support-filters')
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = 'cx-support-filters form-grid'
      wrapper.innerHTML = [
        '<label class="control cx-support-category-wrap">',
        '<span>Categoria</span>',
        '<select data-filter="category"></select>',
        '</label>',
        '<label class="control">',
        '<span>Estado</span>',
        '<select data-filter="status"></select>',
        '</label>',
        '<label class="control">',
        '<span>Prioridad</span>',
        '<select data-filter="priority"></select>',
        '</label>',
      ].join('')

      wrapper.querySelectorAll('select').forEach((select) => {
        select.addEventListener('change', () => {
          const filterName = select.getAttribute('data-filter')
          if (!filterName) {
            return
          }

          state.supportFilters[filterName] = select.value
          applySupportFilters()
        })
      })

      body.appendChild(wrapper)
    }

    return wrapper
  }

  function getActiveSupportMode(panel) {
    const active = Array.from(panel.querySelectorAll('.analytics-filter-chip--active')).find((button) =>
      button.textContent?.trim(),
    )
    const text = active?.textContent?.trim().toLowerCase() ?? ''
    return text.includes('reporte') ? 'reports' : 'tickets'
  }

  function parseSupportCard(card, mode) {
    const status =
      card.querySelector('.record-card__header .tag')?.textContent?.trim() ||
      card.querySelector('.tag')?.textContent?.trim() ||
      ''

    const metaSpans = Array.from(card.querySelectorAll('.record-card__meta span'))
    const prioritySpan = metaSpans.find((span) => span.textContent?.trim().toLowerCase().startsWith('prioridad:'))
    const priority = prioritySpan?.textContent?.split(':').slice(1).join(':').trim() || ''

    let category = ''
    if (mode === 'tickets') {
      const headerText = card.querySelector('.record-card__header p')?.textContent ?? ''
      const slashIndex = headerText.lastIndexOf('/')
      if (slashIndex >= 0) {
        category = headerText.slice(slashIndex + 1).trim()
      }
    }

    return {
      category,
      status,
      priority,
    }
  }

  function updateSupportFilterOptions(panel, wrapper) {
    const mode = getActiveSupportMode(panel)
    const cards = Array.from(document.querySelectorAll('.record-list .record-card'))
    const categoryWrap = wrapper.querySelector('.cx-support-category-wrap')
    const categorySelect = wrapper.querySelector('select[data-filter="category"]')
    const statusSelect = wrapper.querySelector('select[data-filter="status"]')
    const prioritySelect = wrapper.querySelector('select[data-filter="priority"]')

    if (!categorySelect || !statusSelect || !prioritySelect || !categoryWrap) {
      return
    }

    const parsedCards = cards.map((card) => parseSupportCard(card, mode))
    const categories = uniqueSorted(parsedCards.map((card) => card.category))
    const statuses = uniqueSorted(parsedCards.map((card) => card.status))
    const priorities = uniqueSorted(parsedCards.map((card) => card.priority))

    fillSelect(
      categorySelect,
      [{ value: 'ALL', label: 'Todas' }, ...categories.map((value) => ({ value, label: value }))],
      state.supportFilters.category,
    )
    fillSelect(
      statusSelect,
      [{ value: 'ALL', label: 'Todos' }, ...statuses.map((value) => ({ value, label: value }))],
      state.supportFilters.status,
    )
    fillSelect(
      prioritySelect,
      [{ value: 'ALL', label: 'Todas' }, ...priorities.map((value) => ({ value, label: value }))],
      state.supportFilters.priority,
    )

    categoryWrap.style.display = mode === 'tickets' ? '' : 'none'
    if (mode !== 'tickets') {
      state.supportFilters.category = 'ALL'
      categorySelect.value = 'ALL'
    }
  }

  function ensureSupportEmptyState() {
    let emptyState = document.querySelector('.cx-support-empty')
    if (!emptyState) {
      emptyState = document.createElement('section')
      emptyState.className = 'card detail-card cx-empty-note cx-support-empty'
      emptyState.innerHTML = '<div class="empty-state"><strong>Sin resultados</strong><p>Ajusta los filtros para ver registros.</p></div>'
      const anchor = document.querySelector('.record-list')?.closest('section')
      anchor?.parentElement?.insertBefore(emptyState, anchor.nextSibling)
    }

    return emptyState
  }

  function applySupportFilters() {
    const panel = document.querySelector('.analytics-filter-panel')
    if (!panel || getSectionTitle() !== 'soporte') {
      return
    }

    const mode = getActiveSupportMode(panel)
    const cards = Array.from(document.querySelectorAll('.record-list .record-card'))
    let visibleCount = 0

    cards.forEach((card) => {
      const parsed = parseSupportCard(card, mode)
      const matchCategory =
        mode !== 'tickets' ||
        state.supportFilters.category === 'ALL' ||
        parsed.category === state.supportFilters.category
      const matchStatus = state.supportFilters.status === 'ALL' || parsed.status === state.supportFilters.status
      const matchPriority =
        state.supportFilters.priority === 'ALL' || parsed.priority === state.supportFilters.priority
      const visible = matchCategory && matchStatus && matchPriority

      card.style.display = visible ? '' : 'none'
      if (visible) {
        visibleCount += 1
      }
    })

    const emptyState = ensureSupportEmptyState()
    emptyState.style.display = visibleCount === 0 && cards.length > 0 ? '' : 'none'
  }

  function enhanceSupport() {
    const panel = document.querySelector('.analytics-filter-panel')
    if (!panel) {
      return
    }

    const body = ensureCollapsiblePanel(panel, 'supportExpanded', 'Filtros de soporte')
    if (!body) {
      return
    }

    const wrapper = ensureSupportFilters(panel, body)
    updateSupportFilterOptions(panel, wrapper)
    applySupportFilters()
  }

  function enhanceUsers() {
    const panel = document.querySelector('.analytics-filter-panel')
    if (!panel) {
      return
    }

    ensureCollapsiblePanel(panel, 'usersExpanded', 'Filtros de usuarios')
  }

  function enhanceBasicFilterPanel(stateKey, windowTitle) {
    const panel = document.querySelector('.analytics-filter-panel')
    if (!panel) {
      return null
    }

    return ensureCollapsiblePanel(panel, stateKey, windowTitle)
  }

  function hideFleetRealtimeCards() {
    const cards = Array.from(document.querySelectorAll('article.card.detail-card, section.card.detail-card'))
    cards.forEach((card) => {
      const title = card.querySelector('.card-head h2')?.textContent?.trim().toLowerCase() ?? ''
      const content = card.textContent?.toLowerCase() ?? ''
      const shouldHide =
        title === 'eventos recibidos' ||
        title === 'historial persistido' ||
        content.includes('sin eventos websocket') ||
        content.includes('bicycle_location_history')

      if (shouldHide) {
        card.style.display = 'none'
      }
    })
  }

  function ensureAnalyticsDatasetFilters(body) {
    let wrapper = body.querySelector('.cx-analytics-datasets')
    if (!wrapper) {
      wrapper = document.createElement('div')
      wrapper.className = 'cx-analytics-datasets'
      wrapper.innerHTML = [
        '<span class="cx-analytics-datasets__label">Vista por modulo</span>',
        '<div class="cx-analytics-datasets__chips">',
        '<button type="button" class="analytics-filter-chip" data-dataset="stations">Estaciones</button>',
        '<button type="button" class="analytics-filter-chip" data-dataset="bikes">Bicicletas</button>',
        '<button type="button" class="analytics-filter-chip" data-dataset="users">Usuarios</button>',
        '<button type="button" class="analytics-filter-chip" data-dataset="maintenance">Mantenimientos</button>',
        '</div>',
      ].join('')

      wrapper.querySelectorAll('[data-dataset]').forEach((button) => {
        button.addEventListener('click', () => {
          const dataset = button.getAttribute('data-dataset')
          if (!dataset) {
            return
          }

          const current = new Set(state.analyticsDatasets)
          if (current.has(dataset)) {
            current.delete(dataset)
          } else {
            current.add(dataset)
          }

          state.analyticsDatasets = Array.from(current)
          renderAnalyticsDatasetButtons(wrapper)
          applyAnalyticsDatasetFilters()
        })
      })

      body.appendChild(wrapper)
    }

    renderAnalyticsDatasetButtons(wrapper)
    return wrapper
  }

  function renderAnalyticsDatasetButtons(wrapper) {
    const selected = new Set(state.analyticsDatasets)
    wrapper.querySelectorAll('[data-dataset]').forEach((button) => {
      const dataset = button.getAttribute('data-dataset')
      const active = dataset ? selected.has(dataset) : false
      button.classList.toggle('analytics-filter-chip--active', active)
    })
  }

  function getAnalyticsDatasetForTitle(title) {
    const normalized = title.trim().toLowerCase()
    if (normalized.includes('bicicletas')) {
      return 'bikes'
    }
    if (normalized.includes('usuarios')) {
      return 'users'
    }
    if (normalized.includes('manten')) {
      return 'maintenance'
    }
    if (normalized.includes('estaciones') || normalized.includes('viajes en el tiempo')) {
      return 'stations'
    }
    return null
  }

  function ensureAnalyticsEmptyState() {
    let emptyState = document.querySelector('.cx-analytics-empty')
    if (!emptyState) {
      emptyState = document.createElement('section')
      emptyState.className = 'card detail-card analytics-panel cx-empty-note cx-analytics-empty'
      emptyState.innerHTML =
        '<div class="empty-state"><strong>Sin resultados</strong><p>No hay paneles de analitica para los filtros seleccionados.</p></div>'

      const statsGrid = document.querySelector('.stats-grid')
      if (statsGrid?.parentElement) {
        statsGrid.parentElement.insertBefore(emptyState, statsGrid.nextSibling)
      }
    }

    return emptyState
  }

  function applyAnalyticsDatasetFilters() {
    if (getSectionTitle() !== 'analitica') {
      return
    }

    const selected = new Set(state.analyticsDatasets)
    const showAll = selected.size === 0
    const panels = Array.from(document.querySelectorAll('.analytics-grid .analytics-panel'))
    let visiblePanels = 0

    panels.forEach((panel) => {
      const title = panel.querySelector('.card-head h2')?.textContent?.trim() ?? ''
      const dataset = getAnalyticsDatasetForTitle(title)
      const visible = showAll || dataset === null || selected.has(dataset)
      panel.style.display = visible ? '' : 'none'

      if (visible) {
        visiblePanels += 1
      }
    })

    document.querySelectorAll('.analytics-grid').forEach((grid) => {
      const hasVisiblePanels = Array.from(grid.querySelectorAll('.analytics-panel')).some(
        (panel) => panel.style.display !== 'none',
      )
      grid.style.display = hasVisiblePanels ? '' : 'none'
    })

    const emptyState = ensureAnalyticsEmptyState()
    emptyState.style.display = !showAll && visiblePanels === 0 ? '' : 'none'
  }

  function enhanceAnalytics() {
    const body = enhanceBasicFilterPanel('analyticsExpanded', 'Filtros de analitica')
    if (!body) {
      return
    }

    ensureAnalyticsDatasetFilters(body)
    applyAnalyticsDatasetFilters()
  }

  function getRegistryFormSection() {
    return Array.from(document.querySelectorAll('section.content-grid')).find((section) => {
      const titles = Array.from(section.querySelectorAll('article .card-head h2')).map((node) =>
        node.textContent?.trim().toLowerCase() ?? '',
      )
      return (
        titles.some((title) => title.includes('estacion')) &&
        titles.some((title) => title.includes('bicicleta'))
      )
    })
  }

  function ensureRegistryCardOverlay(card, stateKey) {
    const head = card.querySelector('.card-head')
    if (!head) {
      return
    }

    card.classList.add('cx-registry-floating-card')

    if (stateKey === 'registryStationOpen') {
      card.classList.add('cx-registry-floating-card--station')
      ensureRegistryStationMapPanel(card)

      const mapTrigger = card.querySelector('.cx-registry-map-trigger')
      if (mapTrigger) {
        mapTrigger.remove()
      }
    }

    let closeButton = head.querySelector('.cx-registry-window-close')
    if (!closeButton) {
      closeButton = document.createElement('button')
      closeButton.type = 'button'
      closeButton.className = 'secondary-button cx-registry-window-close'
      closeButton.setAttribute('aria-label', 'Cerrar ventana')
      closeButton.innerHTML = '<span aria-hidden="true">×</span>'
      closeButton.addEventListener('click', () => {
        setExpanded(stateKey, false)
        updateRegistryCardOverlay(card, stateKey)
      })
      head.appendChild(closeButton)
    }

    let backdrop = card.parentElement?.querySelector(`:scope > .cx-registry-backdrop[data-modal="${stateKey}"]`)
    if (!backdrop && card.parentElement) {
      backdrop = document.createElement('button')
      backdrop.type = 'button'
      backdrop.className = 'cx-registry-backdrop'
      backdrop.dataset.modal = stateKey
      backdrop.hidden = true
      backdrop.setAttribute('aria-label', 'Cerrar ventana')
      backdrop.addEventListener('click', () => {
        setExpanded(stateKey, false)
        updateRegistryCardOverlay(card, stateKey)
      })
      card.parentElement.appendChild(backdrop)
    }

    updateRegistryCardOverlay(card, stateKey)
  }

  function updateRegistryCardOverlay(card, stateKey) {
    const expanded = isExpanded(stateKey)
    const backdrop = card.parentElement?.querySelector(`:scope > .cx-registry-backdrop[data-modal="${stateKey}"]`)
    const wasExpanded = card.classList.contains('cx-registry-floating-card--open')

    card.hidden = !expanded
    card.classList.toggle('cx-registry-floating-card--open', expanded)

    if (backdrop) {
      backdrop.hidden = !expanded
    }

    if (expanded && stateKey === 'registryStationOpen') {
      syncRegistryStationMap(card, !wasExpanded)
    }

    document.body.classList.toggle('cx-floating-lock', hasOpenFloatingPanel())
  }

  function enhanceRegistry() {
    const formSection = getRegistryFormSection()
    if (!formSection) {
      return
    }

    formSection.classList.add('cx-registry-forms-host')

    const cards = Array.from(formSection.querySelectorAll('article.card.detail-card'))
    const stationCard = cards.find((card) =>
      (card.querySelector('.card-head h2')?.textContent?.trim().toLowerCase() ?? '').includes('estacion'),
    )
    const bikeCard = cards.find((card) =>
      (card.querySelector('.card-head h2')?.textContent?.trim().toLowerCase() ?? '').includes('bicicleta'),
    )

    if (stationCard) {
      ensureRegistryCardOverlay(stationCard, 'registryStationOpen')
    }

    if (bikeCard) {
      ensureRegistryCardOverlay(bikeCard, 'registryBikeOpen')
    }
  }

  function handleRegistryTrigger(target) {
    if (getSectionTitle() !== 'registro') {
      return
    }

    const button = target.closest('button')
    if (!button) {
      return
    }

    const label = button.textContent?.trim().toLowerCase() ?? ''
    if (label === 'nueva estacion') {
      closeFloatingPanels('registryStationOpen')
      setExpanded('registryStationOpen', true)
      scheduleEnhance()
      return
    }

    if (label === 'nueva bicicleta') {
      closeFloatingPanels('registryBikeOpen')
      setExpanded('registryBikeOpen', true)
      scheduleEnhance()
      return
    }

    if (label !== 'editar') {
      return
    }

    const table = button.closest('table')
    const headerText = table?.querySelector('thead')?.textContent?.toLowerCase() ?? ''
    if (headerText.includes('capacidad')) {
      closeFloatingPanels('registryStationOpen')
      setExpanded('registryStationOpen', true)
      scheduleEnhance()
      return
    }

    if (headerText.includes('qr') || headerText.includes('marca/modelo')) {
      closeFloatingPanels('registryBikeOpen')
      setExpanded('registryBikeOpen', true)
      scheduleEnhance()
    }
  }

  function enhanceCurrentSection() {
    const section = getSectionTitle()

    if (section === 'soporte') {
      enhanceSupport()
      return
    }

    if (section === 'usuarios') {
      enhanceUsers()
      return
    }

    if (section === 'analitica') {
      enhanceAnalytics()
      return
    }

    if (section === 'viajes') {
      enhanceBasicFilterPanel('tripsExpanded', 'Filtros de viajes')
      return
    }

    if (section === 'gestion de flota') {
      enhanceBasicFilterPanel('fleetExpanded', 'Filtros de flota')
      hideFleetRealtimeCards()
      return
    }

    if (section === 'finanzas') {
      enhanceBasicFilterPanel('financeExpanded', 'Filtros de finanzas')
      return
    }

    if (section === 'registro') {
      enhanceRegistry()
    }
  }

  document.addEventListener('change', scheduleEnhance, true)
  document.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof Element) {
      handleRegistryTrigger(target)
    }
    scheduleEnhance()
  }, true)
  document.addEventListener('pointerdown', (event) => {
    const target = event.target
    if (!(target instanceof Element)) {
      return
    }

    if (
      target.closest('.cx-collapsible-body') ||
      target.closest('.cx-registry-floating-card') ||
      target.closest('.registry-location-modal')
    ) {
      return
    }

    closeFloatingPanels()
    scheduleEnhance()
  })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return
    }

    if (isExpanded('registryMapPickerOpen')) {
      closeRegistryMapPicker(false)
      scheduleEnhance()
      return
    }

    closeFloatingPanels()
    scheduleEnhance()
  })
  window.addEventListener('load', scheduleEnhance)
  document.addEventListener('DOMContentLoaded', scheduleEnhance)

  const observer = new MutationObserver(() => {
    scheduleEnhance()
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
})()
