let states = []
let timerId = 0
let alertId = 0
let watching = false
let centresData = {}
let statesSelect = {}
let districtsSelect = {}
let filterExcemptions = {}
let previousDetailsHtml = ''
let browserNotificationCheckbox = {}
let previousSessionCountMap = new Map()

let refreshInterval = 15000

async function onload()
{
    //states = await buildAllDistrictIdMap()
    states = await buildAllDistrictIdMapLocal()

    window.onpopstate = () =>
    {
        window.location.href = window.location.href
    }
    window.onbeforeunload = () =>
    {
        if (watching) return "Currently watching is in progress. Are you sure, you want to close?"
    }

    statesSelect = document.getElementById('states')
    districtsSelect = document.getElementById('districts')

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

    document.getElementById('watchHeading').innerHTML = "Get pinged when a new vaccination slot becomes available. Press <span class='pop'>Start Watching</span> to start monitoring <span class='pop'>" + districtsSelect.options[districtsSelect.selectedIndex].text + "</span> district."

    resetFilter()
    refreshTable(true)
}

function resetFilter()
{
    filterExcemptions = { fee: [], dates: [], vaccines: [], ageGroups: [], slots: ["dose1", "dose2"] }
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
    let watchDistrictId = districtsSelect.value
    let todayString = getTodayString()

    //let endpoint = relativePath + "assets/test.json"
    let endpoint = "https://cdn-api.co-vin.in/api/v2/appointment/sessions/public/calendarByDistrict?district_id=" + watchDistrictId + "&date=" + todayString

    let response = await fetch(endpoint)
    let responseAsJson = await response.json()

    centresData = JSON.parse(JSON.stringify(responseAsJson.centers))
    document.getElementById('last-refreshed').innerHTML = "Last refreshed: <b>" + getTodayString(true) + "</b>"

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

        document.getElementById('notFoundImgContainer').style.display = "grid"
        document.getElementById('table').style.display = "none"
        document.getElementById('availability').innerHTML = "<span class='nonEmph'> Vaccines available in <span class='emph'>0/0</span> vaccination centres.</span>"

        if (!watching) document.getElementById('watchHeading').innerHTML = "Get pinged when new a vaccination slot becomes available. Press <span class='pop'>Start Watching</span> to start monitoring <span class='pop'>" + currentDistrict + "</span> district."
        document.title = "CoWatch | " + currentDistrict

        if (renderFilter)
        {
            document.getElementById('centersNotFound').style.display = "block"
            document.getElementById('filtersHolder').style.display = "none"
        }

        return
    }
    document.getElementById('notFoundImgContainer').style.display = "none"
    document.getElementById('centersNotFound').style.display = "none"
    if (!watching) document.getElementById('filtersHolder').style.display = "flex"
    document.getElementById('table').style.display = "block"

    let availableHospCount = data.filter(x => x.sessions && x.sessions.some(y => y.available_capacity > 0)).length
    document.getElementById('availability').innerHTML = "<span class='nonEmph'>Vaccines available in <span class='emph'>" + availableHospCount + "/" + data.length + "</span> vaccination centres.</span>"

    if (renderFilter)
        renderFiltersInputs(data)

    let detailsHtml = ''
    for (let i = 0; i < data.length; i++)
    {
        let currentHospital = data[i]

        detailsHtml += "<tr>"
        detailsHtml += "<td rowspan='" + currentHospital.sessions.length + "'>" + (i + 1) + ".</td>"
        detailsHtml += "<td class='nameWidthLimit' rowspan='" + currentHospital.sessions.length + "'><b>" + currentHospital.name + "</b>, " + currentHospital.block_name + "<br><span class='address'>" + currentHospital.address + ", " + currentHospital.pincode + "</span>" + "</td>"
        detailsHtml += "<td rowspan='" + currentHospital.sessions.length + "'>" + currentHospital.fee_type + "</td>"

        for (let j = 0; j < currentHospital.sessions.length; j++)
        {
            if (j > 0) detailsHtml += "<tr>"
            let currentSession = currentHospital.sessions[j]
            detailsHtml += "<td>" + currentSession.date + "</td>"
            detailsHtml += "<td>" + currentSession.vaccine + "</td>"
            detailsHtml += "<td>" + currentSession.min_age_limit + "+</td>"
            detailsHtml += "<td style='background-color: #" + (currentSession.available_capacity_dose1 > 0 ? "bfedaf" : "ffc2c2") + ";'>" + currentSession.available_capacity_dose1 + "</td>"
            detailsHtml += "<td style='background-color: #" + (currentSession.available_capacity_dose2 > 0 ? "bfedaf" : "ffc2c2") + ";'>" + currentSession.available_capacity_dose2 + "</td>"
            detailsHtml += "<td style='background-color: #" + (currentSession.available_capacity > 0 ? "bfedaf" : "ffc2c2") + ";'>" + currentSession.available_capacity + "</td>"
            if (j > 0) detailsHtml += "</tr>"
        }

        detailsHtml += "</tr>"
    }

    document.getElementById('hospitals').innerHTML = detailsHtml

    let currentDistrict = districtsSelect.options[districtsSelect.selectedIndex].text
    if (!watching) document.getElementById('watchHeading').innerHTML = "Get pinged when new a vaccination slot becomes available. Press <span class='pop'>Start Watching</span> to start monitoring <span class='pop'>" + currentDistrict + "</span> district."
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

    uniqueFees.map((x, i) => feeFilterList.innerHTML += '<li><input value="' + x + '" checked type="checkbox" class="filterCheckbox" id="feeFilter-' + i + '"><label for="feeFilter-' + i + '">' + x + '</label></li>')
    uniqueDates.map((x, i) => dateFilterList.innerHTML += '<li><input value="' + x + '" checked type="checkbox" class="filterCheckbox" id="dateFilter-' + i + '"><label for="dateFilter-' + i + '">' + x + '</label></li>')
    uniqueVaccines.map((x, i) => vaccineFilterList.innerHTML += '<li><input value="' + x + '" checked type="checkbox" class="filterCheckbox" id="vaccineFilter-' + i + '"><label for="vaccineFilter-' + i + '">' + x + '</label></li>')
    uniqueAgeGroups.map((x, i) => ageGroupFilterList.innerHTML += '<li><input value="' + x + '" checked type="checkbox" class="filterCheckbox" id="ageGroupFilter-' + i + '"><label for="ageGroupFilter-' + i + '">' + x + '+</label></li>')
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
            target.checked ? filterExcemptions.fee = filterExcemptions.fee.filter(x => x !== target.value) : filterExcemptions.fee.push(target.value)
        else if (target.id.startsWith('dateFilter'))
            target.checked ? filterExcemptions.dates = filterExcemptions.dates.filter(x => x !== target.value) : filterExcemptions.dates.push(target.value)
        else if (target.id.startsWith('vaccineFilter'))
            target.checked ? filterExcemptions.vaccines = filterExcemptions.vaccines.filter(x => x !== target.value) : filterExcemptions.vaccines.push(target.value)
        else if (target.id.startsWith('ageGroupFilter'))
            target.checked ? filterExcemptions.ageGroups = filterExcemptions.ageGroups.filter(x => x !== target.value) : filterExcemptions.ageGroups.push(target.value)
        else if (target.id.startsWith('slotsFilter'))
            target.checked ? filterExcemptions.slots = filterExcemptions.slots.filter(x => x !== target.value) : filterExcemptions.slots.push(target.value)

        previousDetailsHtml = ''
        previousSessionCountMap.clear()
        main(JSON.parse(JSON.stringify(centresData)), false)
    }
}

function applyExcemptionFilters(data)
{
    return data.filter(item => !filterExcemptions.fee.includes(item.fee_type))
        .map(item =>
        {
            item.sessions = item.sessions.filter(s => !filterExcemptions.dates.includes(s.date) &&
                !filterExcemptions.vaccines.includes(s.vaccine) &&
                !filterExcemptions.ageGroups.includes(s.min_age_limit.toString()) &&
                (filterExcemptions.slots.includes("dose1") ? true : s.available_capacity_dose1 > 0) &&
                (filterExcemptions.slots.includes("dose2") ? true : s.available_capacity_dose2 > 0)
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
    let filterControls = document.getElementById('filterControls')
    filterControls.classList.remove("heightCollapse")
    filterControls.classList.add("heightExpand")

    document.getElementById('watchHeading').innerHTML = "Get pinged when a new vaccination slot becomes available. Press Start Watching to start monitoring <span class='pop'>" + districtsSelect.options[districtsSelect.selectedIndex].text + "</span> district."
}

function start()
{
    let filterControls = document.getElementById('filterControls')
    filterControls.classList.add("heightCollapse")
    filterControls.classList.remove("heightExpand")
    previousDetailsHtml = ''
    previousSessionCountMap.clear()
    document.getElementById('start-button').setAttribute("disabled", "true")
    document.getElementById('stop-button').removeAttribute("disabled")
    document.getElementById('notificationSettings').style.display = "none"
    
    document.getElementById('watchHeading').innerHTML = "<div class='watchingText'> <div id='watchingDot'></div>CoWatch is now monitoring Co-WIN portal every " +
        Math.round(refreshInterval / 1000) +
        " seconds.</div> You'll be notified if CoWatch finds new vaccination slots in " +
        "<span class='pop'>" + districtsSelect.options[districtsSelect.selectedIndex].text + "</span>" +
        " district. <span class='pop'> Keep This Tab Open. </span>"

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

    if(browserNotificationCheckbox.checked)
        new Notification('CoWatch Alert', { body: createSentence(newCentres, true), icon: relativePath + "./assets/img/icon.png"})
}

function dismiss()
{
    clearInterval(alertId)
    alertId = 0

    document.getElementById('foundBanner').style.display = "none"
}
