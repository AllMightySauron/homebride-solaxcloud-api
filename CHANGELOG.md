# Changelog

All notable changes to this project will be documented in this file.

## [v2.1.8] - 2022-07-20
### Changes
* Bumped dependencies.
### Fixed
* Update on polling logic to prevent event memory leak issue ([#04](https://github.com/AllMightySauron/homebride-solaxcloud-api/issues/4)).

## [v2.1.7] - 2022-05-03
### Changes
* Bumped dependencies.
* Unit testing for multiple inverters.
### Fixed
* Documentation updates.

## [v2.1.6] - 2022-04-07
### Changes
* Battery totals SoC updated to "All inverters".
### Fixed
* Compressed image size for README information.

## [v2.1.5] - 2022-04-07
### Changed
* New inverter accessory **Battery** for State of Charge (SoC) information.
* Support for battery charge level, charge state and low battery handler (<10%).

## [v2.1.4] - 2022-04-06
### Changed
* Added "All inverters" virtual inverter for totalizing inverter figures for all sensors.
* Preliminary battery support with **From Battery** and **To Battery** charge power ([#02](https://github.com/AllMightySauron/homebride-solaxcloud-api/issues/2)).

## [v2.1.2] - 2022-03-31
### Fixed
* Bumped dependencies to latest versions.
### Changed
* Initial support for multiple inverters.

## [v2.0.3] - 2022-01-25
### Fixed
* Fixed dependabot detected vulnerabilities.

## [v2.0.2] - 2022-01-24
### Changed
* Added support for "pure" Home app accessories (power consumption displayed as Ambient Light Sensors) ([#01](https://github.com/AllMightySauron/homebride-solaxcloud-api/issues/1)).
* Created optional accessories to display smooth value from raw API data (minimizing sporadic events like a cloud passing).

## [v1.5.1] - 2022-01-08
### Fixed
* Disabled repeat last data for history (connection problems may lead to strange values).

## [v1.5.0] - 2021-12-31
### Changed
* Homebridge certified!

## [v1.4.6] - 2021-12-28
### Fixed
* Added extended parameter check (including Solax Cloud limits).

## [v1.4.5] - 2021-12-27
### Fixed
* Sanity checks for mandatory config parameters.

## [v1.4.4] - 2021-12-22
### Fixed
* Automation example added to documentation.

## [v1.4.3] - 2021-12-21
### Fixed
* Code cleanup and optimizations.

## [v1.4.1] - 2021-12-21
### Fixed
* First working version with fakegato-history for Eve.

## [v1.4.0] - 2021-12-20
### Changed
* Initial fakegato-history release for Eve.

## [v1.3.1] - 2021-12-14
### Fixed
* Documentation updated to reflect new **Total Energy** characteristic on Inverter AC.

## [v1.3.0] - 2021-12-14
### Changed
* Added support for total energy consumption.

## [v1.2.1] - 2021-12-14
### Fixed
* Updates to the official documentation.

## [v1.2.0] - 2021-12-13
### Changed
* First official release.