let watching = false
let makeVisibles = []
let previousDetailsHtml = ''

let timerId = 0
let alertId = 0
let refreshInterval = 15000

let theTable = {}
let hospitals = {}
let failedMsg = {}
let centresData = {}
let statesSelect = {}
let filtersHolder = {}
let filtersSideNav = {}
let districtsSelect = {}
let availabilityText = {}
let loadingIndicator = {}
let filterInclusions = {}
let lastRefreshedText = {}
let notFoundImgContainer = {}
let browserNotificationCheckbox = {}

let previousSessionCountMap = new Map()

async function onload()
{
    document.getElementById('diozz').setAttribute('href', relativePath)

    theTable = document.getElementById('table')
    failedMsg = document.getElementById('failed')
    hospitals = document.getElementById('hospitals')
    statesSelect = document.getElementById('states')
    districtsSelect = document.getElementById('districts')
    filtersHolder = document.getElementById('filtersHolder')
    availabilityText = document.getElementById('availability')
    filtersSideNav = document.getElementById('filtersSideNav')
    lastRefreshedText = document.getElementById('last-refreshed')
    loadingIndicator = document.getElementById('loadingIndicator')
    notFoundImgContainer = document.getElementById('notFoundImgContainer')

    //states = await buildAllDistrictIdMap()
    states = await buildAllDistrictIdMapLocal()

    filtersSideNav.style.height = (window.innerHeight - 40) + 'px'
    document.getElementById('tableContainer').style.minHeight = (window.innerHeight - 185) + 'px'
    window.onresize = function ()
    {
        filtersSideNav.style.height = (window.innerHeight - 40) + 'px'
        document.getElementById('tableContainer').style.minHeight = (window.innerHeight - 185) + 'px'
    };

    window.onpopstate = () =>
    {
        window.location.href = window.location.href
    }
    window.onbeforeunload = () =>
    {
        if (watching) return "Currently watching is in progress. Are you sure, you want to close?"
    }

    statesSelect.innerHTML = ''
    for (let i = 0; i < states.length; i++)
        statesSelect.innerHTML += '<option class="option" value="' + states[i].stateId + '">' + states[i].stateName + '</option>'

    statesSelect.addEventListener('change', () =>
    {
        resetFilter()
        fillDistricts()

        window.history.pushState('', '', relativePath + "?districtId=" + districtsSelect.value)
        previousDetailsHtml = ''
        previousSessionCountMap.clear()
        refreshTable(true)
    })

    districtsSelect.addEventListener('change', () =>
    {
        resetFilter()
        window.history.pushState('', '', relativePath + "?districtId=" + districtsSelect.value)
        previousDetailsHtml = ''
        previousSessionCountMap.clear()
        refreshTable(true)
    })

    browserNotificationCheckbox = document.getElementById('browserNotificationCheckbox')
    browserNotificationCheckbox.addEventListener('click', e =>
    {
        e.preventDefault()

        if (browserNotificationCheckbox.checked)
        {
            switch (Notification.permission)
            {
                case "default":
                    Notification.requestPermission().then(result =>
                    {
                        setTimeout(() => browserNotificationCheckbox.checked = result === "granted")
                        return true
                    })
                    break

                case "denied":
                    alert("Please grant the permission manually.")
                    break

                case "granted":
                    setTimeout(() => browserNotificationCheckbox.checked = true)
                    break
            }
        }
        else
            setTimeout(() => browserNotificationCheckbox.checked = false)
    })

    let qDistrictId = getParameterByName('districtId')
    if (qDistrictId)
    {
        if (!isNumeric(qDistrictId) || !states.find(s => s.districts.some(d => d.districtId == qDistrictId)))
        {
            window.location.replace(relativePath)
            return
        }

        let correspondingStateId = states.find(s => s.districts.some(d => d.districtId == qDistrictId)).stateId
        if (correspondingStateId)
        {
            statesSelect.value = correspondingStateId
            fillDistricts()
            districtsSelect.value = qDistrictId
        }
    }
    else
        fillDistricts()

    document.getElementById('watchHeading').innerHTML = "<div style='text-align:center;'>Get pinged when a new vaccination slot becomes available. Press <span class='pop'>Start Watching</span> to start monitoring <span class='pop'>" + districtsSelect.options[districtsSelect.selectedIndex].text + "</span> district.</div>"

    resetFilter()
    refreshTable(true)
}

function resetFilter()
{
    filterInclusions = { fee: [], dates: [], vaccines: [], ageGroups: [], slots: ["dose1", "dose2"] }
}

function fillDistricts()
{
    districtsSelect.innerHTML = ''
    let state = states.find(s => s.stateId == statesSelect.value)
    for (let i = 0; i < state.districts.length; i++)
        districtsSelect.innerHTML += '<option class="option" value="' + state.districts[i].districtId + '">' + state.districts[i].districtName + '</option>'
}

async function refreshTable(renderFilter)
{
    setVisibility("spinner")
    let watchDistrictId = districtsSelect.value
    let todayString = getTodayString()

    //let endpoint = relativePath + "assets/test.json"
    let endpoint = "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=" + watchDistrictId + "&date=" + todayString

    let response = ""
    try
    {
        response = await fetch(endpoint)
    }
    catch
    {
        setVisibility("failed")
        return
    }
    let responseAsJson = await response.json()

    centresData = JSON.parse(JSON.stringify(responseAsJson.centers))
    lastRefreshedText.innerHTML = "Last refreshed: <b>" + getTodayString(true) + "</b>"

    main(responseAsJson.centers, renderFilter)
}

function buildPreviousSessionCountMap()
{
    previousSessionCountMap.clear()

    centresData.map(center =>
        center.sessions.map(session =>
            previousSessionCountMap.set(session.session_id, { name: center.name, slots: session.available_capacity })
        )
    )
}

function main(data, renderFilter)
{
    data = applyExcemptionFilters(data)

    if (!data || data.length === 0)
    {
        previousDetailsHtml = ''
        previousSessionCountMap.clear()
        let currentDistrict = districtsSelect.options[districtsSelect.selectedIndex].text

        availabilityText.innerHTML = "<span class='nonEmph'> Vaccines available in <span class='emph'>0/0</span> vaccination centres.</span>"
        setVisibility("notFound")

        if (!watching) document.getElementById('watchHeading').innerHTML = "<div style='text-align:center;'>Get pinged when a new vaccination slot becomes available. Press <span class='pop'>Start Watching</span> to start monitoring <span class='pop'>" + currentDistrict + "</span> district.</div>"
        document.title = "CoWatch | " + currentDistrict

        if (renderFilter) filtersHolder.style.display = "none"

        return
    }
    notFoundImgContainer.style.display = "none"
    if (!watching && centresData.length != 0) filtersHolder.style.display = "flex"

    let availableHospCount = data.filter(x => x.sessions && x.sessions.some(y => y.available_capacity > 0)).length
    availabilityText.innerHTML = "<span class='nonEmph'>Vaccines available in <span class='emph'>" + availableHospCount + "/" + data.length + "</span> vaccination centres.</span>"

    if (renderFilter)
    {
        renderFiltersInputs(data)
        let sideHeight = document.getElementById('filtersHolder').clientHeight
        if (sideHeight !== 0)
            // document.getElementById('filtersSideNav').style.height = (sideHeight + 47) + 'px'
            document.getElementById('filtersSideNav').style.height = (window.innerHeight - 40) + 'px'
    }

    let detailsHtml = ''
    for (let i = 0; i < data.length; i++)
    {
        let currentHospital = data[i]

        detailsHtml += "<tr>"
        detailsHtml += "<td rowspan='" + currentHospital.sessions.length + "'>" + (i + 1) + ".</td>"
        detailsHtml += "<td class='nameWidthLimit' rowspan='" + currentHospital.sessions.length + "'><b>" + currentHospital.name + "</b>, " + (currentHospital.block_name.toLowerCase() === "not applicable" ? "" : currentHospital.block_name) + "<br><span class='address'>" + currentHospital.address + ", " + currentHospital.pincode + "</span>" + "</td>"
        detailsHtml += "<td rowspan='" + currentHospital.sessions.length + "'>" + currentHospital.fee_type + "</td>"

        for (let j = 0; j < currentHospital.sessions.length; j++)
        {
            if (j > 0) detailsHtml += "<tr>"
            let currentSession = currentHospital.sessions[j]
            detailsHtml += "<td class='cellMinWidth'>" + currentSession.date + "</td>"
            detailsHtml += "<td class='cellMinWidth'>" + currentSession.vaccine + "</td>"
            detailsHtml += "<td>" + currentSession.min_age_limit + "+</td>"
            detailsHtml += "<td style='background-color: #" + (currentSession.available_capacity_dose1 > 0 ? "bfedaf" : "ffc2c2") + ";'>" + currentSession.available_capacity_dose1 + "</td>"
            detailsHtml += "<td style='background-color: #" + (currentSession.available_capacity_dose2 > 0 ? "bfedaf" : "ffc2c2") + ";'>" + currentSession.available_capacity_dose2 + "</td>"
            detailsHtml += "<td style='background-color: #" + (currentSession.available_capacity > 0 ? "bfedaf" : "ffc2c2") + ";'>" + currentSession.available_capacity + "</td>"
            if (j > 0) detailsHtml += "</tr>"
        }

        detailsHtml += "</tr>"
    }

    hospitals.innerHTML = detailsHtml
    setVisibility("table")

    let currentDistrict = districtsSelect.options[districtsSelect.selectedIndex].text
    if (!watching) document.getElementById('watchHeading').innerHTML = "<div style='text-align:center;'>Get pinged when a new vaccination slot becomes available. Press <span class='pop'>Start Watching</span> to start monitoring <span class='pop'>" + currentDistrict + "</span> district.</div>"
    document.title = "CoWatch | " + currentDistrict

    if (previousDetailsHtml !== '' && previousSessionCountMap.size !== 0)
    {
        let sessionCountMap = new Map()
        centresData.map(center =>
            center.sessions.map(session =>
                sessionCountMap.set(session.session_id, { name: center.name, slots: session.available_capacity })
            )
        )

        let newCentres = new Set()
        for (let [key, value] of sessionCountMap)
        {
            if (previousSessionCountMap.has(key))
            {
                if (value.slots > previousSessionCountMap.get(key).slots)
                    newCentres.add(value.name)
            }
            else if (value.slots > 0)
                newCentres.add(value.name)
        }

        if (newCentres.size > 0 && watching) playAlert(Array.from(newCentres))
    }

    buildPreviousSessionCountMap()
    previousDetailsHtml = detailsHtml
}

function renderFiltersInputs(data)
{
    let sessions = data.map(d => d.sessions)
    let mergedSessions = [].concat(...sessions)

    let uniqueFees = getUnique(data.map(d => d.fee_type))
    let uniqueDates = getUnique(mergedSessions.map(s => s.date))
    let uniqueVaccines = getUnique(mergedSessions.map(s => s.vaccine))
    let uniqueAgeGroups = getUnique(mergedSessions.map(s => s.min_age_limit))

    let feeFilterList = document.getElementById("feeFilterList")
    let dateFilterList = document.getElementById("dateFilterList")
    let vaccineFilterList = document.getElementById("vaccineFilterList")
    let ageGroupFilterList = document.getElementById("ageGroupFilterList")
    let slotsFilterList = document.getElementById("slotsFilterList")

    feeFilterList.innerHTML = ''
    dateFilterList.innerHTML = ''
    vaccineFilterList.innerHTML = ''
    ageGroupFilterList.innerHTML = ''
    slotsFilterList.innerHTML = ''

    uniqueFees.map((x, i) => feeFilterList.innerHTML += '<li><input value="' + x + '" type="checkbox" class="filterCheckbox" id="feeFilter-' + i + '"><label for="feeFilter-' + i + '">' + x + '</label></li>')
    uniqueDates.map((x, i) => dateFilterList.innerHTML += '<li><input value="' + x + '" type="checkbox" class="filterCheckbox" id="dateFilter-' + i + '"><label for="dateFilter-' + i + '">' + x + '</label></li>')
    uniqueVaccines.map((x, i) => vaccineFilterList.innerHTML += '<li><input value="' + x + '" type="checkbox" class="filterCheckbox" id="vaccineFilter-' + i + '"><label for="vaccineFilter-' + i + '">' + x + '</label></li>')
    uniqueAgeGroups.map((x, i) => ageGroupFilterList.innerHTML += '<li><input value="' + x + '" type="checkbox" class="filterCheckbox" id="ageGroupFilter-' + i + '"><label for="ageGroupFilter-' + i + '">' + x + '+</label></li>')
    if (data && data.length > 0)
    {
        slotsFilterList.innerHTML += '<li><input value="dose1" type="checkbox" class="filterCheckbox" id="slotsFilter0"><label for="slotsFilter0">Dose I</label></li>'
        slotsFilterList.innerHTML += '<li><input value="dose2" type="checkbox" class="filterCheckbox" id="slotsFilter1"><label for="slotsFilter1">Dose II</label></li>'
    }

    uniqueFees.map((x, i) => document.getElementById('feeFilter-' + i).addEventListener('change', onfilterChange))
    uniqueDates.map((x, i) => document.getElementById('dateFilter-' + i).addEventListener('change', onfilterChange))
    uniqueVaccines.map((x, i) => document.getElementById('vaccineFilter-' + i).addEventListener('change', onfilterChange))
    uniqueAgeGroups.map((x, i) => document.getElementById('ageGroupFilter-' + i).addEventListener('change', onfilterChange))
    if (data && data.length > 0)
    {
        document.getElementById('slotsFilter0').addEventListener('change', onfilterChange)
        document.getElementById('slotsFilter1').addEventListener('change', onfilterChange)
    }

    function onfilterChange(e)
    {
        let target = e.target

        if (target.id.startsWith('feeFilter'))
            target.checked ? filterInclusions.fee.push(target.value) : filterInclusions.fee = filterInclusions.fee.filter(x => x !== target.value)
        else if (target.id.startsWith('dateFilter'))
            target.checked ? filterInclusions.dates.push(target.value) : filterInclusions.dates = filterInclusions.dates.filter(x => x !== target.value)
        else if (target.id.startsWith('vaccineFilter'))
            target.checked ? filterInclusions.vaccines.push(target.value) : filterInclusions.vaccines = filterInclusions.vaccines.filter(x => x !== target.value)
        else if (target.id.startsWith('ageGroupFilter'))
            target.checked ? filterInclusions.ageGroups.push(target.value) : filterInclusions.ageGroups = filterInclusions.ageGroups.filter(x => x !== target.value)
        else if (target.id.startsWith('slotsFilter'))
            target.checked ? filterInclusions.slots = filterInclusions.slots.filter(x => x !== target.value) : filterInclusions.slots.push(target.value)

        previousDetailsHtml = ''
        previousSessionCountMap.clear()
        main(JSON.parse(JSON.stringify(centresData)), false)
    }
}

function applyExcemptionFilters(data)
{
    return data.filter(item => (filterInclusions.fee.length === 0 || filterInclusions.fee.includes(item.fee_type)))
        .map(item =>
        {
            item.sessions = item.sessions.filter(s =>
                (filterInclusions.dates.length === 0 || filterInclusions.dates.includes(s.date)) &&
                (filterInclusions.vaccines.length === 0 || filterInclusions.vaccines.includes(s.vaccine)) &&
                (filterInclusions.ageGroups.length === 0 || filterInclusions.ageGroups.includes(s.min_age_limit.toString())) &&
                (filterInclusions.slots.includes("dose1") ? true : s.available_capacity_dose1 > 0) &&
                (filterInclusions.slots.includes("dose2") ? true : s.available_capacity_dose2 > 0)
            )
            return item
        })
        .filter(item => item.sessions.length !== 0)
}

function stop()
{
    watching = false
    clearInterval(timerId)
    document.getElementById('start-button').removeAttribute("disabled")
    document.getElementById('stop-button').setAttribute("disabled", "true")
    document.getElementById('notificationSettings').style.display = "flex"
    if (centresData.length !== 0)
        setTimeout(() => { filtersHolder.style.display = "flex" }, 500)
    let filterControls = document.getElementById('filterControls')
    filterControls.classList.remove("heightCollapse")
    filterControls.classList.add("heightExpand")
    filtersSideNav.classList.remove("widthCollapse")
    filtersSideNav.classList.add("widthExpand")

    document.getElementById('watchHeading').innerHTML = "<div style='text-align:center;'>Get pinged when a new vaccination slot becomes available. Press Start Watching to start monitoring <span class='pop'>" + districtsSelect.options[districtsSelect.selectedIndex].text + "</span> district.</div>"
}

function start()
{
    let filterControls = document.getElementById('filterControls')
    filterControls.classList.add("heightCollapse")
    filterControls.classList.remove("heightExpand")
    filtersSideNav.classList.add("widthCollapse")
    filtersSideNav.classList.remove("widthExpand")

    previousDetailsHtml = ''
    previousSessionCountMap.clear()
    document.getElementById('start-button').setAttribute("disabled", "true")
    document.getElementById('stop-button').removeAttribute("disabled")
    document.getElementById('notificationSettings').style.display = "none"
    filtersHolder.style.display = "none"

    document.getElementById('watchHeading').innerHTML =
        "<div class='watchingText'> <div id='watchingDot'></div><span>CoWatch is now monitoring Co-WIN portal every " +
        Math.round(refreshInterval / 1000) +
        " seconds.</span></div> <div style='text-align:center;'>You'll be notified if CoWatch finds new vaccination slots in " +
        "<span class='pop'>" + districtsSelect.options[districtsSelect.selectedIndex].text + "</span>" +
        " district. <span class='pop'> Keep This Tab Open. </span></div>"

    resetFilter()
    refreshTable(true)
    clearInterval(timerId)
    timerId = setInterval(() => { refreshTable(true) }, refreshInterval)
    watching = true
}

function playAlert(newCentres)
{
    document.getElementById('foundBanner').style.display = "block"
    document.getElementById('foundBannerBody').innerHTML = "New vaccination slots are now available at " + createSentence(newCentres, false)

    let tone = new Audio(relativePath + 'assets/beep.mp3')

    if (alertId === 0) alertId = setInterval(() => tone.play(), 1000)

    if (browserNotificationCheckbox.checked)
        new Notification('CoWatch Alert', { body: createSentence(newCentres, true), icon: relativePath + "./assets/img/icon.png" })
}

function dismiss()
{
    clearInterval(alertId)
    alertId = 0

    document.getElementById('foundBanner').style.display = "none"
    document.getElementById('muteAlertButton').style.display = "block"
}

function mute()
{
    clearInterval(alertId)
    alertId = 0

    document.getElementById('muteAlertButton').style.display = "none"
}

function setVisibility(item)
{
    theTable.style.display = item === "table" ? "block" : "none"
    failedMsg.style.display = item === "failed" ? "flex" : "none"
    loadingIndicator.style.display = item === "spinner" ? "block" : "none"
    notFoundImgContainer.style.display = item === "notFound" ? "flex" : "none"
}
