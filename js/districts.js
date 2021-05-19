async function getStates()
{
    let endpoint = "https://cdn-api.co-vin.in/api/v2/admin/location/states"

    let response = await fetch(endpoint)
    let responseAsJson = await response.json()

    return responseAsJson.states
}

async function getDistrictsByStateId(stateId)
{
    let endpoint = "https://cdn-api.co-vin.in/api/v2/admin/location/districts/" + stateId

    let response = await fetch(endpoint)
    let responseAsJson = await response.json()

    return responseAsJson.districts
}

async function buildAllDistrictIdMap()
{
    let districtIdMap = []
    let states = await getStates()

    for (let i = 0; i < states.length; i++)
    {
        let stateName = cleanName(states[i].state_name)
        let stateId = states[i].state_id
        let state = { stateName, stateId, districts: [] }

        let districts = await getDistrictsByStateId(states[i].state_id)

        for (let j = 0; j < districts.length; j++)
        {
            let districtName = districts[j].district_name
            state.districts.push({ districtName: cleanName(districtName), districtId: districts[j].district_id })
        }

        districtIdMap.push(state)
    }

    return districtIdMap
}

function cleanName(name)
{
    return name.replaceAll(' and ', ' & ').trim()
}

async function buildAllDistrictIdMapLocal()
{
    let path = getUrlParts(window.location.href).pathname.replace('index.html','');
    let endpoint = path + 'assets/districts.json'

    let response = await fetch(endpoint)
    let responseAsJson = await response.json()

    return responseAsJson
}
