/*
 * Copyright 2020 Google LLC
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     https://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var _ = require('lodash');
var utils = require('./utils');
var database = require('./database');

function StationManager() {
    this.stationStatus = {
        IDLE: "IDLE",
        CONNECTED: "CONNECTED",
        WAIT_FOR_CAR_TO_CONNECT: "WAIT_FOR_CAR_TO_CONNECT", 
        DISPLAY_START_PAGE: "DISPLAY_START_PAGE",
        DISPLAY_PLACE_OPTIONS: "DISPLAY_PLACE_OPTIONS",
        WAIT_FOR_CAR_TO_ARRIVE_AT_DESTINATION: "WAIT_FOR_CAR_TO_ARRIVE_AT_DESTINATION",
        WAIT_FOR_CAR_DISCONNECT: "WAIT_FOR_CAR_DISCONNECT",
        NO_CONNECTION: "NO_CONNECTION",
        WARNING: "WARNING",
        ERROR: "ERROR"
    };
}

var stationManager = new StationManager();

StationManager.prototype.connectStation = function(data, fn) {
    let stationTemp = {
        device_id: data.device_id,
        station_id: data.station_id,
        status: stationManager.stationStatus.CONNECTED,
        ip_address: data.ip_address,
        online: true
    }

    database.findStationById(stationTemp.station_id, function(err, station){
        if (err) {
			fn(err, null);
		} else {
            if(_.isEmpty(station))  {
                stationManager.createStation(stationTemp, function(err, results) {
                    if(err) {
                        fn(err, null);
                    } else {
                        fn(null, {success: true});
                    }
                });
            } else {
                database.updateStationById(stationTemp.station_id, stationTemp, function(err, results){
                    if(err) {
                        fn(err, null);
                    } else {
                        fn(null, {success: true});
                    }
                });               
            }
            
		}
    });   
}

StationManager.prototype.disconnectStation = function(station, fn) {
    database.updateStation(station.device_id, {status: stationManager.stationStatus.NO_CONNECTION, online: false}, function(err, results){
        if(err) {
            fn(err, null);
        } else {
            fn(null, {success: true});
        }
    });
}

StationManager.prototype.createStation = function(station, fn) {
    database.addStation(station,  function(err, results) {
        if(err) {
            fn(err, null);
        }else {
            fn(null, {success: true});
        }
    });
}

StationManager.prototype.getStationInfo = function(device_id, fn) {
    database.findStationByDeviceId(device_id, function(err, stations){
        if (err) {
			fn(err, null);
		} else {
            if(_.isEmpty(stations))  {
                fn(null, true);
            }else {
                fn(null, stations[0]);
            }
            
		}
    });   
}

StationManager.prototype.changeStatus = function(device_id, status, fn) {
    database.updateStationStatus(device_id, status, function(err, results) {
        if(err) {
            fn(err, null);
        } else {
            fn(null, results);
        }
    });
}


module.exports = stationManager;