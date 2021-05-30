function getUnique(array)
{
    return array.filter((x, i, a) => a.indexOf(x) === i)
}

function createSentence(array, minify)
{
    if (minify && array.length > 2)
    {
        let difference = array.length - 2
        return array[0] + ", " + array[1] + " and " + difference + " other" + (difference > 1 ? "s." : ".")
    }
    if (minify) return array.map((x, i) => i === 1 ? " and " + x : x).join('') + '.'
    array = array.map((x, i) =>
    {
        if (i === 0) return "<b>" + x + (array.length === 1 ? "</b>." : "</b>")
        if (i === array.length - 1) return " and <b>" + x + "</b>."
        return ", <b>" + x + "</b>"
    })
    return array.join('')
}

function getParameterByName(name, url = window.location.href)
{
    name = name.replace(/[\[\]]/g, '\\$&')
    let regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'), results = regex.exec(url);
    if (!results) return null
    if (!results[2]) return ''
    return decodeURIComponent(results[2].replace(/\+/g, ' '))
}

function getTodayString(withTime)
{
    let today = new Date()
    if (withTime)
        return today.toLocaleString()
    return String(today.getDate()).padStart(2, '0') + "-" + String(today.getMonth() + 1).padStart(2, '0') + "-" + today.getFullYear()
}

function isNumeric(str)
{
    if (typeof str != "string") return false
    return !isNaN(str) && !isNaN(parseFloat(str))
}

function getUrlParts(url)
{
    var a = document.createElement('a');
    a.href = url;

    return {
        href: a.href,
        host: a.host,
        hostname: a.hostname,
        port: a.port,
        pathname: a.pathname,
        protocol: a.protocol,
        hash: a.hash,
        search: a.search
    };
}