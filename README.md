# Overview

Born out of necessity, this project helps you book your COVID-19 vaccination slot (if you live in India). Get pinged when a new vaccination slot becomes available in your area through sound alerts and browser notifications. An `IFTT` integration to receive mobile notifications is in the works.

This program **cannot not book** a vaccination slot for you, instead it uses the Co-WIN APIs to alert you when a new slot becomes available.

# :rocket: Demo

Checkout a live version of CoWatch [here](https://diozz.github.io/cowatch).

![](https://i.imgur.com/IXJAiY0.gif)

# The Co-WIN API 

CoWatch makes use of the Indian Government's [Co-WIN API](https://apisetu.gov.in/public/marketplace/api/cowin/cowin-public-v2), to fetch vaccination slot data. These APIs are publicly available for use by third party applications. However, they do limit the number of API calls to 100 per 5 minutes per IP. Consider this if you're planning to build something awesome on top of this project.

# Setup

This project is written in vanilla Javascript and can be ran out of the box, without any dependencies.

## Usage

Usage is pretty straight forward. The tool only works with Indian IP addresses so disconnect your VPN if needed.

- Select your state and district.
- Here you can browse through the available health centres and vaccination slots.
- Press on `Start Watching`. Script will start to continously query and refresh the data once at every specified interval. (15 seconds by default).
- When a new slot becomes available, you'll be alerted by sounds and browser notifications.
- **Do not close the tab while watching**.

## Sharable URL

The URL can be configured to point to a specific district and display its slots. This can be done by providing corresponding `districtId` as a query parameter: `/?districtId=xx`

Example: https://diozz.github.io/cowatch/?districtId=140

Refer [`districts.json`](https://github.com/diozz/cowatch/blob/main/assets/districts.json) for a list of valid district IDs. Invalid `districtId`s are ignored.

## Configure Locally

To modify CoWatch:

- Clone the repository. using `! Git Clone https://github.com/diozz/cowatch.git`
- To modify the watching time interval, edit the `refreshInterval` varible [here](https://github.com/diozz/cowatih/blob/main/js/cowatch.js#L12) and set the value in milliseconds. Remember not to modify intervals to below `3000ms` to remain complaint with the [Co-WIN Public API](https://apisetu.gov.in/public/marketplace/api/cowin/cowin-public-v2) regulations.
- By default, CoWatch uses a [cached version](https://github.com/diozz/cowatch/blob/main/assets/districts.json) of state and district data for better load times. Now, this works fine, but if the back-end were to modify the district-id mappings, use `buildAllDistrictIdMap` method in [`districts.js`](https://github.com/diozz/cowatch/blob/main/js/districts.js#L21) to re-generate the updated district-id mappings. Or you can also uncomment [this](https://github.com/diozz/cowatch/blob/main/js/cowatch.js#L16) line instead, to prevent using cached data.

---

# Contributions

Contributions are always welcome! Feel free to clone and improve the project.


