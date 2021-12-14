
<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>


# Solax Cloud Plugin for Homebridge

![npm](https://badgen.net/npm/v/homebridge-solaxcloud-api) ![npm](https://badgen.net/npm/dt/homebridge-solaxcloud-api)


This [Homebridge](https://homebridge.io/) platform plugin was created to gather data from the Solax Cloud API (as documented in the official [Solax Cloud API](https://www.eu.solaxcloud.com/phoebus/resource/files/userGuide/Solax_API_for_End-user_V1.0.pdf)) by relying on the provided TokenID and SN.

HomeKit is still clueless about what a solar panel is. So, this Solax Cloud Plugin exposes a set of standard HomeKit accessories though Homebridge that will allow interacting and automating your smart home based on the data available from the Solax platform:

- Inverter PV (outlet with power consumption)
- Inverter AC (outlet with power consumption)
- Inverter to Grid (outlet with power consumption)
- Inverter to House (outlet with power consumption)
- Grid To House (outlet with power consumption)
- Update (Motion sensor)

![accessories](images/plugin-accessories-home.png)
 
## Required information

For this plugin to work, two critical pieces of information are required: 

- **Token ID**: Solax users can get inverter information through the granted tokenID. You need to obtain your tokenID on the API page of Solaxcloud.
- **SN**: Registration No (communication module SN).

## Installation

This plugin is supported under Homebridge. It is highly recommended that you use Homebridge Config UI X to install and configure this plugin.

### Manual Installation

Install this plugin using: `sudo npm install -g homebridge-solaxcloud-api`.
Edit `config.json` manually to add your Solax inverters. See below for instructions on that.

## Platform configuration

Minimum platform configuration is depicted by the example configuration file below:

```json
{
  "platforms": [
    {
      "platform": "SolaxCloudAPI",
      "name": "My Solax",
      "tokenId": "20200722185111234567890",
      "sn": "ABCDEFGHIJ",
      "pollingFrequency": 60
    }
  ]
}
```
**NOTE:** The `pollingFrequency` parameter is optional and defaults to 300 seconds, since Solax inverters update cloud data every 5 minutes.

Configuration through the the use of [Homebridge UI](https://github.com/oznu/homebridge-config-ui-x) plugin is also available and recommended:

![sample](images/homebridge-ui.png)

## Non-standard characteristics

Non-standard accessory characteristics are available through the use of [Eve for HomeKit app](https://apps.apple.com/us/app/eve-for-homekit/id917695792) you may download from the App Store.

This will allow some important non-standard characteristics to be visible (like consumption), as depicted in the image below:

![consumption](images/plugin-outlet-consumption.png)

# Automation

Automation can be achieved with the help of the virtual "Update" motion sensor that was specifically tailored for this effect. This motion sensor will be triggered whenever data gets updated from the Solax Cloud API (in line with what is defined on the `pollingFrequency` configuration setting). 

![motion](images/plugin-accessories-eve.png)

Whenever motion is detected, plugin data was refreshed for each of the virtual outlets enumerated above and may be used for further defining an automation.

## Automation example

As an automation example...

# TO DO

Next planned plugin releases should include:

- History through [fakegato-history](https://github.com/simont77/fakegato-history) module
