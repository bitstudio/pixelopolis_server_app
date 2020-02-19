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
var database = require('./database');

function CarManager() {
    this.carStatus = { 
        IDLE: "IDLE",
        CONNECTED: "CONNECTED",
        WAIT_FOR_START: "WAIT_FOR_START", 
        WAIT_FOR_PLACE_SELECTION: "WAIT_FOR_PLACE_SELECTION",
        REQUEST_ROUTE_TO_DESTINATION: "REQUEST_ROUTE_TO_DESTINATION",
        ON_ROUTE_TO_NODE: "ON_ROUTE_TO_NODE",
        ARRIVE_AT_NODE: "ARRIVE_AT_NODE",
        WAIT_FOR_TRAFFIC: "WAIT_FOR_TRAFFIC",
        ARRIVE_AT_DESTINATION: "ARRIVE_AT_DESTINATION",
        NO_CONNECTION: "NO_CONNECTION",
        WARNING: "WARNING",
        ERROR: "ERROR"
    };
}

var carManager = new CarManager();

CarManager.prototype.connectCar = function(data, fn) {
    let carTemp = {
        device_id: data.device_id,
        car_id: data.car_id,
        status: carManager.carStatus.CONNECTED,
        ip_address: data.ip_address,
        online: true,
        server_trigger: ""
    }

    database.findCarByCarId(carTemp.car_id, function(err, car){
        if (err) {
			fn(err, null);
		} else {
            if(_.isEmpty(car))  {
                carManager.createCar(carTemp, function(err, results){
                    if(err) {
                        fn(err, null);
                    } else {
                        fn(null, {success: true});
                    }
                });
            }else {
                database.updateCarById(carTemp.car_id, carTemp, function(err, results){
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

CarManager.prototype.disconnectCar = function(car, fn) {
    database.updateCar(car.device_id, {status: carManager.carStatus.NO_CONNECTION, online: false}, function(err, results){
        //Clear Car
        database.clearCarFromNode(car.car_id)
        database.clearCarFromPath(car.car_id)
        if(err) {
            fn(err, null);
        } else {
            fn(null, {success: true});
        }
    });
}

CarManager.prototype.createCar = function(car, fn) {
    database.addCar(car,  function(err, results) {
        if(err) {
            fn(err, null);
        } else {
            fn(null, {success: true});
        }
    });
}

CarManager.prototype.getCarInfo = function(device_id, fn) {
    database.findCarByDeviceId(device_id, function(err, cars){
        if (err) {
			fn(err, null);
		} else {
            if(_.isEmpty(cars))  {
                fn(null, false);
            }else {
                fn(null, cars[0]);
            }
            
		}
    });   
}

CarManager.prototype.changeStatus = function(car_id, device_id, status, fn) {
    database.updateCarStatus(car_id, device_id, status, function(err, results) {
        if(err) {
            fn(err, null);
        } else {
            fn(null, results);
        }
    });
}

CarManager.prototype.getAvailableCar = function(status, fn) {  
    database.findCarByStatus(status, function(err, results) {
        if(err) {
            fn(err, null);
        }else {
            if(_.isEmpty(results)) {
                fn(err, false);
            } else {
                fn(null, results[0]);
            }
        }
    });
}

CarManager.prototype.getAvailableCarByCarId = function(car_id, fn) {  
    database.findCarByCarId(car_id, function(err, results) {
        if(err) {
            fn(err, null);
        }else {
            if(_.isEmpty(results)) {
                fn(err, false);
            } else {
                fn(null, results[0]);
            }
        }
    });
}

module.exports = carManager